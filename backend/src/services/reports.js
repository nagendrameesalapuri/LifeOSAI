const prisma = require('../lib/prisma');
const ai = require('./ai');
const { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } = require('../data/safe-select');

async function generateWeeklyReport(userId) {
  const aiInsights = await ai.generateWeeklyReport(userId);
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);

  const [habitLogs, workoutLogs, sleepLogs, studyLogs, dietLogs] = await Promise.all([
    prisma.habitLog.findMany({ where: { userId, date: { gte: weekStart } } }),
    prisma.workoutLog.findMany({ where: { userId, loggedAt: { gte: weekStart } }, select: SAFE_WORKOUT_SELECT }),
    prisma.sleepLog.findMany({ where: { userId, loggedAt: { gte: weekStart } } }),
    prisma.studyLog.findMany({ where: { userId, loggedAt: { gte: weekStart } } }),
    prisma.dietLog.findMany({ where: { userId, loggedAt: { gte: weekStart } }, select: SAFE_DIET_SELECT }),
  ]);

  const report = {
    fitness: { workoutsCompleted: workoutLogs.length, gymDays: habitLogs.filter(h => h.gym).length, avgProtein: dietLogs.length ? Math.round(dietLogs.reduce((a, d) => a + d.totalProteinG, 0) / dietLogs.length) : 0 },
    sleep: { avgDuration: sleepLogs.length ? Math.round((sleepLogs.reduce((a, s) => a + s.durationHours, 0) / sleepLogs.length) * 10) / 10 : 0, nightsLogged: sleepLogs.length },
    habits: { gymDays: habitLogs.filter(h => h.gym).length, studyDays: habitLogs.filter(h => h.study).length, englishDays: habitLogs.filter(h => h.english).length, kannadaDays: habitLogs.filter(h => h.kannada).length },
    career: { studySessions: studyLogs.length, totalHours: Math.round(studyLogs.reduce((a, s) => a + s.durationMin, 0) / 60), topics: [...new Set(studyLogs.map(s => s.topic))] },
  };

  return prisma.weeklyReport.create({ data: { userId, weekStart, weekEnd: now, report, aiInsights } });
}

async function getReports(userId) {
  return prisma.weeklyReport.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 });
}

async function getLatestReport(userId) {
  return prisma.weeklyReport.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

module.exports = { generateWeeklyReport, getReports, getLatestReport };
