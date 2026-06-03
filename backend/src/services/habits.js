const prisma = require('../lib/prisma');
const ai = require('./ai');

function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function calculateStreak(logs, habit) {
  let streak = 0;
  for (const log of logs) { if (log[habit]) streak++; else break; }
  return streak;
}

async function checkIn(userId, data) {
  const date = today();
  return prisma.habitLog.upsert({
    where: { userId_date: { userId, date } },
    update: { gym: data.gym ?? false, sleep: data.sleep ?? false, study: data.study ?? false, english: data.english ?? false, kannada: data.kannada ?? false, waterLitres: data.waterLitres ?? 0, notes: data.notes },
    create: { userId, date, gym: data.gym ?? false, sleep: data.sleep ?? false, study: data.study ?? false, english: data.english ?? false, kannada: data.kannada ?? false, waterLitres: data.waterLitres ?? 0, notes: data.notes },
  });
}

async function getHabitHistory(userId) {
  return prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 });
}

async function getHabitScores(userId) {
  const logs = await prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 });
  if (!logs.length) return { disciplineScore: 0, consistencyScore: 0, streaks: { gym: 0, sleep: 0, study: 0, english: 0, kannada: 0 }, weeklyCompletion: {}, logs: [] };

  const last7 = logs.slice(0, 7);
  const gymDays = last7.filter(l => l.gym).length;
  const sleepDays = last7.filter(l => l.sleep).length;
  const studyDays = last7.filter(l => l.study).length;
  const englishDays = last7.filter(l => l.english).length;
  const kannadaDays = last7.filter(l => l.kannada).length;
  const waterDays = last7.filter(l => l.waterLitres >= 2.5).length;

  const weeklyCompletion = {
    gym: Math.round((gymDays / 7) * 100), sleep: Math.round((sleepDays / 7) * 100),
    study: Math.round((studyDays / 7) * 100), english: Math.round((englishDays / 7) * 100),
    kannada: Math.round((kannadaDays / 7) * 100), water: Math.round((waterDays / 7) * 100),
  };

  const disciplineScore = Math.round(
    (gymDays * 25 + sleepDays * 20 + studyDays * 20 + englishDays * 15 + kannadaDays * 10 + waterDays * 10) / (7 * 100) * 100
  );

  const streaks = {
    gym: calculateStreak(logs, 'gym'), sleep: calculateStreak(logs, 'sleep'),
    study: calculateStreak(logs, 'study'), english: calculateStreak(logs, 'english'),
    kannada: calculateStreak(logs, 'kannada'),
  };

  const allHabitsAvg = Object.values(weeklyCompletion).reduce((a, b) => a + b, 0) / 6;
  return { disciplineScore, consistencyScore: Math.round(allHabitsAvg), streaks, weeklyCompletion, logs };
}

async function getStreaks(userId) {
  const logs = await prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 90 });
  if (!logs.length) return { gym: 0, sleep: 0, study: 0, english: 0, kannada: 0, overall: 0 };

  const gym = calculateStreak(logs, 'gym');
  const sleep = calculateStreak(logs, 'sleep');
  const study = calculateStreak(logs, 'study');
  const english = calculateStreak(logs, 'english');
  const kannada = calculateStreak(logs, 'kannada');

  let overall = 0;
  for (const log of logs) {
    const coreHabits = [log.gym, log.sleep, log.study].filter(Boolean).length;
    if (coreHabits >= 2) overall++;
    else break;
  }
  return { gym, sleep, study, english, kannada, overall };
}

async function saveMorningCheckin(userId, data) {
  const date = today();
  if (!prisma.morningCheckin) return { error: 'Run database migration: npx prisma db push' };
  return prisma.morningCheckin.upsert({
    where: { userId_date: { userId, date } },
    update: { mood: data.mood, energy: data.energy, yesterdayRating: data.yesterdayRating, todayGoals: data.todayGoals || [], completedVia: 'web' },
    create: { userId, date, mood: data.mood, energy: data.energy, yesterdayRating: data.yesterdayRating, todayGoals: data.todayGoals || [], completedVia: 'web' },
  });
}

async function getMorningCheckin(userId) {
  const date = today();
  const tomorrow = new Date(date); tomorrow.setDate(tomorrow.getDate() + 1);
  if (!prisma.morningCheckin) return null;

  const [todayCheckin, aiMessage, streaks] = await Promise.all([
    prisma.morningCheckin.findFirst({ where: { userId, date: { gte: date, lt: tomorrow } } }),
    ai.generateMorningCheckin(userId).catch(() => null),
    getStreaks(userId),
  ]);
  return { todayCheckin, aiMessage, streaks };
}

module.exports = { checkIn, getHabitHistory, getHabitScores, getStreaks, saveMorningCheckin, getMorningCheckin };
