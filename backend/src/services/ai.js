const anthropic = require('../lib/anthropic');
const prisma = require('../lib/prisma');
const memory = require('./memory');
const { SYSTEM_PROMPTS, KANNADA_CURRICULUM } = require('../data/prompts');
const cache = require('../lib/cache');
const promptService = require('./prompt.service');

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

// withFallback: stores last-good response in Redis (persists across deploys) or memory.
// TTL: 7 days. If Claude is down, serves stale with _fallback: true flag.
async function withFallback(userId, type, fn) {
  try {
    const result = await fn();
    // Never cache error/parse-failure results — only store genuinely good responses
    if (result?.parseError || result?.error) return result;
    const stored = typeof result === 'string' ? { _str: result } : result;
    await cache.set(`fallback:${userId}:${type}`, stored, 7 * 24 * 3600);
    return result;
  } catch (e) {
    const stale = await cache.get(`fallback:${userId}:${type}`);
    if (stale) {
      console.warn(`AI fallback served for ${type}: ${e.message}`);
      if (stale._str !== undefined) return stale._str;
      return { ...stale, _fallback: true };
    }
    throw e;
  }
}

function dayKey(userId) {
  const d = new Date();
  return `${userId}_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function midnightTtl() {
  const m = new Date(); m.setHours(23, 59, 59, 999);
  return Math.max(60, Math.floor((m.getTime() - Date.now()) / 1000));
}

function extractJson(raw) {
  const stripped = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch {}
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function getUserProfile(userId) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, profession: true, nativeLanguage: true, languageGoals: true, careerGoal: true, careerGoalCustom: true },
    });
  } catch {
    return prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, profession: true } });
  }
}

async function chat(userId, message) {
  return chatWithHistory(userId, message, []);
}

async function chatWithHistory(userId, message, history = []) {
  const context = await memory.getContextualMemory(userId);
  const messages = [
    ...history.slice(-20).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];
  return chatWithMessages(userId, context, messages);
}

// Called by routes that have already built the messages array from DB history
async function chatWithMessages(userId, context, messages) {
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 1024,
    system: await promptService.get('MAIN_COACH', context),
    messages,
  });
  return response.content[0].text;
}

async function correctEnglish(text, userId) {
  const userProfile = userId ? await getUserProfile(userId) : null;
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 1024,
    system: SYSTEM_PROMPTS.ENGLISH_CORRECTION(userProfile),
    messages: [{ role: 'user', content: `Please correct this text: "${text}"` }],
  });
  const raw = response.content[0].text;
  return extractJson(raw) || { correctedText: text, mistakes: [], grammarScore: 75, encouragement: 'Good effort!' };
}

async function generateWorkoutPlan(userId) {
  const key = `workout_plan:${dayKey(userId)}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  return withFallback(userId, 'workout_plan', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: SONNET, max_tokens: 2048,
      system: await promptService.get('WORKOUT_PLAN', context),
      messages: [{ role: 'user', content: 'Generate my workout plan for today based on my history and goals.' }],
    });
    const data = extractJson(response.content[0].text) || { plan: response.content[0].text };
    await cache.set(key, data, midnightTtl());
    return data;
  });
}

async function generateWorkoutProgram(userId) {
  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 4096,
    system: SYSTEM_PROMPTS.WORKOUT_PROGRAM_GENERATOR(context),
    messages: [{ role: 'user', content: 'Generate a 12-week workout program for lean muscle building based on my profile.' }],
  });
  const raw = response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim();
  try { return JSON.parse(raw); } catch { return { error: 'Could not generate program', raw }; }
}

async function generateDietPlan(userId) {
  const key = `diet_plan:${dayKey(userId)}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  return withFallback(userId, 'diet_plan', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: HAIKU, max_tokens: 3000,
      system: await promptService.get('DIET_PLAN', context),
      messages: [{ role: 'user', content: 'Generate my meal plan for today with meal timing based on my goals.' }],
    });
    const data = extractJson(response.content[0].text) || { plan: response.content[0].text };
    await cache.set(key, data, midnightTtl());
    return data;
  });
}

async function getKannadaLesson(userId, dayOverride) {
  const userProfile = await getUserProfile(userId);
  const nativeLang = userProfile?.nativeLanguage || 'telugu';

  // Day = completed lessons + 1, so new users always start at Day 1
  let dayNumber = 1;
  if (dayOverride != null) {
    dayNumber = dayOverride;
  } else if (userId) {
    const completedCount = await prisma.dailyLesson.count({ where: { userId, language: 'kannada', completed: true } }).catch(() => 0);
    dayNumber = Math.min(completedCount + 1, KANNADA_CURRICULUM.length);
  }
  const curriculumIndex = (dayNumber - 1) % KANNADA_CURRICULUM.length;
  const curriculum = KANNADA_CURRICULUM[curriculumIndex];

  return withFallback(userId, `kannada_lesson_day${dayNumber}`, async () => {
    const response = await anthropic.messages.create({
      model: SONNET, max_tokens: 4000,
      system: await promptService.get('KANNADA_LESSON', userProfile),
      messages: [{ role: 'user', content: `Day ${dayNumber} of ${KANNADA_CURRICULUM.length}.\nTheme: "${curriculum.theme}"\nLevel: ${curriculum.level}\nTeach this topic with 5-7 words and 2-3 sentences for a heritage learner whose native language is ${nativeLang}.` }],
    });
    const parsed = extractJson(response.content[0].text);
    if (parsed) return { ...parsed, dayNumber, curriculum: curriculum.level };
    return { theme: curriculum.theme, dayNumber, curriculum: curriculum.level, parseError: true };
  });
}

async function careerCoach(userId, message) {
  const [context, userProfile] = await Promise.all([memory.getContextualMemory(userId), getUserProfile(userId)]);
  const careerProfile = { currentRole: userProfile?.profession, careerGoal: userProfile?.careerGoal, careerGoalCustom: userProfile?.careerGoalCustom };
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 1024,
    system: SYSTEM_PROMPTS.CAREER_COACH(context, careerProfile),
    messages: [{ role: 'user', content: message }],
  });
  return response.content[0].text;
}

async function generateWeeklyReport(userId) {
  return withFallback(userId, 'weekly_report', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: SONNET, max_tokens: 3000,
      system: SYSTEM_PROMPTS.WEEKLY_REPORT(context),
      messages: [{ role: 'user', content: 'Generate my complete weekly life report with week-over-week comparison.' }],
    });
    return response.content[0].text;
  });
}

async function generateDailyPlan(userId) {
  return withFallback(userId, 'daily_plan', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: SONNET, max_tokens: 1500,
      system: await promptService.get('MAIN_COACH', context),
      messages: [{ role: 'user', content: 'Generate my complete daily plan for today: workout, diet with timing, study topic, English practice, Kannada word, and top 3 priorities.' }],
    });
    return response.content[0].text;
  });
}

async function getEnglishLesson(topic, userId) {
  const userProfile = userId ? await getUserProfile(userId) : null;
  const DAILY_TOPICS = [
    'When to use HAVE vs HAS vs HAD', 'Using WAS and WERE correctly',
    'Articles: A, AN, THE — when to use each', 'Simple Present tense: AM / IS / ARE',
    'Simple Past tense (went, ate, did, was)', 'How to ask questions in English',
    'Using WILL for future plans', 'Saying what you WANT, NEED, LIKE',
    'Using SINCE and FOR with time', 'Describing people and things (adjectives)',
    'How to say sorry and be polite', 'Talking about daily routine',
    'Using CAN and COULD correctly', 'Expressing opinions: I think, I feel, I believe',
    'Connecting sentences: AND, BUT, SO, BECAUSE', 'Using SHOULD and MUST for advice',
    'Comparing things: more, most, better, best', 'Talking about past habits: USED TO',
    'Using ALREADY, YET, STILL, JUST', 'Prepositions: IN, ON, AT (time and place)',
    'Phrasal verbs for office: follow up, check in, wrap up', 'Email writing basics',
    'Talking about your job and skills', 'Asking for help politely at work',
    'Numbers, dates and times in English', 'Body language words in English',
    'Positive and negative words (good/bad vocabulary)', 'Idioms Indians use wrongly',
    "Speaking faster: contractions (I'm, don't, can't)", 'Building vocabulary: word families',
  ];

  // Day = number of completed lessons + 1 (so new users always start at Day 1)
  let dayNumber = 1;
  if (userId) {
    const completedCount = await prisma.dailyLesson.count({ where: { userId, language: 'english', completed: true } }).catch(() => 0);
    dayNumber = Math.min(completedCount + 1, DAILY_TOPICS.length);
  }
  const topicIndex = (dayNumber - 1) % DAILY_TOPICS.length;
  const todayTopic = topic || DAILY_TOPICS[topicIndex];

  return withFallback(userId || 'anon', `english_lesson_day${dayNumber}`, async () => {
    const response = await anthropic.messages.create({
      model: SONNET, max_tokens: 2000,
      system: await promptService.get('ENGLISH_LESSON', userProfile),
      messages: [{ role: 'user', content: `Day ${dayNumber}. Topic: "${todayTopic}".\nTeach this grammar topic and give 5 new vocabulary words for an Indian English learner.` }],
    });
    const raw = response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim();
    try { return { ...JSON.parse(raw), dayNumber }; } catch { return { topic: todayTopic, dayNumber, error: raw }; }
  });
}

async function practiceEnglishSpeaking(situation) {
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 800,
    system: SYSTEM_PROMPTS.ENGLISH_SPEAKING,
    messages: [{ role: 'user', content: situation }],
  });
  try { return JSON.parse(response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim()); } catch { return null; }
}

async function analyzeErrorPatterns(patterns) {
  const patternsText = patterns.map(p => `${p.errorType}: ${p.count} times`).join('\n');
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 1000,
    system: SYSTEM_PROMPTS.ENGLISH_PATTERN_ANALYSIS,
    messages: [{ role: 'user', content: `Analyze these error patterns:\n${patternsText}` }],
  });
  try { return JSON.parse(response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim()); } catch { return null; }
}

async function generateAiInsights(userId) {
  return withFallback(userId, 'ai_insights', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: HAIKU, max_tokens: 512,
      system: SYSTEM_PROMPTS.MAIN_COACH(context),
      messages: [{ role: 'user', content: 'Give me 3 short AI insights about my performance this week. Be specific with numbers. One sentence each.' }],
    });
    return response.content[0].text;
  });
}

async function generateProactiveInsights(userId) {
  const key = `proactive_insights:${dayKey(userId)}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  return withFallback(userId, 'proactive_insights', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: HAIKU, max_tokens: 1000,
      system: SYSTEM_PROMPTS.PROACTIVE_INSIGHTS(context),
      messages: [{ role: 'user', content: 'Analyze my data and give me specific proactive insights and nudges.' }],
    });
    const data = extractJson(response.content[0].text) || { insights: [], weekPattern: response.content[0].text };
    await cache.set(key, data, midnightTtl());
    return data;
  });
}

async function generateMorningCheckin(userId) {
  const key = `morning_checkin:${dayKey(userId)}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  return withFallback(userId, 'morning_checkin', async () => {
    const context = await memory.getContextualMemory(userId);
    const response = await anthropic.messages.create({
      model: HAIKU, max_tokens: 800,
      system: SYSTEM_PROMPTS.MORNING_CHECKIN(context),
      messages: [{ role: 'user', content: 'Generate my morning check-in for today.' }],
    });
    const data = extractJson(response.content[0].text) || { greeting: 'Good morning!', message: response.content[0].text };
    await cache.set(key, data, midnightTtl());
    return data;
  });
}

async function generateScoreBreakdown(userId, scores) {
  return withFallback(userId, 'score_breakdown', async () => {
    const context = await memory.getContextualMemory(userId);
    const scoresText = Object.entries(scores).map(([k, v]) => `${k}: ${v}/100`).join(', ');
    const response = await anthropic.messages.create({
      model: HAIKU, max_tokens: 1500,
      system: SYSTEM_PROMPTS.SCORE_BREAKDOWN(context),
      messages: [{ role: 'user', content: `Current scores: ${scoresText}. Explain why each score is what it is and how to improve.` }],
    });
    try { return JSON.parse(response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim()); } catch { return null; }
  });
}

async function callHaiku(prompt) {
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

async function callHaikuVision(imageBase64, mediaType, prompt) {
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  return response.content[0].text;
}

module.exports = {
  chat, chatWithHistory, chatWithMessages, correctEnglish, generateWorkoutPlan, generateWorkoutProgram,
  callHaiku, callHaikuVision,
  generateDietPlan, getKannadaLesson, careerCoach, generateWeeklyReport,
  generateDailyPlan, getEnglishLesson, practiceEnglishSpeaking,
  analyzeErrorPatterns, generateAiInsights, generateProactiveInsights,
  generateMorningCheckin, generateScoreBreakdown,
};
