const prisma = require('../lib/prisma');
const ai = require('./ai');
const memory = require('./memory');

function todayDayNumber() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  return (dayOfYear % 30) + 1;
}

async function correctText(userId, text) {
  const result = await ai.correctEnglish(text, userId);
  await prisma.englishLog.create({
    data: { userId, inputText: text, correctedText: result.correctedText || text, mistakes: result.mistakes || [], grammarScore: result.grammarScore || 75 },
  });
  await memory.updateEnglishMemory(userId, result);
  if (result.mistakes?.length > 0) await updateErrorPatterns(userId, result.mistakes).catch(() => {});
  return result;
}

async function updateErrorPatterns(userId, mistakes) {
  if (!prisma.errorPattern) return;
  for (const mistake of mistakes) {
    try {
      const errorType = mistake.type || 'general';
      const example = { original: mistake.original, corrected: mistake.corrected, date: new Date().toISOString() };
      const existing = await prisma.errorPattern.findUnique({ where: { userId_errorType: { userId, errorType } } });
      if (existing) {
        const examples = [...(existing.examples || []), example].slice(-10);
        await prisma.errorPattern.update({ where: { userId_errorType: { userId, errorType } }, data: { count: existing.count + 1, examples, lastSeen: new Date() } });
      } else {
        await prisma.errorPattern.create({ data: { userId, errorType, count: 1, examples: [example] } });
      }
    } catch {}
  }
}

async function getErrorPatterns(userId) {
  if (!prisma.errorPattern) return { patterns: [], analysis: null, message: 'Run database migration to enable pattern tracking' };
  try {
    const patterns = await prisma.errorPattern.findMany({ where: { userId }, orderBy: { count: 'desc' } });
    if (!patterns.length) return { patterns: [], analysis: null };
    const analysis = await ai.analyzeErrorPatterns(patterns).catch(() => null);
    return { patterns: patterns.map(p => ({ ...p, severity: p.count >= 10 ? 'high' : p.count >= 5 ? 'medium' : 'low' })), analysis };
  } catch { return { patterns: [], analysis: null }; }
}

async function getLesson(userId, topic) {
  if (!topic) {
    const dayNumber = todayDayNumber();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const cached = await prisma.dailyLesson.findFirst({ where: { userId, language: 'english', dayNumber, date: { gte: today, lt: tomorrow } } });
    if (cached?.lessonData) {
      const reviewWords = prisma.vocabularyCard ? await getDueVocabularyCards(userId).catch(() => []) : [];
      return { ...cached.lessonData, reviewWords: reviewWords.slice(0, 5), fromCache: true };
    }
  }

  const lesson = await ai.getEnglishLesson(topic, userId);
  if (lesson?.dayNumber) {
    await prisma.dailyLesson.upsert({
      where: { userId_language_dayNumber: { userId, language: 'english', dayNumber: lesson.dayNumber } },
      update: { lessonData: lesson, topic: lesson.topic || 'English Lesson' },
      create: { userId, language: 'english', dayNumber: lesson.dayNumber, topic: lesson.topic || 'English Lesson', lessonData: lesson },
    });
  }
  if (lesson?.vocabulary && prisma.vocabularyCard) {
    for (const word of lesson.vocabulary) {
      await addVocabularyCard(userId, { word: word.word, meaning: word.meaning, example: word.example, pronunciation: word.pronunciation }, 'english').catch(() => {});
    }
  }
  const reviewWords = prisma.vocabularyCard ? await getDueVocabularyCards(userId).catch(() => []) : [];
  return { ...lesson, reviewWords: reviewWords.slice(0, 5) };
}

async function getLessonHistory(userId) {
  return prisma.dailyLesson.findMany({ where: { userId, language: 'english' }, orderBy: { date: 'desc' }, take: 60 });
}

async function completeLesson(userId, dayNumber) {
  return prisma.dailyLesson.updateMany({ where: { userId, language: 'english', dayNumber }, data: { completed: true, completedAt: new Date() } });
}

async function practiceSpeaking(situation) { return ai.practiceEnglishSpeaking(situation); }

async function getEnglishHistory(userId) {
  return prisma.englishLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 20 });
}

async function getEnglishStats(userId) {
  const logs = await prisma.englishLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 });
  if (!logs.length) return { grammarScore: 0, totalCorrections: 0, improvementTrend: 'not started' };

  const avgScore = Math.round(logs.reduce((a, l) => a + l.grammarScore, 0) / logs.length);
  const recentScore = logs.slice(0, 5).reduce((a, l) => a + l.grammarScore, 0) / Math.min(logs.length, 5);
  const olderScore = logs.slice(5, 15).length ? logs.slice(5, 15).reduce((a, l) => a + l.grammarScore, 0) / logs.slice(5, 15).length : recentScore;
  const trend = recentScore > olderScore ? 'improving' : recentScore < olderScore ? 'declining' : 'stable';

  const thisWeek = logs.filter(l => new Date(l.loggedAt) > new Date(Date.now() - 7 * 86400000));
  const lastWeek = logs.filter(l => { const d = new Date(l.loggedAt); return d > new Date(Date.now() - 14 * 86400000) && d <= new Date(Date.now() - 7 * 86400000); });
  const thisWeekAvg = thisWeek.length ? Math.round(thisWeek.reduce((a, l) => a + l.grammarScore, 0) / thisWeek.length) : 0;
  const lastWeekAvg = lastWeek.length ? Math.round(lastWeek.reduce((a, l) => a + l.grammarScore, 0) / lastWeek.length) : 0;

  return { grammarScore: avgScore, totalCorrections: logs.reduce((a, l) => a + (l.mistakes?.length || 0), 0), improvementTrend: trend, recentScore: Math.round(recentScore), thisWeekAvg, lastWeekAvg, weekOverWeek: thisWeekAvg - lastWeekAvg, logs: logs.slice(0, 10) };
}

async function addVocabularyCard(userId, wordData, language = 'english') {
  if (!prisma.vocabularyCard) return null;
  try {
    const existing = await prisma.vocabularyCard.findFirst({ where: { userId, word: wordData.word, language } });
    if (existing) return existing;
    return prisma.vocabularyCard.create({ data: { userId, word: wordData.word, meaning: wordData.meaning, example: wordData.example, pronunciation: wordData.pronunciation, language, nextReview: new Date(), intervalDays: 1, easeFactor: 2.5 } });
  } catch { return null; }
}

async function getDueVocabularyCards(userId, language = 'english') {
  if (!prisma.vocabularyCard) return [];
  try { return prisma.vocabularyCard.findMany({ where: { userId, language, nextReview: { lte: new Date() } }, orderBy: { nextReview: 'asc' }, take: 20 }); } catch { return []; }
}

async function getAllVocabularyCards(userId, language = 'english') {
  if (!prisma.vocabularyCard) return [];
  try { return prisma.vocabularyCard.findMany({ where: { userId, language }, orderBy: { createdAt: 'desc' } }); } catch { return []; }
}

async function reviewVocabularyCard(userId, cardId, quality) {
  if (!prisma.vocabularyCard) throw new Error('Migration required');
  const card = await prisma.vocabularyCard.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId) throw new Error('Card not found');

  let { intervalDays, easeFactor, reviewCount, successCount } = card;
  reviewCount += 1;
  if (quality < 3) {
    intervalDays = 1;
  } else {
    successCount += 1;
    if (reviewCount === 1) intervalDays = 1;
    else if (reviewCount === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }
  const nextReview = new Date(); nextReview.setDate(nextReview.getDate() + intervalDays);
  return prisma.vocabularyCard.update({ where: { id: cardId }, data: { intervalDays, easeFactor, reviewCount, successCount, nextReview, lastReviewed: new Date() } });
}

async function getVocabularyStats(userId) {
  if (!prisma.vocabularyCard) return { total: 0, dueToday: 0, mastered: 0, learning: 0 };
  try {
    const [total, dueToday, mastered] = await Promise.all([
      prisma.vocabularyCard.count({ where: { userId } }),
      prisma.vocabularyCard.count({ where: { userId, nextReview: { lte: new Date() } } }),
      prisma.vocabularyCard.count({ where: { userId, intervalDays: { gte: 21 } } }),
    ]);
    return { total, dueToday, mastered, learning: total - mastered };
  } catch { return { total: 0, dueToday: 0, mastered: 0, learning: 0 }; }
}

module.exports = { correctText, getErrorPatterns, getLesson, getLessonHistory, completeLesson, practiceSpeaking, getEnglishHistory, getEnglishStats, addVocabularyCard, getDueVocabularyCards, getAllVocabularyCards, reviewVocabularyCard, getVocabularyStats };
