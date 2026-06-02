import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MemoryService } from '../ai/memory/memory.service';
import { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } from '../prisma/prisma-safe-select';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;
  private activeChatIds = new Set<number>();
  private waterTracker = new Map<number, { liters: number; date: string }>();
  private readonly WATER_GOAL = 4;

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private memoryService: MemoryService,
  ) {}

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.log('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled');
      return;
    }

    this.bot = new TelegramBot(token, { polling: false });

    try {
      await this.bot.getMe();
      await this.bot.startPolling();
      this.registerCommands();
      console.log('Telegram bot started');
    } catch (e) {
      console.log('Telegram bot token invalid — bot disabled');
      this.bot = null;
    }
  }

  private registerCommands() {
    this.bot.setMyCommands([
      { command: 'start', description: 'Start LIFEOS bot' },
      { command: 'checkin', description: 'Morning check-in — rate yesterday, set today goals' },
      { command: 'weight', description: 'Log your weight (e.g. /weight 63.5)' },
      { command: 'workout', description: 'Log a workout (e.g. /workout push 60)' },
      { command: 'sleep', description: 'Log sleep (e.g. /sleep 23:00 07:00)' },
      { command: 'study', description: 'Log study session (e.g. /study Docker 45)' },
      { command: 'english', description: 'Correct my English (e.g. /english I go yesterday)' },
      { command: 'kannada', description: 'Get today\'s Kannada lesson' },
      { command: 'water', description: 'Log water intake (e.g. /water 0.5)' },
      { command: 'report', description: 'Weekly life report with analysis' },
      { command: 'plan', description: 'Today\'s personalized plan' },
      { command: 'nudge', description: 'Get proactive insights about your patterns' },
      { command: 'coach', description: 'Chat with AI coach' },
    ]);

    const safe = (fn: (...args: any[]) => Promise<any>) =>
      async (...args: any[]) => {
        try { await fn(...args); } catch (e) {
          const chatId = args[0]?.chat?.id;
          const errMsg = e?.message || String(e) || 'Unknown error';
          console.error('Bot handler error:', errMsg);
          if (chatId) {
            this.bot.sendMessage(chatId, `⚠️ Error: ${errMsg.slice(0, 200)}`).catch(() => {});
          }
        }
      };

    this.bot.onText(/\/start/, safe((msg) => this.handleStart(msg)));
    this.bot.onText(/\/checkin/, safe((msg) => this.handleMorningCheckin(msg)));
    this.bot.onText(/\/weight (.+)/, safe((msg, match) => this.handleWeight(msg, match)));
    this.bot.onText(/\/weight$/, (msg) => this.bot.sendMessage(msg.chat.id, 'Usage: /weight 63.5'));
    this.bot.onText(/\/workout (.+)/, safe((msg, match) => this.handleWorkout(msg, match)));
    this.bot.onText(/\/sleep (.+)/, safe((msg, match) => this.handleSleep(msg, match)));
    this.bot.onText(/\/study (.+)/, safe((msg, match) => this.handleStudy(msg, match)));
    this.bot.onText(/\/english (.+)/, safe((msg, match) => this.handleEnglish(msg, match)));
    this.bot.onText(/\/kannada/, safe((msg) => this.handleKannada(msg)));
    this.bot.onText(/\/report/, safe((msg) => this.handleReport(msg)));
    this.bot.onText(/\/plan/, safe((msg) => this.handlePlan(msg)));
    this.bot.onText(/\/nudge/, safe((msg) => this.handleProactiveNudge(msg)));
    this.bot.onText(/\/coach (.+)/, safe((msg, match) => this.handleCoach(msg, match)));
    this.bot.onText(/\/water (.+)/, safe((msg, match) => this.handleWater(msg, match)));
    this.bot.onText(/\/water$/, (msg) => this.bot.sendMessage(msg.chat.id, 'Usage: /water 0.5 (liters)'));

    this.bot.on('message', (msg) => {
      if (!msg.text?.startsWith('/')) {
        this.handleFreeChat(msg).catch((e) => console.error('FreeChat error:', e?.message));
      }
    });
  }

  // Only select columns guaranteed to exist in the original schema
  private readonly USER_SELECT = {
    id: true, name: true, email: true,
    weightKg: true, targetWeightKg: true,
    heightCm: true, age: true, profession: true,
    createdAt: true,
  };

  private async getUser(telegramId?: number) {
    try {
      // Try new telegramChatId field (only exists after migration)
      if (telegramId) {
        try {
          const byTelegram = await (this.prisma.user.findFirst as any)({
            where: { telegramChatId: String(telegramId) },
            select: this.USER_SELECT,
          });
          if (byTelegram) return byTelegram;
        } catch {}
      }
      // Fall back to first user — select only safe columns
      return this.prisma.user.findFirst({ select: this.USER_SELECT });
    } catch (e) {
      console.error('getUser error:', e?.message);
      return null;
    }
  }

  private async handleStart(msg: TelegramBot.Message) {
    this.activeChatIds.add(msg.chat.id);

    // Try to save telegram chat ID (silent fail if column not migrated yet)
    this.getUser(msg.from?.id).then((user) => {
      if (user) {
        (this.prisma.user.update as any)({
          where: { id: user.id },
          data: { telegramChatId: String(msg.chat.id) },
        }).catch(() => {});
      }
    }).catch(() => {});

    const text = `🚀 *LIFEOS AI Coach — Your Life OS*

Welcome back! I'm your personal life coach.

*Daily Commands:*
/checkin — Morning check-in (start your day right)
/weight 63.5 — log weight
/workout push 60 — log workout (type + mins)
/sleep 23:00 07:00 — log sleep
/study Docker 45 — log study
/english I go yesterday — correct grammar
/kannada — today's lesson
/water 0.5 — log water

*Analysis:*
/report — weekly life report
/plan — today's full plan
/nudge — AI-detected patterns about YOU
/coach [question] — chat with coach

💡 *Pro tip:* Use /checkin every morning — I'll analyze yesterday and set your 3 priorities for today!
💧 I remind you hourly until you hit 4L water!`;

    this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }

  private async handleMorningCheckin(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    this.activeChatIds.add(chatId);

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found. Log in at the web app first.');

    this.bot.sendMessage(chatId, '☀️ Generating your morning check-in...');

    const checkin = await this.aiService.generateMorningCheckin(user.id);

    // Plain text — AI content may have unescaped Markdown characters
    let text = `${checkin.greeting || '☀️ Good morning!'}\n\n`;

    if (checkin.yesterdaySummary) {
      const s = checkin.yesterdaySummary;
      text += `Yesterday:\n`;
      if (s.wins?.length) text += `✅ ${s.wins[0]}\n`;
      if (s.miss) text += `⚠️ ${s.miss}\n`;
      text += '\n';
    }

    if (checkin.todayPriorities) {
      text += `Today's 3 Priorities:\n`;
      checkin.todayPriorities.forEach((p: string, i: number) => {
        text += `${i + 1}. ${p}\n`;
      });
      text += '\n';
    }

    if (checkin.insight) {
      text += `💡 ${checkin.insight}\n\n`;
    }

    if (checkin.motivationalNote) {
      text += `🔥 ${checkin.motivationalNote}`;
    }

    // Save morning checkin (graceful — model may not exist yet)
    const today = this.today();
    const prismaAny = this.prisma as any;
    if (prismaAny.morningCheckin) {
      await prismaAny.morningCheckin.upsert({
        where: { userId_date: { userId: user.id, date: today } },
        update: { completedVia: 'telegram' },
        create: { userId: user.id, date: today, completedVia: 'telegram' },
      }).catch(() => {});
    }

    this.bot.sendMessage(chatId, text);
  }

  private async handleProactiveNudge(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    this.bot.sendMessage(chatId, '🔍 Analyzing your patterns...');

    const insights = await this.aiService.generateProactiveInsights(user.id);

    // Plain text — AI content has unescaped chars that break Markdown
    let text = `🧠 AI Pattern Analysis for ${user.name?.split(' ')[0] || 'you'}\n\n`;

    if (insights.insights?.length) {
      insights.insights.forEach((i: any) => {
        const emoji = i.priority === 'high' ? '🔴' : i.priority === 'medium' ? '🟡' : '🟢';
        text += `${emoji} ${i.category?.toUpperCase() || 'INSIGHT'}\n`;
        text += `${i.message}\n`;
        if (i.action) text += `→ ${i.action}\n`;
        text += '\n';
      });
    } else {
      text += 'Keep logging data for a few days to see pattern analysis!\n';
    }

    if (insights.topPriority) {
      text += `\n⭐ Today's top priority: ${insights.topPriority}`;
    }

    this.bot.sendMessage(chatId, text);
  }

  private async handleWeight(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    const weight = parseFloat(match[1]);
    if (isNaN(weight)) return this.bot.sendMessage(chatId, 'Invalid weight. Use: /weight 63.5');

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found. Please log in at the web app first.');

    await this.prisma.weightLog.create({ data: { userId: user.id, weightKg: weight } });
    await this.prisma.user.update({ where: { id: user.id }, data: { weightKg: weight } });

    // Calculate 7-day moving average
    const recentWeights = await this.prisma.weightLog.findMany({
      where: { userId: user.id },
      orderBy: { loggedAt: 'desc' },
      take: 7,
    });
    const movingAvg = recentWeights.length
      ? (recentWeights.reduce((a, w) => a + w.weightKg, 0) / recentWeights.length).toFixed(1)
      : weight.toFixed(1);

    const startWeight = 62;
    const targetWeight = user.targetWeightKg || 70;
    const progress = weight - startWeight;
    const remaining = targetWeight - weight;
    const percent = Math.min(100, Math.round((Math.max(0, progress) / (targetWeight - startWeight)) * 100));

    this.bot.sendMessage(chatId,
      `✅ *Weight logged: ${weight}kg*\n\n📊 7-day avg: ${movingAvg}kg\n📈 Progress: ${progress > 0 ? '+' : ''}${progress.toFixed(1)}kg from ${startWeight}kg\n🎯 ${remaining.toFixed(1)}kg to go (${percent}% there)\n\nTarget protein: ${(user as any).dailyProteinTarget || 140}g today.`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleWorkout(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    const parts = match[1].split(' ');
    const type = parts[0] || 'general';
    const duration = parseInt(parts[1]) || 60;

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    // Check last workout of this type for progressive overload reminder
    const lastWorkout = await this.prisma.workoutLog.findFirst({
      where: { userId: user.id, type: type.toLowerCase() },
      orderBy: { loggedAt: 'desc' },
      select: SAFE_WORKOUT_SELECT,
    });

    await this.prisma.workoutLog.create({
      data: { userId: user.id, type: type.toLowerCase(), exercises: [], durationMin: duration },
    });

    await this.prisma.habitLog.upsert({
      where: { userId_date: { userId: user.id, date: this.today() } },
      update: { gym: true },
      create: { userId: user.id, date: this.today(), gym: true },
    });

    let response = `💪 *${type.toUpperCase()} workout logged!*\n⏱ Duration: ${duration} mins\n\n`;

    if (lastWorkout) {
      const daysSinceLast = Math.floor((Date.now() - new Date(lastWorkout.loggedAt).getTime()) / (1000 * 60 * 60 * 24));
      response += `Last ${type} was ${daysSinceLast} day(s) ago.\n`;
    }

    response += `\n🥛 Post-workout: eat ${(user as any).dailyProteinTarget ? Math.round((user as any).dailyProteinTarget * 0.3) : 40}g protein within 30 min!`;

    this.bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  }

  private async handleSleep(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    const parts = match[1].split(' ');
    const bedStr = parts[0];
    const wakeStr = parts[1];

    if (!bedStr || !wakeStr) {
      return this.bot.sendMessage(chatId, 'Usage: /sleep 23:00 07:00');
    }

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    const today = new Date();
    const [bH, bM] = bedStr.split(':').map(Number);
    const [wH, wM] = wakeStr.split(':').map(Number);

    const bed = new Date(today);
    bed.setHours(bH, bM, 0, 0);
    const wake = new Date(today);
    wake.setHours(wH, wM, 0, 0);
    if (wake < bed) wake.setDate(wake.getDate() + 1);

    const duration = (wake.getTime() - bed.getTime()) / (1000 * 60 * 60);

    await this.prisma.sleepLog.create({
      data: { userId: user.id, bedtime: bed, wakeupTime: wake, durationHours: duration, qualityScore: duration >= 7 ? 8 : 5 },
    });

    // Check sleep trend
    const recentSleep = await this.prisma.sleepLog.findMany({
      where: { userId: user.id },
      orderBy: { loggedAt: 'desc' },
      take: 3,
    });
    const avgRecent = recentSleep.reduce((a, s) => a + s.durationHours, 0) / recentSleep.length;

    const emoji = duration >= 8 ? '😴✨' : duration >= 7 ? '😴' : '😐';
    let response = `${emoji} *Sleep logged!*\n🛏 Bed: ${bedStr}\n⏰ Wake: ${wakeStr}\n⏱ Duration: ${duration.toFixed(1)}hrs\n\n`;

    if (duration < 6) {
      response += `⚠️ CRITICAL: ${duration.toFixed(1)} hours is too little. Muscle repair needs 7-8 hours.\nConsider reducing workout intensity today.`;
    } else if (duration < 7) {
      response += `⚠️ Slightly short. Aim for 7-8 hours tonight.`;
    } else {
      response += `✅ Good sleep! Your muscles are repairing well.`;
    }

    if (avgRecent < 6.5 && recentSleep.length >= 3) {
      response += `\n\n🚨 Pattern: You've averaged ${avgRecent.toFixed(1)}hrs over 3 nights. Set a 10:30pm sleep alarm!`;
    }

    this.bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  }

  private async handleStudy(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    const parts = match[1].split(' ');
    const topic = parts[0] || 'General';
    const duration = parseInt(parts[1]) || 30;

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    await this.prisma.studyLog.create({
      data: { userId: user.id, topic, subtopics: [], durationMin: duration },
    });
    await this.memoryService.updateCareerMemory(user.id, { topic, durationMin: duration });

    await this.prisma.habitLog.upsert({
      where: { userId_date: { userId: user.id, date: this.today() } },
      update: { study: true },
      create: { userId: user.id, date: this.today(), study: true },
    });

    // Calculate total study hours for this topic
    const topicLogs = await this.prisma.studyLog.findMany({
      where: { userId: user.id, topic },
    });
    const totalTopicMins = topicLogs.reduce((a, l) => a + l.durationMin, 0);
    const totalHrs = Math.round(totalTopicMins / 60 * 10) / 10;

    this.bot.sendMessage(chatId,
      `📚 *Study session logged!*\n📖 Topic: ${topic}\n⏱ Today: ${duration} mins\n📊 Total on ${topic}: ${totalHrs}hrs\n\nAt ${duration} min/day, you'll master the current topic soon! Keep going 🚀`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleEnglish(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    const text = match[1];

    this.bot.sendMessage(chatId, '🔍 Checking your English...');

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    const result = await this.aiService.correctEnglish(text);

    let response = `📝 *English Correction*\n\n`;
    response += `*Original:* ${text}\n`;
    response += `*Corrected:* ${result.correctedText}\n`;

    if (result.betterVersion && result.betterVersion !== result.correctedText) {
      response += `*Better way to say it:* ${result.betterVersion}\n`;
    }

    response += '\n';

    if (result.mistakes?.length > 0) {
      response += `Mistakes (${result.mistakes.length}):\n`;
      result.mistakes.slice(0, 3).forEach((m: any, i: number) => {
        response += `${i + 1}. "${m.original}" → "${m.corrected}"\n`;
        response += `   ${m.explanation}\n`;
        if (m.memoryTrick) response += `   💡 Trick: ${m.memoryTrick}\n`;
      });
    } else {
      response += `✅ No major mistakes!\n`;
    }

    response += `\nScore: ${result.grammarScore}/100\n${result.encouragement || ''}`;

    if (result.confidenceTip) {
      response += `\n\n💪 ${result.confidenceTip}`;
    }

    await this.prisma.habitLog.upsert({
      where: { userId_date: { userId: user.id, date: this.today() } },
      update: { english: true },
      create: { userId: user.id, date: this.today(), english: true },
    });

    // No parse_mode — AI text may contain unescaped Markdown chars
    this.bot.sendMessage(chatId, response);
  }

  private async handleKannada(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    this.bot.sendMessage(chatId, '📚 Getting your Kannada lesson...');

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found. Please log in at the web app first.');

    const lesson = await this.aiService.getKannadaLesson(user.id);

    // Use plain text — Kannada Unicode characters break Telegram Markdown parser
    let text = `🇮🇳 Kannada Lesson — Day ${lesson.dayNumber || '?'}\n`;
    text += `Theme: ${lesson.theme || 'Today\'s lesson'}\n\n`;

    if (lesson.intro) text += `${lesson.intro}\n\n`;

    if (lesson.words?.length) {
      text += `Today's Words:\n`;
      lesson.words.slice(0, 5).forEach((w: any) => {
        text += `• ${w.kannada} (${w.pronunciation}) = ${w.meaning}\n`;
      });
      text += '\n';
    }

    if (lesson.todayChallenge) {
      text += `🎯 Today's Challenge:\n${lesson.todayChallenge}\n\n`;
    }

    if (lesson.encouragement) {
      text += `💙 ${lesson.encouragement}`;
    }

    await this.prisma.habitLog.upsert({
      where: { userId_date: { userId: user.id, date: this.today() } },
      update: { kannada: true },
      create: { userId: user.id, date: this.today(), kannada: true },
    });

    // No parse_mode — Kannada script breaks Telegram Markdown
    this.bot.sendMessage(chatId, text);
  }

  private async handleReport(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    this.bot.sendMessage(chatId, '📊 Generating your weekly report... (this takes 30 seconds)');

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    const report = await this.aiService.generateWeeklyReport(user.id);
    const chunks = report.match(/.{1,4000}/gs) || [report];
    for (const chunk of chunks) {
      await this.bot.sendMessage(chatId, chunk);
    }
  }

  private async handlePlan(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    this.bot.sendMessage(chatId, '🗓 Building your daily plan...');

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    const plan = await this.aiService.generateDailyPlan(user.id);
    this.bot.sendMessage(chatId, `📋 *Today's Plan*\n\n${plan}`, { parse_mode: 'Markdown' });
  }

  private async handleCoach(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    const question = match[1];

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    const response = await this.aiService.chat(user.id, question);
    this.bot.sendMessage(chatId, response);
  }

  private async handleFreeChat(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    this.activeChatIds.add(chatId);
    const user = await this.getUser(msg.from?.id);
    if (!user) return;

    const response = await this.aiService.chat(user.id, msg.text);
    this.bot.sendMessage(chatId, response);
  }

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async handleWater(msg: TelegramBot.Message, match: RegExpExecArray) {
    const chatId = msg.chat.id;
    this.activeChatIds.add(chatId);
    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) {
      return this.bot.sendMessage(chatId, 'Invalid amount. Example: /water 0.5');
    }

    const user = await this.getUser(msg.from?.id);
    if (!user) return this.bot.sendMessage(chatId, 'User not found.');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const existing = await this.prisma.dietLog.findFirst({
      where: { userId: user.id, loggedAt: { gte: today, lt: tomorrow } },
      orderBy: { loggedAt: 'desc' },
    });
    const prevLiters = existing?.waterLitres ?? 0;
    const total = Math.min(this.WATER_GOAL, prevLiters + amount);

    if (existing) {
      await this.prisma.dietLog.update({ where: { id: existing.id }, data: { waterLitres: total } });
    } else {
      await this.prisma.dietLog.create({
        data: { userId: user.id, meals: [], totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatsG: 0, waterLitres: total },
      });
    }

    const todayStr = new Date().toDateString();
    this.waterTracker.set(chatId, { liters: total, date: todayStr });

    const remaining = Math.max(0, this.WATER_GOAL - total);
    const percent = Math.round((total / this.WATER_GOAL) * 100);
    const filled = Math.round(percent / 20);
    const bar = '💧'.repeat(filled) + '○'.repeat(5 - filled);

    if (total >= this.WATER_GOAL) {
      this.bot.sendMessage(chatId,
        `💧 *+${amount}L logged!*\n\n🎉 *GOAL ACHIEVED!* ${total.toFixed(1)}L today!\n${bar} 100%\n\nExcellent hydration! No more reminders for today. 🏆`,
        { parse_mode: 'Markdown' });
    } else {
      this.bot.sendMessage(chatId,
        `💧 *+${amount}L logged!*\n\n${bar} ${percent}%\n📊 Total: ${total.toFixed(1)}L / ${this.WATER_GOAL}L\n💧 Need: ${remaining.toFixed(1)}L more`,
        { parse_mode: 'Markdown' });
    }
  }

  // Morning check-in cron: 7am daily
  @Cron('0 7 * * *')
  async sendMorningCheckins() {
    if (!this.bot || this.activeChatIds.size === 0) return;

    const users = await this.prisma.user.findMany({ select: { id: true, name: true } }).catch(() => []);

    for (const user of users) {
      const chatId = parseInt((user as any).telegramChatId || '');
      if (!chatId) continue;

      try {
        const checkin = await this.aiService.generateMorningCheckin(user.id);
        let text = `${checkin.greeting || `☀️ Good morning ${user.name?.split(' ')[0]}!`}\n\n`;

        if (checkin.yesterdaySummary) {
          const s = checkin.yesterdaySummary;
          if (s.wins?.length) text += `✅ Yesterday's win: ${s.wins[0]}\n`;
          if (s.miss) text += `⚠️ Missed: ${s.miss}\n\n`;
        }

        if (checkin.todayPriorities) {
          text += `*Today's 3 priorities:*\n`;
          checkin.todayPriorities.forEach((p: string, i: number) => {
            text += `${i + 1}. ${p}\n`;
          });
        }

        await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch {}
    }
  }

  // Proactive nudge cron: 8pm daily — checks if user hasn't done key habits
  @Cron('0 20 * * *')
  async sendEveningNudges() {
    if (!this.bot) return;

    const users = await this.prisma.user.findMany({ select: { id: true, name: true } }).catch(() => []);

    for (const user of users) {
      const chatId = parseInt((user as any).telegramChatId || '');
      if (!chatId) continue;

      try {
        const today = this.today();
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

        const [todayHabit, todayDiet, recentWorkout] = await Promise.all([
          this.prisma.habitLog.findUnique({ where: { userId_date: { userId: user.id, date: today } } }),
          this.prisma.dietLog.findFirst({ where: { userId: user.id, loggedAt: { gte: today, lt: tomorrow } }, select: SAFE_DIET_SELECT }),
          this.prisma.workoutLog.findFirst({ where: { userId: user.id, loggedAt: { gte: today, lt: tomorrow } }, select: SAFE_WORKOUT_SELECT }),
        ]);

        const nudges: string[] = [];

        if (!recentWorkout && !todayHabit?.gym) {
          nudges.push(`💪 No gym today yet — is there still time? Even a 30-min session counts!`);
        }

        const proteinTarget = (user as any).dailyProteinTarget || 140;
        if (todayDiet && todayDiet.totalProteinG < proteinTarget * 0.7) {
          const gap = Math.round(proteinTarget - todayDiet.totalProteinG);
          nudges.push(`🥩 Protein: ${Math.round(todayDiet.totalProteinG)}g logged, need ${gap}g more. Have curd + paneer before bed!`);
        } else if (!todayDiet) {
          nudges.push(`📊 Haven't logged diet today. Quick: /english or log water to keep the streak going!`);
        }

        if (!todayHabit?.english) {
          nudges.push(`📝 Haven't practiced English today. Quick 2 min: /english [any sentence you said today]`);
        }

        if (nudges.length > 0) {
          const text = `⏰ *Evening Check — ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}*\n\n${nudges.join('\n\n')}\n\n_Reply to this or log via commands!_`;
          await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
      } catch {}
    }
  }

  // Weekly planning session: Sunday 9am
  @Cron('0 9 * * 0')
  async sendWeeklyPlanning() {
    if (!this.bot) return;

    const users = await this.prisma.user.findMany({ select: { id: true, name: true } }).catch(() => []);

    for (const user of users) {
      const chatId = parseInt((user as any).telegramChatId || '');
      if (!chatId) continue;

      try {
        const report = await this.aiService.generateWeeklyReport(user.id);

        const text = `📅 *Sunday Weekly Review — ${user.name?.split(' ')[0]}*\n\nTime to review last week and plan this week!\n\n${report.slice(0, 2000)}\n\n...\n\nFull report at /report`;

        await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch {}
    }
  }

  // Hourly water reminder
  @Cron('0 * * * *')
  async sendWaterReminders() {
    if (!this.bot || this.activeChatIds.size === 0) return;
    const today = new Date().toDateString();
    const hour = new Date().getHours();
    if (hour < 7 || hour >= 23) return;

    for (const chatId of this.activeChatIds) {
      const tracker = this.waterTracker.get(chatId);
      const liters = tracker?.date === today ? tracker.liters : 0;
      if (liters >= this.WATER_GOAL) continue;

      const remaining = this.WATER_GOAL - liters;
      const percent = Math.round((liters / this.WATER_GOAL) * 100);
      const filled = Math.round(percent / 20);
      const bar = '💧'.repeat(filled) + '○'.repeat(5 - filled);

      try {
        await this.bot.sendMessage(chatId,
          `⏰ *Water Reminder!*\n\n${bar} ${percent}%\n📊 Today: ${liters.toFixed(1)}L / ${this.WATER_GOAL}L\n💧 Need: ${remaining.toFixed(1)}L more\n\nDrink a glass now! /water 0.25`,
          { parse_mode: 'Markdown' });
      } catch {}
    }
  }

  processWebhook(body: any) {
    if (this.bot) {
      this.bot.processUpdate(body);
    }
  }
}
