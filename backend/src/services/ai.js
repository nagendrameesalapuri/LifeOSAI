const anthropic = require('../lib/anthropic');
const prisma = require('../lib/prisma');
const memory = require('./memory');
const { SYSTEM_PROMPTS, KANNADA_CURRICULUM } = require('../data/prompts');

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

const workoutPlanCache = new Map();
const dietPlanCache = new Map();
const morningCheckinCache = new Map();
const proactiveInsightsCache = new Map();

function dayKey(userId) {
  const d = new Date();
  return `${userId}_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function midnight() {
  const m = new Date(); m.setHours(23, 59, 59, 999); return m.getTime();
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
  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 1024,
    system: SYSTEM_PROMPTS.MAIN_COACH(context),
    messages: [{ role: 'user', content: message }],
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
  const key = dayKey(userId);
  const cached = workoutPlanCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 2048,
    system: SYSTEM_PROMPTS.WORKOUT_PLAN(context),
    messages: [{ role: 'user', content: 'Generate my workout plan for today based on my history and goals.' }],
  });
  const data = extractJson(response.content[0].text) || { plan: response.content[0].text };
  workoutPlanCache.set(key, { data, expiresAt: midnight() });
  return data;
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
  const key = dayKey(userId);
  const cached = dietPlanCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 3000,
    system: SYSTEM_PROMPTS.DIET_PLAN(context),
    messages: [{ role: 'user', content: 'Generate my meal plan for today with meal timing based on my goals.' }],
  });
  const data = extractJson(response.content[0].text) || { plan: response.content[0].text };
  dietPlanCache.set(key, { data, expiresAt: midnight() });
  return data;
}

async function getKannadaLesson(userId, dayOverride) {
  const userProfile = await getUserProfile(userId);
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  const curriculumIndex = (dayOverride != null ? dayOverride - 1 : dayOfYear) % KANNADA_CURRICULUM.length;
  const curriculum = KANNADA_CURRICULUM[curriculumIndex];
  const dayNumber = curriculumIndex + 1;
  const nativeLang = userProfile?.nativeLanguage || 'telugu';

  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 2500,
    system: SYSTEM_PROMPTS.KANNADA_LESSON(userProfile),
    messages: [{ role: 'user', content: `Day ${dayNumber} of ${KANNADA_CURRICULUM.length}.\nTheme: "${curriculum.theme}"\nLevel: ${curriculum.level}\nTeach this topic with 5-7 words and 2-3 sentences for a heritage learner whose native language is ${nativeLang}.` }],
  });
  const parsed = extractJson(response.content[0].text);
  if (parsed) return { ...parsed, dayNumber, curriculum: curriculum.level };
  return { theme: curriculum.theme, dayNumber, curriculum: curriculum.level, parseError: true };
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
  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 3000,
    system: SYSTEM_PROMPTS.WEEKLY_REPORT(context),
    messages: [{ role: 'user', content: 'Generate my complete weekly life report with week-over-week comparison.' }],
  });
  return response.content[0].text;
}

async function generateDailyPlan(userId) {
  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 1500,
    system: SYSTEM_PROMPTS.MAIN_COACH(context),
    messages: [{ role: 'user', content: 'Generate my complete daily plan for today: workout, diet with timing, study topic, English practice, Kannada word, and top 3 priorities.' }],
  });
  return response.content[0].text;
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
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  const todayTopic = topic || DAILY_TOPICS[dayOfYear % DAILY_TOPICS.length];
  const dayNumber = dayOfYear % DAILY_TOPICS.length + 1;

  const response = await anthropic.messages.create({
    model: SONNET, max_tokens: 2000,
    system: SYSTEM_PROMPTS.ENGLISH_LESSON(userProfile),
    messages: [{ role: 'user', content: `Day ${dayNumber}. Topic: "${todayTopic}".\nTeach this grammar topic and give 5 new vocabulary words for an Indian English learner.` }],
  });
  const raw = response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim();
  try { return JSON.parse(raw); } catch { return { topic: todayTopic, dayNumber, error: raw }; }
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
  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 512,
    system: SYSTEM_PROMPTS.MAIN_COACH(context),
    messages: [{ role: 'user', content: 'Give me 3 short AI insights about my performance this week. Be specific with numbers. One sentence each.' }],
  });
  return response.content[0].text;
}

async function generateProactiveInsights(userId) {
  const key = dayKey(userId);
  const cached = proactiveInsightsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 1000,
    system: SYSTEM_PROMPTS.PROACTIVE_INSIGHTS(context),
    messages: [{ role: 'user', content: 'Analyze my data and give me specific proactive insights and nudges.' }],
  });
  const data = extractJson(response.content[0].text) || { insights: [], weekPattern: response.content[0].text };
  proactiveInsightsCache.set(key, { data, expiresAt: midnight() });
  return data;
}

async function generateMorningCheckin(userId) {
  const key = dayKey(userId);
  const cached = morningCheckinCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const context = await memory.getContextualMemory(userId);
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 800,
    system: SYSTEM_PROMPTS.MORNING_CHECKIN(context),
    messages: [{ role: 'user', content: 'Generate my morning check-in for today.' }],
  });
  const data = extractJson(response.content[0].text) || { greeting: 'Good morning!', message: response.content[0].text };
  morningCheckinCache.set(key, { data, expiresAt: midnight() });
  return data;
}

async function generateScoreBreakdown(userId, scores) {
  const context = await memory.getContextualMemory(userId);
  const scoresText = Object.entries(scores).map(([k, v]) => `${k}: ${v}/100`).join(', ');
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 1500,
    system: SYSTEM_PROMPTS.SCORE_BREAKDOWN(context),
    messages: [{ role: 'user', content: `Current scores: ${scoresText}. Explain why each score is what it is and how to improve.` }],
  });
  try { return JSON.parse(response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim()); } catch { return null; }
}

// Direct Anthropic client access for diet service
async function callHaiku(prompt) {
  const response = await anthropic.messages.create({
    model: HAIKU, max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

module.exports = {
  chat, correctEnglish, generateWorkoutPlan, generateWorkoutProgram,
  generateDietPlan, getKannadaLesson, careerCoach, generateWeeklyReport,
  generateDailyPlan, getEnglishLesson, practiceEnglishSpeaking,
  analyzeErrorPatterns, generateAiInsights, generateProactiveInsights,
  generateMorningCheckin, generateScoreBreakdown, callHaiku,
};
