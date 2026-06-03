const prisma = require('../lib/prisma');
const ai = require('./ai');
const english = require('./english');
const { KANNADA_CURRICULUM } = require('../data/prompts');

function getTodayKannadaDay() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  return (dayOfYear % KANNADA_CURRICULUM.length) + 1;
}

async function getDailyLesson(userId, dayOverride) {
  const dayNumber = dayOverride ?? getTodayKannadaDay();

  if (!dayOverride) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const cached = await prisma.dailyLesson.findFirst({ where: { userId, language: 'kannada', dayNumber, date: { gte: today, lt: tomorrow } } });
    if (cached?.lessonData && !cached.lessonData.parseError) {
      const reviewCards = await english.getDueVocabularyCards(userId, 'kannada').catch(() => []);
      return { ...cached.lessonData, reviewCards: reviewCards.slice(0, 5), fromCache: true };
    }
  }

  const lesson = await ai.getKannadaLesson(userId, dayOverride);
  if (lesson?.dayNumber && !lesson?.parseError) {
    await prisma.dailyLesson.upsert({
      where: { userId_language_dayNumber: { userId, language: 'kannada', dayNumber: lesson.dayNumber } },
      update: { lessonData: lesson, topic: lesson.theme || 'Kannada Lesson' },
      create: { userId, language: 'kannada', dayNumber: lesson.dayNumber, topic: lesson.theme || 'Kannada Lesson', lessonData: lesson },
    });
    if (lesson.words) {
      for (const word of lesson.words) {
        await english.addVocabularyCard(userId, { word: word.kannada, meaning: word.meaning, example: word.when_to_use, pronunciation: word.pronunciation }, 'kannada').catch(() => {});
      }
    }
  }

  const reviewCards = await english.getDueVocabularyCards(userId, 'kannada').catch(() => []);
  return { ...lesson, reviewCards: reviewCards.slice(0, 5) };
}

async function getLessonByDay(userId, dayNumber) {
  const existing = await prisma.dailyLesson.findUnique({ where: { userId_language_dayNumber: { userId, language: 'kannada', dayNumber } } });
  if (existing) return existing.lessonData;
  return getDailyLesson(userId, dayNumber);
}

function getCurriculum() { return KANNADA_CURRICULUM; }

async function getLessonHistory(userId) {
  return prisma.dailyLesson.findMany({ where: { userId, language: 'kannada' }, orderBy: { date: 'desc' }, take: 60 });
}

async function completeLesson(userId, dayNumber) {
  return prisma.dailyLesson.updateMany({ where: { userId, language: 'kannada', dayNumber }, data: { completed: true, completedAt: new Date() } });
}

async function logProgress(userId, data) {
  const lastLog = await prisma.kannadaLog.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } });
  const newVocabCount = (lastLog?.vocabularyCount || 0) + (data.wordsLearned?.length || 0);
  return prisma.kannadaLog.create({ data: { userId, wordsLearned: data.wordsLearned || [], practiceText: data.practiceText, vocabularyCount: newVocabCount, confidenceScore: data.confidenceScore || 1 } });
}

async function getProgress(userId) {
  const [logs, vocabStats, completedLessons] = await Promise.all([
    prisma.kannadaLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 }),
    english.getAllVocabularyCards(userId, 'kannada'),
    prisma.dailyLesson.findMany({ where: { userId, language: 'kannada', completed: true }, orderBy: { completedAt: 'desc' } }),
  ]);

  const totalVocab = vocabStats.length;
  const avgConfidence = logs.length ? Math.round(logs.reduce((a, l) => a + l.confidenceScore, 0) / logs.length) : 0;
  const allWords = vocabStats.map(v => v.word);
  const kannadaScore = Math.min(100, Math.round((totalVocab / 500) * 100));
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const currentDay = dayOfYear % KANNADA_CURRICULUM.length + 1;
  const currentCurriculum = KANNADA_CURRICULUM[currentDay - 1];

  return { totalVocab, avgConfidence, kannadaScore, completedLessons: completedLessons.length, currentDay, currentLevel: currentCurriculum?.level, recentWords: allWords.slice(0, 20), logs: logs.slice(0, 10), curriculum: KANNADA_CURRICULUM };
}

function getScriptLesson() {
  return [
    {
      section: 'Vowels (ಸ್ವರಗಳು)',
      letters: [
        { letter: 'ಅ', name: 'a', sound: 'like a in "about"', example: 'ಅಮ್ಮ (amma = mother)' },
        { letter: 'ಆ', name: 'aa', sound: 'like a in "father"', example: 'ಆಕಾಶ (aakaasha = sky)' },
        { letter: 'ಇ', name: 'i', sound: 'like i in "in"', example: 'ಇಲ್ಲ (illa = no/not here)' },
        { letter: 'ಈ', name: 'ee', sound: 'like ee in "see"', example: 'ಈರುಳ್ಳಿ (eerulli = onion)' },
        { letter: 'ಉ', name: 'u', sound: 'like u in "put"', example: 'ಉಪ್ಪು (uppu = salt)' },
        { letter: 'ಊ', name: 'oo', sound: 'like oo in "food"', example: 'ಊಟ (ooTa = meal)' },
      ],
    },
    {
      section: 'Common Consonants Group 1 (ಕ ವರ್ಗ)',
      letters: [
        { letter: 'ಕ', name: 'ka', sound: 'like k in "kite"', example: 'ಕಣ್ಣು (kannu = eye)' },
        { letter: 'ಖ', name: 'kha', sound: 'k with breath', example: 'ಖಾಲಿ (khaali = empty)' },
        { letter: 'ಗ', name: 'ga', sound: 'like g in "go"', example: 'ಗಡಿಯಾರ (gadiyaara = clock)' },
        { letter: 'ನ', name: 'na', sound: 'like n in "name"', example: 'ನಮಸ್ಕಾರ (namaskara = hello)' },
      ],
    },
  ];
}

module.exports = { getDailyLesson, getLessonByDay, getCurriculum, getLessonHistory, completeLesson, logProgress, getProgress, getScriptLesson };
