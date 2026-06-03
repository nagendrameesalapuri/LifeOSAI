const prisma = require('../lib/prisma');

async function getProfile(userId) {
  const base = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, weightKg: true, targetWeightKg: true, heightCm: true, age: true, profession: true, createdAt: true },
  });
  if (!base) return null;
  try {
    const extended = await prisma.user.findUnique({
      where: { id: userId },
      select: { activityLevel: true, tdeeKcal: true, gymDaysPerWeek: true, dailyProteinTarget: true, dailyCalorieTarget: true, gymAccess: true, fitnessLevel: true, onboardingComplete: true, telegramChatId: true, primaryGoal: true, motivationNote: true, careerGoal: true, careerGoalCustom: true, languageGoals: true, nativeLanguage: true },
    });
    return { ...base, ...extended };
  } catch { return base; }
}

async function getStats(userId) {
  const [workoutCount, weightLogCount, sleepLogCount, dietLogCount, studyLogs, englishLogs, kannadaLogs, habitLogs] = await Promise.all([
    prisma.workoutLog.count({ where: { userId } }),
    prisma.weightLog.count({ where: { userId } }),
    prisma.sleepLog.count({ where: { userId } }),
    prisma.dietLog.count({ where: { userId } }),
    prisma.studyLog.findMany({ where: { userId } }),
    prisma.englishLog.count({ where: { userId } }),
    prisma.kannadaLog.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } }),
    prisma.habitLog.count({ where: { userId } }),
  ]);

  const bodyMeasurements = await (prisma.bodyMeasurement?.count({ where: { userId } }).catch(() => 0) ?? 0);
  const weeklyReports = await prisma.weeklyReport.count({ where: { userId } });
  const morningCheckins = await (prisma.morningCheckin?.count({ where: { userId } }).catch(() => 0) ?? 0);
  const lifeScore = await prisma.lifeScore.findFirst({ where: { userId }, orderBy: { date: 'desc' } });

  const totalStudyMinutes = studyLogs.reduce((a, l) => a + l.durationMin, 0);
  const studyTopics = [...new Set(studyLogs.map(l => l.topic))];
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  const daysSinceJoin = user ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000) : 0;
  const recentHabits = await prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 90 });
  let gymStreak = 0;
  for (const h of recentHabits) { if (h.gym) gymStreak++; else break; }

  return { workoutCount, weightLogCount, sleepLogCount, dietLogCount, totalStudyHours: Math.round(totalStudyMinutes / 60), totalStudyMinutes, studyTopicsCount: studyTopics.length, studyTopics, englishCorrections: englishLogs, kannadaVocab: kannadaLogs?.vocabularyCount || 0, habitLogCount: habitLogs, bodyMeasurementCount: bodyMeasurements, weeklyReportCount: weeklyReports, morningCheckinCount: morningCheckins, currentLifeScore: lifeScore?.overall || 0, gymStreak, daysSinceJoin };
}

async function updateProfile(userId, data) {
  const allowed = ['name', 'weightKg', 'targetWeightKg', 'heightCm', 'age', 'profession', 'activityLevel', 'gymDaysPerWeek', 'gymAccess', 'fitnessLevel', 'primaryGoal', 'motivationNote', 'onboardingComplete', 'telegramChatId', 'dailyCalorieTarget', 'dailyProteinTarget', 'tdeeKcal', 'careerGoal', 'careerGoalCustom', 'languageGoals', 'nativeLanguage', 'googleId'];
  const updateData = {};
  for (const field of allowed) { if (data[field] !== undefined) updateData[field] = data[field]; }
  return prisma.user.update({ where: { id: userId }, data: updateData });
}

module.exports = { getProfile, getStats, updateProfile };
