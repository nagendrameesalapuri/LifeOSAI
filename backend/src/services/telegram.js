const TelegramBot = require('node-telegram-bot-api');
const prisma = require('../lib/prisma');
const ai = require('./ai');
const memory = require('./memory');
const { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } = require('../data/safe-select');

let bot = null;
const activeChatIds = new Set();
const waterTracker = new Map();
const WATER_GOAL = 4;

const USER_SELECT = { id: true, name: true, email: true, weightKg: true, targetWeightKg: true, heightCm: true, age: true, profession: true, createdAt: true };

// Convert AI markdown (##, **bold**) → Telegram Markdown (*bold*)
function fmt(text) {
  if (!text) return '';
  return text
    .replace(/^#{1,3}\s+(.+)$/gm, '*$1*')   // ## Heading → *Heading*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')        // **bold** → *bold*
    .replace(/^---+$/gm, '─────────────')     // --- → line
    .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/```\w*\n?/g, '').trim()) // strip code fences
    .trim();
}

function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

async function getUser(telegramId) {
  try {
    if (telegramId) {
      const byTelegram = await prisma.user.findFirst({ where: { telegramChatId: String(telegramId) }, select: USER_SELECT }).catch(() => null);
      if (byTelegram) return byTelegram;
    }
    // No unlinked-account fallback — returning null forces the user to link via /start
    return null;
  } catch (e) { return null; }
}

async function init() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.log('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled'); return; }

  const isProduction = process.env.NODE_ENV === 'production';

  try {
    bot = new TelegramBot(token, { polling: !isProduction });
    await bot.getMe();
    await loadActiveChatIds();
    registerCommands();
    console.log(`Telegram bot started (${isProduction ? 'webhook' : 'polling'} mode)`);
  } catch (e) {
    console.log('Telegram bot token invalid — bot disabled:', e.message);
    bot = null;
  }
}

async function loadActiveChatIds() {
  try {
    const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } }, select: { telegramChatId: true } });
    for (const u of users) { const id = parseInt(u.telegramChatId); if (!isNaN(id)) activeChatIds.add(id); }
    console.log(`Loaded ${activeChatIds.size} Telegram chat IDs from DB`);
  } catch {}
}

function registerCommands() {
  bot.setMyCommands([
    { command: 'start', description: 'Start LIFEOS bot' },
    { command: 'checkin', description: 'Morning check-in' },
    { command: 'weight', description: 'Log weight (e.g. /weight 63.5)' },
    { command: 'workout', description: 'Log workout (e.g. /workout push 60)' },
    { command: 'sleep', description: 'Log sleep (e.g. /sleep 23:00 07:00)' },
    { command: 'study', description: 'Log study (e.g. /study Docker 45)' },
    { command: 'english', description: 'Correct English (e.g. /english I go yesterday)' },
    { command: 'kannada', description: "Today's Kannada lesson" },
    { command: 'water', description: 'Log water (e.g. /water 0.5)' },
    { command: 'profile', description: 'Your full profile & life stats' },
    { command: 'report', description: 'Weekly life report' },
    { command: 'plan', description: "Today's personalized plan" },
    { command: 'nudge', description: 'Get proactive insights' },
    { command: 'coach', description: 'Chat with AI coach' },
  ]);

  const safe = (fn) => async (...args) => {
    try { await fn(...args); } catch (e) {
      const chatId = args[0]?.chat?.id;
      if (chatId) bot.sendMessage(chatId, `⚠️ Error: ${(e?.message || String(e)).slice(0, 200)}`).catch(() => {});
    }
  };

  bot.onText(/\/start/, safe((msg) => handleStart(msg)));
  bot.onText(/\/checkin/, safe((msg) => handleMorningCheckin(msg)));
  bot.onText(/\/weight (.+)/, safe((msg, match) => handleWeight(msg, match)));
  bot.onText(/\/weight$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /weight 63.5'));
  bot.onText(/\/workout (.+)/, safe((msg, match) => handleWorkout(msg, match)));
  bot.onText(/\/sleep (.+)/, safe((msg, match) => handleSleep(msg, match)));
  bot.onText(/\/study (.+)/, safe((msg, match) => handleStudy(msg, match)));
  bot.onText(/\/english (.+)/, safe((msg, match) => handleEnglish(msg, match)));
  bot.onText(/\/kannada/, safe((msg) => handleKannada(msg)));
  bot.onText(/\/profile/, safe((msg) => handleProfile(msg)));
  bot.onText(/\/report/, safe((msg) => handleReport(msg)));
  bot.onText(/\/plan/, safe((msg) => handlePlan(msg)));
  bot.onText(/\/nudge/, safe((msg) => handleProactiveNudge(msg)));
  bot.onText(/\/coach (.+)/, safe((msg, match) => handleCoach(msg, match)));
  bot.onText(/\/water (.+)/, safe((msg, match) => handleWater(msg, match)));
  bot.onText(/\/water$/, (msg) => bot.sendMessage(msg.chat.id, 'Usage: /water 0.5 (liters)'));
  bot.on('message', (msg) => { if (!msg.text?.startsWith('/')) handleFreeChat(msg).catch(() => {}); });
}

async function handleStart(msg) {
  const chatId = msg.chat.id;
  activeChatIds.add(chatId);

  // Link this Telegram chat to the first user in DB (single-user app)
  // In multi-user: the user must have signed in on the web app first
  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: String(chatId) } });
    }
  } catch {}

  bot.sendMessage(chatId, `🚀 *LIFEOS AI Coach — Your Life OS*\n\nWelcome back\\! I'm your personal life coach\\.\n\n*📅 Daily Log:*\n/checkin — Morning check\\-in \\& priorities\n/weight 63\\.5 — log weight\n/workout push 60 — log workout\n/sleep 23:00 07:00 — log sleep\n/study Docker 45 — log study\n/english I go yesterday — correct grammar\n/kannada — today's lesson\n/water 0\\.5 — log water\n\n*📊 Analysis:*\n/profile — your full profile \\& stats\n/report — weekly life report\n/plan — today's full plan\n/nudge — AI\\-detected patterns\n/coach \\[question\\] — chat with coach\n\n💡 Use /checkin every morning\\!`, { parse_mode: 'MarkdownV2' });
}

async function handleMorningCheckin(msg) {
  const chatId = msg.chat.id; activeChatIds.add(chatId);
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found. Log in at the web app first.');
  bot.sendMessage(chatId, '☀️ Generating your morning check-in...');
  const checkin = await ai.generateMorningCheckin(user.id);
  let text = `${checkin.greeting || '☀️ Good morning!'}\n\n`;
  if (checkin.yesterdaySummary) {
    const s = checkin.yesterdaySummary;
    text += `*Yesterday:*\n`;
    if (s.wins?.length) text += `✅ ${s.wins[0]}\n`;
    if (s.miss) text += `⚠️ ${s.miss}\n`;
    text += '\n';
  }
  if (checkin.todayPriorities) {
    text += `*Today's 3 Priorities:*\n`;
    checkin.todayPriorities.forEach((p, i) => { text += `${i + 1}. ${p}\n`; });
    text += '\n';
  }
  if (checkin.insight) text += `💡 _${fmt(checkin.insight)}_\n\n`;
  if (checkin.motivationalNote) text += `🔥 ${fmt(checkin.motivationalNote)}`;

  if (prisma.morningCheckin) {
    await prisma.morningCheckin.upsert({ where: { userId_date: { userId: user.id, date: today() } }, update: { completedVia: 'telegram' }, create: { userId: user.id, date: today(), completedVia: 'telegram' } }).catch(() => {});
  }
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleWeight(msg, match) {
  const chatId = msg.chat.id;
  const weight = parseFloat(match[1]);
  if (isNaN(weight)) return bot.sendMessage(chatId, 'Invalid weight. Use: /weight 63.5');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  await prisma.weightLog.create({ data: { userId: user.id, weightKg: weight } });
  await prisma.user.update({ where: { id: user.id }, data: { weightKg: weight } });
  const recentWeights = await prisma.weightLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 7 });
  const movingAvg = (recentWeights.reduce((a, w) => a + w.weightKg, 0) / recentWeights.length).toFixed(1);
  const targetWeight = user.targetWeightKg || 70;
  const remaining = (targetWeight - weight).toFixed(1);
  bot.sendMessage(chatId, `✅ *Weight logged: ${weight}kg*\n\n📊 7-day avg: ${movingAvg}kg\n🎯 ${remaining}kg to go (target: ${targetWeight}kg)\n\nTarget protein: ${user.dailyProteinTarget || 140}g today.`, { parse_mode: 'Markdown' });
}

async function handleWorkout(msg, match) {
  const chatId = msg.chat.id;
  const parts = match[1].split(' ');
  const type = parts[0] || 'general';
  const duration = parseInt(parts[1]) || 60;
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const lastWorkout = await prisma.workoutLog.findFirst({ where: { userId: user.id, type: type.toLowerCase() }, orderBy: { loggedAt: 'desc' }, select: SAFE_WORKOUT_SELECT });
  await prisma.workoutLog.create({ data: { userId: user.id, type: type.toLowerCase(), exercises: [], durationMin: duration } });
  await prisma.habitLog.upsert({ where: { userId_date: { userId: user.id, date: today() } }, update: { gym: true }, create: { userId: user.id, date: today(), gym: true } });
  let response = `💪 *${type.toUpperCase()} workout logged!*\n⏱ Duration: ${duration} mins\n`;
  if (lastWorkout) { const days = Math.floor((Date.now() - new Date(lastWorkout.loggedAt).getTime()) / (1000 * 60 * 60 * 24)); response += `\nLast ${type} was ${days} day(s) ago.\n`; }
  response += `\n🥛 Post-workout: eat ${Math.round((user.dailyProteinTarget || 140) * 0.3)}g protein within 30 min!`;
  bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
}

async function handleSleep(msg, match) {
  const chatId = msg.chat.id;
  const parts = match[1].split(' ');
  if (!parts[0] || !parts[1]) return bot.sendMessage(chatId, 'Usage: /sleep 23:00 07:00');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const [bH, bM] = parts[0].split(':').map(Number);
  const [wH, wM] = parts[1].split(':').map(Number);
  const bed = new Date(); bed.setHours(bH, bM, 0, 0);
  const wake = new Date(); wake.setHours(wH, wM, 0, 0);
  if (wake < bed) wake.setDate(wake.getDate() + 1);
  const duration = (wake.getTime() - bed.getTime()) / (1000 * 60 * 60);
  await prisma.sleepLog.create({ data: { userId: user.id, bedtime: bed, wakeupTime: wake, durationHours: duration, qualityScore: duration >= 7 ? 8 : 5 } });
  const recentSleep = await prisma.sleepLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 3 });
  const avgRecent = recentSleep.reduce((a, s) => a + s.durationHours, 0) / recentSleep.length;
  const emoji = duration >= 8 ? '😴✨' : duration >= 7 ? '😴' : '😐';
  let response = `${emoji} *Sleep logged!*\n🛏 Bed: ${parts[0]}\n⏰ Wake: ${parts[1]}\n⏱ Duration: ${duration.toFixed(1)}hrs\n\n`;
  if (duration < 6) response += `⚠️ CRITICAL: ${duration.toFixed(1)} hours is too little. Consider reducing workout intensity today.`;
  else if (duration < 7) response += `⚠️ Slightly short. Aim for 7-8 hours tonight.`;
  else response += `✅ Good sleep! Your muscles are repairing well.`;
  if (avgRecent < 6.5 && recentSleep.length >= 3) response += `\n\n🚨 Pattern: You've averaged ${avgRecent.toFixed(1)}hrs over 3 nights. Set a 10:30pm sleep alarm!`;
  bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
}

async function handleStudy(msg, match) {
  const chatId = msg.chat.id;
  const parts = match[1].split(' ');
  const topic = parts[0] || 'General';
  const duration = parseInt(parts[1]) || 30;
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  await prisma.studyLog.create({ data: { userId: user.id, topic, subtopics: [], durationMin: duration } });
  await memory.updateCareerMemory(user.id, { topic, durationMin: duration });
  await prisma.habitLog.upsert({ where: { userId_date: { userId: user.id, date: today() } }, update: { study: true }, create: { userId: user.id, date: today(), study: true } });
  const topicLogs = await prisma.studyLog.findMany({ where: { userId: user.id, topic } });
  const totalHrs = Math.round(topicLogs.reduce((a, l) => a + l.durationMin, 0) / 60 * 10) / 10;
  bot.sendMessage(chatId, `📚 *Study session logged!*\n📖 Topic: ${topic}\n⏱ Today: ${duration} mins\n📊 Total on ${topic}: ${totalHrs}hrs\n\nKeep going 🚀`, { parse_mode: 'Markdown' });
}

async function handleEnglish(msg, match) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔍 Checking your English...');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const result = await ai.correctEnglish(match[1], user.id);
  let response = `📝 English Correction\n\nOriginal: ${match[1]}\nCorrected: ${result.correctedText}\n`;
  if (result.betterVersion && result.betterVersion !== result.correctedText) response += `Better: ${result.betterVersion}\n`;
  response += '\n';
  if (result.mistakes?.length > 0) {
    response += `Mistakes (${result.mistakes.length}):\n`;
    result.mistakes.slice(0, 3).forEach((m, i) => { response += `${i + 1}. "${m.original}" → "${m.corrected}"\n   ${m.explanation}\n`; if (m.memoryTrick) response += `   💡 Trick: ${m.memoryTrick}\n`; });
  } else { response += `✅ No major mistakes!\n`; }
  response += `\nScore: ${result.grammarScore}/100\n${result.encouragement || ''}`;
  if (result.confidenceTip) response += `\n\n💪 ${result.confidenceTip}`;
  await prisma.habitLog.upsert({ where: { userId_date: { userId: user.id, date: today() } }, update: { english: true }, create: { userId: user.id, date: today(), english: true } });
  bot.sendMessage(chatId, response);
}

async function handleKannada(msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📚 Getting your Kannada lesson...');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const lesson = await ai.getKannadaLesson(user.id);
  let text = `🇮🇳 Kannada Lesson — Day ${lesson.dayNumber || '?'}\nTheme: ${lesson.theme || "Today's lesson"}\n\n`;
  if (lesson.intro) text += `${lesson.intro}\n\n`;
  if (lesson.words?.length) { text += `Today's Words:\n`; lesson.words.slice(0, 5).forEach(w => { text += `• ${w.kannada} (${w.pronunciation}) = ${w.meaning}\n`; }); text += '\n'; }
  if (lesson.todayChallenge) text += `🎯 Today's Challenge:\n${lesson.todayChallenge}\n\n`;
  if (lesson.encouragement) text += `💙 ${lesson.encouragement}`;
  await prisma.habitLog.upsert({ where: { userId_date: { userId: user.id, date: today() } }, update: { kannada: true }, create: { userId: user.id, date: today(), kannada: true } });
  bot.sendMessage(chatId, text);
}

async function handleProfile(msg) {
  const chatId = msg.chat.id;
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found. Send /start first.');

  // Fetch extended profile + recent stats in parallel
  const [fullUser, lifeScore, streaks, sleepScore, careerStats] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }).catch(() => user),
    prisma.lifeScore.findFirst({ where: { userId: user.id }, orderBy: { date: 'desc' } }).catch(() => null),
    prisma.habitLog.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 30 }).catch(() => []),
    prisma.sleepLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 7 }).catch(() => []),
    prisma.studyLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 30 }).catch(() => []),
  ]);

  const u = fullUser || user;

  // If name is a stale Clerk ID or missing, use Telegram's display name and patch DB
  const tgName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ');
  const nameIsStale = !u.name || u.name.startsWith('user_') || u.name === u.email?.split('@')[0];
  if (nameIsStale && tgName) {
    u.name = tgName;
    prisma.user.update({ where: { id: u.id }, data: { name: tgName } }).catch(() => {});
  }

  // Calculate streaks
  let gymStreak = 0, studyStreak = 0;
  for (const l of streaks) { if (l.gym) gymStreak++; else break; }
  for (const l of streaks) { if (l.study) studyStreak++; else break; }

  // Sleep avg
  const avgSleep = sleepScore.length
    ? (sleepScore.reduce((a, l) => a + l.durationHours, 0) / sleepScore.length).toFixed(1)
    : '—';

  // Study hours this week
  const weekStudy = careerStats
    .filter(l => new Date(l.loggedAt) > new Date(Date.now() - 7 * 86400000))
    .reduce((a, l) => a + l.durationMin, 0);

  const goalMap = { lean_bulk: 'Lean Bulk 📈', cut: 'Cut 📉', maintain: 'Maintain ⚖️' };
  const careerGoalMap = { devops: 'DevOps/Cloud', data_engineering: 'Data Engineering', frontend: 'Frontend', backend: 'Backend', ai_ml: 'AI/ML', custom: u.careerGoalCustom || 'Custom' };
  const langGoals = (u.languageGoals || []).join(', ').toUpperCase() || 'None';

  const text = `👤 *${u.name || 'Your Profile'}*

*🏋️ Fitness*
├ Weight: ${u.weightKg || '?'}kg → Target: ${u.targetWeightKg || '?'}kg
├ Goal: ${goalMap[u.primaryGoal] || u.primaryGoal || 'Lean Bulk'}
├ Gym days/week: ${u.gymDaysPerWeek || 4}
└ Level: ${u.fitnessLevel || 'intermediate'}

*💤 Sleep*
├ 7-day avg: ${avgSleep} hrs
└ Target: 8 hrs/night

*📚 Career*
├ Goal: ${careerGoalMap[u.careerGoal] || 'DevOps/Cloud'}
└ Study this week: ${Math.round(weekStudy / 60)} hrs ${weekStudy === 0 ? '⚠️ Not started' : '✅'}

*🌐 Languages*
└ Tracking: ${langGoals}

*🔥 Current Streaks*
├ Gym: ${gymStreak} days
└ Study: ${studyStreak} days

*🎯 Life Score*
└ ${lifeScore ? `${lifeScore.overall}/100 (Fit:${lifeScore.fitness} Sleep:${lifeScore.sleep} Disc:${lifeScore.discipline} Career:${lifeScore.career})` : 'Not calculated yet — visit dashboard'}

_Joined: ${new Date(u.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}_`;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleReport(msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📊 Generating your weekly report... (this takes 30 seconds)');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const report = await ai.generateWeeklyReport(user.id);
  const formatted = fmt(report);
  const chunks = formatted.match(/.{1,4000}/gs) || [formatted];
  for (const chunk of chunks) await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
}

async function handlePlan(msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🗓 Building your daily plan...');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const plan = await ai.generateDailyPlan(user.id);
  const text = `📋 *Today's Plan*\n\n${fmt(plan)}`;
  const chunks = text.match(/.{1,4000}/gs) || [text];
  for (const chunk of chunks) await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
}

async function handleProactiveNudge(msg) {
  const chatId = msg.chat.id;
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  bot.sendMessage(chatId, '🔍 Analyzing your patterns...');
  const insights = await ai.generateProactiveInsights(user.id);
  let text = `🧠 *AI Pattern Analysis*\n\n`;
  if (insights.insights?.length) {
    insights.insights.forEach(i => {
      const emoji = i.priority === 'high' ? '🔴' : i.priority === 'medium' ? '🟡' : '🟢';
      text += `${emoji} *${(i.category || 'INSIGHT').toUpperCase()}*\n${i.message}\n`;
      if (i.action) text += `→ _${i.action}_\n`;
      text += '\n';
    });
  } else { text += 'Keep logging data for a few days to see pattern analysis!\n'; }
  if (insights.weekPattern) text += `📈 ${fmt(insights.weekPattern)}\n`;
  if (insights.topPriority) text += `\n⭐ *Today's top priority:* ${insights.topPriority}`;
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleCoach(msg, match) {
  const chatId = msg.chat.id;
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const response = await ai.chat(user.id, match[1]);
  bot.sendMessage(chatId, fmt(response), { parse_mode: 'Markdown' });
}

async function handleFreeChat(msg) {
  const chatId = msg.chat.id; activeChatIds.add(chatId);
  const user = await getUser(msg.from?.id);
  if (!user) return;
  const response = await ai.chat(user.id, msg.text);
  bot.sendMessage(chatId, fmt(response), { parse_mode: 'Markdown' });
}

async function handleWater(msg, match) {
  const chatId = msg.chat.id; activeChatIds.add(chatId);
  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, 'Invalid amount. Example: /water 0.5');
  const user = await getUser(msg.from?.id);
  if (!user) return bot.sendMessage(chatId, 'User not found.');
  const t = today(); const tomorrow = new Date(t); tomorrow.setDate(tomorrow.getDate() + 1);
  const existing = await prisma.dietLog.findFirst({ where: { userId: user.id, loggedAt: { gte: t, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } });
  const prevLiters = existing?.waterLitres ?? 0;
  const total = Math.min(WATER_GOAL, prevLiters + amount);
  if (existing) await prisma.dietLog.update({ where: { id: existing.id }, data: { waterLitres: total } });
  else await prisma.dietLog.create({ data: { userId: user.id, meals: [], totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatsG: 0, waterLitres: total } });
  waterTracker.set(chatId, { liters: total, date: new Date().toDateString() });
  const remaining = Math.max(0, WATER_GOAL - total);
  const percent = Math.round((total / WATER_GOAL) * 100);
  const bar = '💧'.repeat(Math.round(percent / 20)) + '○'.repeat(5 - Math.round(percent / 20));
  if (total >= WATER_GOAL) bot.sendMessage(chatId, `💧 *+${amount}L logged!*\n\n🎉 *GOAL ACHIEVED!* ${total.toFixed(1)}L today!\n${bar} 100%`, { parse_mode: 'Markdown' });
  else bot.sendMessage(chatId, `💧 *+${amount}L logged!*\n\n${bar} ${percent}%\n📊 Total: ${total.toFixed(1)}L / ${WATER_GOAL}L\n💧 Need: ${remaining.toFixed(1)}L more`, { parse_mode: 'Markdown' });
}

async function sendMorningCheckins() {
  if (!bot) return;
  const users = await prisma.user.findMany({ select: { id: true, name: true, telegramChatId: true } }).catch(() => []);
  for (const user of users) {
    const chatId = parseInt(user.telegramChatId || '');
    if (!chatId) continue;
    try {
      const checkin = await ai.generateMorningCheckin(user.id);
      let text = `${checkin.greeting || `☀️ Good morning ${user.name?.split(' ')[0]}!`}\n\n`;
      if (checkin.yesterdaySummary) { const s = checkin.yesterdaySummary; if (s.wins?.length) text += `✅ Yesterday's win: ${s.wins[0]}\n`; if (s.miss) text += `⚠️ Missed: ${s.miss}\n\n`; }
      if (checkin.todayPriorities) { text += `*Today's 3 priorities:*\n`; checkin.todayPriorities.forEach((p, i) => { text += `${i + 1}. ${p}\n`; }); }
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch {}
  }
}

async function sendEveningNudges() {
  if (!bot) return;
  await loadActiveChatIds();
  const users = await prisma.user.findMany({ select: { id: true, name: true, telegramChatId: true } }).catch(() => []);
  for (const user of users) {
    const chatId = parseInt(user.telegramChatId || '');
    if (!chatId) continue;
    try {
      const t = today(); const tomorrow = new Date(t); tomorrow.setDate(tomorrow.getDate() + 1);
      const [todayHabit, todayDiet, recentWorkout] = await Promise.all([
        prisma.habitLog.findUnique({ where: { userId_date: { userId: user.id, date: t } } }),
        prisma.dietLog.findFirst({ where: { userId: user.id, loggedAt: { gte: t, lt: tomorrow } }, select: SAFE_DIET_SELECT }),
        prisma.workoutLog.findFirst({ where: { userId: user.id, loggedAt: { gte: t, lt: tomorrow } }, select: SAFE_WORKOUT_SELECT }),
      ]);
      const nudges = [];
      if (!recentWorkout && !todayHabit?.gym) nudges.push(`💪 No gym today yet — is there still time? Even a 30-min session counts!`);
      const proteinTarget = user.dailyProteinTarget || 140;
      if (todayDiet && todayDiet.totalProteinG < proteinTarget * 0.7) nudges.push(`🥩 Protein: ${Math.round(todayDiet.totalProteinG)}g logged, need ${Math.round(proteinTarget - todayDiet.totalProteinG)}g more.`);
      else if (!todayDiet) nudges.push(`📊 Haven't logged diet today.`);
      if (!todayHabit?.english) nudges.push(`📝 Haven't practiced English today. Quick: /english [any sentence]`);
      if (nudges.length > 0) await bot.sendMessage(chatId, `⏰ *Evening Check*\n\n${nudges.join('\n\n')}`, { parse_mode: 'Markdown' });
    } catch {}
  }
}

async function sendWeeklyPlanning() {
  if (!bot) return;
  const users = await prisma.user.findMany({ select: { id: true, name: true, telegramChatId: true } }).catch(() => []);
  for (const user of users) {
    const chatId = parseInt(user.telegramChatId || '');
    if (!chatId) continue;
    try {
      const report = await ai.generateWeeklyReport(user.id);
      await bot.sendMessage(chatId, `📅 *Sunday Weekly Review*\n\n${report.slice(0, 2000)}\n\n...\n\nFull report at /report`, { parse_mode: 'Markdown' });
    } catch {}
  }
}

async function sendWaterReminders() {
  if (!bot) return;
  const hour = new Date().getHours();
  if (hour < 7 || hour >= 23) return;
  await loadActiveChatIds();
  if (activeChatIds.size === 0) return;
  const t = today(); const tomorrow = new Date(t); tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = new Date().toDateString();
  for (const chatId of activeChatIds) {
    try {
      const tracker = waterTracker.get(chatId);
      let liters = tracker?.date === todayStr ? tracker.liters : 0;
      if (!tracker || tracker.date !== todayStr) {
        const user = await getUser(chatId);
        if (user) {
          const dietLog = await prisma.dietLog.findFirst({ where: { userId: user.id, loggedAt: { gte: t, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } });
          liters = dietLog?.waterLitres ?? 0;
          waterTracker.set(chatId, { liters, date: todayStr });
        }
      }
      if (liters >= WATER_GOAL) continue;
      const remaining = WATER_GOAL - liters;
      const percent = Math.round((liters / WATER_GOAL) * 100);
      const bar = '💧'.repeat(Math.round(percent / 20)) + '○'.repeat(5 - Math.round(percent / 20));
      await bot.sendMessage(chatId, `⏰ *Water Reminder!*\n\n${bar} ${percent}%\n📊 Today: ${liters.toFixed(1)}L / ${WATER_GOAL}L\n💧 Need: ${remaining.toFixed(1)}L more\n\nDrink a glass now! /water 0.25`, { parse_mode: 'Markdown' });
    } catch {}
  }
}

function processWebhook(body) {
  // Only used in production webhook mode; polling handles updates automatically
  if (bot && process.env.NODE_ENV === 'production') bot.processUpdate(body);
}

module.exports = { init, processWebhook, sendMorningCheckins, sendEveningNudges, sendWeeklyPlanning, sendWaterReminders };
