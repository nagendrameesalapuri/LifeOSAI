const prisma = require('../lib/prisma');
const ai = require('./ai');
const { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } = require('../data/safe-select');

function computeWeights(languageGoals) {
  const hasEnglish = languageGoals.includes('english');
  const hasKannada = languageGoals.includes('kannada');
  const langCount = (hasEnglish ? 1 : 0) + (hasKannada ? 1 : 0);
  const base = { fitness: 0.25, sleep: 0.20, discipline: 0.30, career: 0.25 };
  if (langCount === 0) return base;
  const langPool = 0.20;
  const perLang = langPool / langCount;
  const reduction = langPool / 4;
  return {
    fitness: base.fitness - reduction, sleep: base.sleep - reduction,
    discipline: base.discipline - reduction, career: base.career - reduction,
    ...(hasEnglish ? { english: perLang } : {}),
    ...(hasKannada ? { kannada: perLang } : {}),
  };
}

async function getHabitScoreData(userId) {
  const [logs, user] = await Promise.all([
    prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 }),
    prisma.user.findUnique({ where: { id: userId } }).catch(() => null),
  ]);
  if (!logs.length) return { disciplineScore: 0, consistencyScore: 0 };
  const languageGoals = user?.languageGoals || [];
  const hasEnglish = languageGoals.includes('english');
  const hasKannada = languageGoals.includes('kannada');
  const gymDays = logs.filter(l => l.gym).length;
  const sleepDays = logs.filter(l => l.sleep).length;
  const studyDays = logs.filter(l => l.study).length;
  const englishDays = hasEnglish ? logs.filter(l => l.english).length : 0;
  const kannadaDays = hasKannada ? logs.filter(l => l.kannada).length : 0;
  const englishWeight = hasEnglish ? 15 : 0;
  const kannadaWeight = hasKannada ? 10 : 0;
  const totalWeight = 25 + 25 + 25 + englishWeight + kannadaWeight;
  const maxTotal = 7 * totalWeight;
  const earnedScore = gymDays * 25 + sleepDays * 25 + studyDays * 25 + englishDays * englishWeight + kannadaDays * kannadaWeight;
  const disciplineScore = maxTotal > 0 ? Math.min(100, Math.round((earnedScore / maxTotal) * 100)) : 0;
  const consistencyScore = Math.min(100, Math.round(((gymDays + sleepDays + studyDays) / (7 * 3)) * 100));
  return { disciplineScore, consistencyScore, gymDays, sleepDays, studyDays, englishDays, kannadaDays, trackedHabits: ['gym', 'sleep', 'study', ...(hasEnglish ? ['english'] : []), ...(hasKannada ? ['kannada'] : [])] };
}

async function getSleepScoreData(userId) {
  const logs = await prisma.sleepLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 7 });
  if (!logs.length) return { score: 0 };
  const avg = logs.reduce((a, l) => a + l.durationHours, 0) / logs.length;
  return { score: Math.min(100, Math.round((avg / 8) * 100)), avgHours: avg.toFixed(1) };
}

async function getFitnessScoreData(userId) {
  const [workouts, user] = await Promise.all([
    prisma.workoutLog.findMany({ where: { userId, loggedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  const gymDaysPerWeek = user?.gymDaysPerWeek ?? 4;
  const targetPerMonth = gymDaysPerWeek * 4;
  return { score: Math.min(100, Math.round((workouts.length / targetPerMonth) * 100)), workoutsThisMonth: workouts.length, targetPerMonth };
}

async function getStudyScoreData(userId) {
  const logs = await prisma.studyLog.findMany({ where: { userId, loggedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } });
  const weeklyMins = logs.reduce((a, l) => a + l.durationMin, 0);
  return { score: Math.min(100, Math.round((weeklyMins / 840) * 100)), weeklyMinutes: weeklyMins };
}

async function getEnglishScoreData(userId) {
  const logs = await prisma.englishLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 10 });
  if (!logs.length) return { score: 0 };
  return { score: Math.round(logs.reduce((a, l) => a + l.grammarScore, 0) / logs.length) };
}

async function getKannadaScoreData(userId) {
  const log = await prisma.kannadaLog.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } });
  return { score: Math.min(100, Math.round(((log?.vocabularyCount || 0) / 500) * 100)) };
}

async function getDashboard(userId) {
  const [user, habitScores, sleepData, fitnessData, studyData, englishData, kannadaData] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }).catch(() => null),
    getHabitScoreData(userId),
    getSleepScoreData(userId),
    getFitnessScoreData(userId),
    getStudyScoreData(userId),
    getEnglishScoreData(userId),
    getKannadaScoreData(userId),
  ]);

  const languageGoals = user?.languageGoals || [];
  const weights = computeWeights(languageGoals);
  const scores = {
    fitness: fitnessData.score, sleep: sleepData.score, discipline: habitScores.disciplineScore, career: studyData.score,
    ...(languageGoals.includes('english') ? { english: englishData.score } : {}),
    ...(languageGoals.includes('kannada') ? { kannada: kannadaData.score } : {}),
  };
  const overall = Math.round(Object.entries(scores).reduce((sum, [key, val]) => sum + val * (weights[key] || 0), 0));

  await prisma.lifeScore.create({ data: { userId, date: new Date(), overall, fitness: scores.fitness, sleep: scores.sleep, discipline: scores.discipline, career: scores.career, english: scores.english ?? 0, kannada: scores.kannada ?? 0 } }).catch(() => {});

  return {
    user: { name: user?.name, weightKg: user?.weightKg, targetWeightKg: user?.targetWeightKg, tdeeKcal: user?.tdeeKcal ?? null, dailyCalorieTarget: user?.dailyCalorieTarget ?? 2800, dailyProteinTarget: user?.dailyProteinTarget ?? 140, languageGoals },
    scores: { ...scores, overall }, weights,
    details: { fitness: fitnessData, sleep: sleepData, habits: habitScores, study: studyData, english: englishData, kannada: kannadaData },
  };
}

async function getScoreBreakdown(userId) {
  try {
    const [user, habitScores, sleepData, fitnessData, studyData, englishData, kannadaData, recentWorkouts, recentSleep, recentDiet, recentStudy, recentEnglish, kannadaLogs] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      getHabitScoreData(userId),
      getSleepScoreData(userId),
      getFitnessScoreData(userId),
      getStudyScoreData(userId),
      getEnglishScoreData(userId),
      getKannadaScoreData(userId),
      prisma.workoutLog.findMany({ where: { userId, loggedAt: { gte: new Date(Date.now() - 30 * 86400000) } }, orderBy: { loggedAt: 'desc' }, select: SAFE_WORKOUT_SELECT }),
      prisma.sleepLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' } }),
      prisma.dietLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' }, select: SAFE_DIET_SELECT }),
      prisma.studyLog.findMany({ where: { userId, loggedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      prisma.englishLog.findMany({ where: { userId }, take: 10, orderBy: { loggedAt: 'desc' } }),
      prisma.kannadaLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 1 }),
    ]);

    const proteinTarget = user?.dailyProteinTarget || 140;
    const gymTarget = (user?.gymDaysPerWeek || 4) * 4;
    const avgProtein = recentDiet.length ? Math.round(recentDiet.reduce((a, d) => a + d.totalProteinG, 0) / recentDiet.length) : 0;
    const avgSleep = recentSleep.length ? (recentSleep.reduce((a, s) => a + s.durationHours, 0) / recentSleep.length).toFixed(1) : '0';
    const weeklyStudyMins = recentStudy.reduce((a, s) => a + s.durationMin, 0);
    const avgGrammarScore = recentEnglish.length ? Math.round(recentEnglish.reduce((a, l) => a + l.grammarScore, 0) / recentEnglish.length) : 0;
    const vocabCount = kannadaLogs[0]?.vocabularyCount || 0;
    const languageGoals = user?.languageGoals || [];
    const weights = computeWeights(languageGoals);

    const scores = {
      fitness: fitnessData.score, sleep: sleepData.score, discipline: habitScores.disciplineScore, career: studyData.score,
      ...(languageGoals.includes('english') ? { english: englishData.score } : {}),
      ...(languageGoals.includes('kannada') ? { kannada: kannadaData.score } : {}),
    };
    const overall = Math.round(Object.entries(scores).reduce((sum, [key, val]) => sum + val * (weights[key] || 0), 0));

    const breakdown = {
      fitness: { score: scores.fitness, whyThisScore: `You did ${recentWorkouts.length}/${gymTarget} target workouts this month`, dataPoints: [`Workouts this month: ${recentWorkouts.length}`, `Monthly target: ${gymTarget} sessions`, `Protein avg: ${avgProtein}g (target: ${proteinTarget}g)`], toRaiseBy10: `Complete ${Math.ceil(gymTarget * 0.1)} more workouts this week`, quickWin: recentWorkouts.length === 0 ? 'Go to gym TODAY — break the streak' : 'Log your next planned workout' },
      sleep: { score: scores.sleep, whyThisScore: `Your 7-day sleep average is ${avgSleep} hours (target: 8 hours)`, dataPoints: [`7-day sleep average: ${avgSleep} hours`, `Target: 8 hours/night`, `Days under 7 hours: ${recentSleep.filter(s => s.durationHours < 7).length}`], toRaiseBy10: 'Sleep before 10:30pm for 5 consecutive nights', quickWin: 'Set a phone alarm for 10pm as a "prepare for sleep" reminder' },
      discipline: { score: scores.discipline, whyThisScore: 'Habit consistency based on your tracked habits', dataPoints: [`Gym days: ${habitScores.gymDays}/7`, `Sleep habit: ${habitScores.sleepDays}/7`, `Study days: ${habitScores.studyDays}/7`], toRaiseBy10: 'Hit all your tracked habits consistently for 3 days', quickWin: "Log today's habits even if incomplete" },
      career: { score: scores.career, whyThisScore: `You studied ${weeklyStudyMins} minutes this week (target: 840 min / 14 hrs)`, dataPoints: [`Weekly study: ${Math.round(weeklyStudyMins / 60)} hours`, 'Weekly target: 14 hours', `Sessions this week: ${recentStudy.length}`], toRaiseBy10: 'Study 30 minutes daily for 7 days', quickWin: 'Open your learning resource right now and study for 15 minutes' },
      ...(languageGoals.includes('english') ? { english: { score: scores.english, whyThisScore: `Average grammar score from last ${recentEnglish.length} corrections: ${avgGrammarScore}/100`, dataPoints: [`Avg grammar score: ${avgGrammarScore}/100`, `Total corrections: ${recentEnglish.length}`], toRaiseBy10: 'Practice English correction daily for 7 days', quickWin: 'Use the English correction tool right now' } } : {}),
      ...(languageGoals.includes('kannada') ? { kannada: { score: scores.kannada, whyThisScore: `Vocabulary count: ${vocabCount} words out of 500 word target`, dataPoints: [`Words learned: ${vocabCount}`, 'Target: 500 words', `Progress: ${Math.round((vocabCount / 500) * 100)}%`], toRaiseBy10: 'Complete 5 Kannada lessons', quickWin: "Take today's Kannada lesson and say the challenge sentence to someone" } } : {}),
    };

    const lowestScore = Object.entries(scores).sort(([, a], [, b]) => a - b)[0];
    const overallInsight = overall >= 80 ? "You're crushing it across all areas. Keep the momentum going!" :
      scores.discipline < 40 ? 'Discipline is your foundation — when habits break, everything else follows.' :
      scores.fitness < 40 ? 'Your fitness score is pulling down your overall.' :
      scores.sleep < 40 ? 'Poor sleep is silently sabotaging your fitness gains.' :
      "You're building momentum. Pick ONE area and dominate it this week.";

    return { scores: { ...scores, overall }, breakdown, focusArea: lowestScore[0], focusReason: `${lowestScore[0]} is your lowest score at ${lowestScore[1]}/100`, overallInsight };
  } catch (e) { console.error('getScoreBreakdown error:', e); return null; }
}

async function getTrends(userId) {
  const [weightLogs, sleepLogs, habitLogs, studyLogs, lifeScores, dietLogs] = await Promise.all([
    prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 }),
    prisma.sleepLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 }),
    prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
    prisma.studyLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 }),
    prisma.lifeScore.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
    prisma.dietLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30, select: SAFE_DIET_SELECT }),
  ]);
  const weightWithMovingAvg = weightLogs.map((log, idx) => {
    const window = weightLogs.slice(Math.max(0, idx - 6), idx + 1);
    const avg = window.reduce((a, l) => a + l.weightKg, 0) / window.length;
    return { ...log, movingAvg7: Math.round(avg * 10) / 10 };
  });
  return { weightLogs: weightWithMovingAvg, sleepLogs, habitLogs, studyLogs, lifeScores, dietLogs };
}

async function getInsights(userId) { return ai.generateAiInsights(userId); }

async function getProactiveInsights(userId) { return ai.generateProactiveInsights(userId); }

async function getCorrelationInsights(userId) {
  const [workouts, sleepLogs, habitLogs, dietLogs] = await Promise.all([
    prisma.workoutLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 60, select: { loggedAt: true, type: true, durationMin: true } }),
    prisma.sleepLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 60 }),
    prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 60 }),
    prisma.dietLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30, select: { loggedAt: true, totalProteinG: true, totalCalories: true } }),
  ]);

  const insights = [];

  if (workouts.length > 5 && sleepLogs.length > 5) {
    const workoutDates = new Set(workouts.map(w => new Date(w.loggedAt).toDateString()));
    const goodSleepDays = sleepLogs.filter(s => s.durationHours >= 7.5);
    const poorSleepDays = sleepLogs.filter(s => s.durationHours < 6.5);
    const goodSleepGymRate = goodSleepDays.length > 0 ? goodSleepDays.filter(s => workoutDates.has(new Date(s.wakeupTime).toDateString())).length / goodSleepDays.length : 0;
    const poorSleepGymRate = poorSleepDays.length > 0 ? poorSleepDays.filter(s => workoutDates.has(new Date(s.wakeupTime).toDateString())).length / poorSleepDays.length : 0;
    if (goodSleepDays.length >= 3 && Math.abs(goodSleepGymRate - poorSleepGymRate) > 0.15) {
      insights.push({ type: 'sleep_workout_correlation', title: 'Sleep drives your gym attendance', message: `You work out ${Math.round(goodSleepGymRate * 100)}% of days after 7.5+ hrs sleep, but only ${Math.round(poorSleepGymRate * 100)}% after under 6.5 hrs.`, recommendation: 'Prioritize sleep to maintain gym consistency.', impact: 'high' });
    }
  }

  if (workouts.length > 10) {
    const dayCount = {};
    workouts.forEach(w => { const day = new Date(w.loggedAt).toLocaleDateString('en-US', { weekday: 'long' }); dayCount[day] = (dayCount[day] || 0) + 1; });
    const sorted = Object.entries(dayCount).sort(([, a], [, b]) => a - b);
    const worstDay = sorted[0]; const bestDay = sorted[sorted.length - 1];
    if (worstDay && bestDay && bestDay[1] > worstDay[1] * 2) {
      insights.push({ type: 'day_of_week_pattern', title: `${worstDay[0]} is your weak day`, message: `You consistently skip gym on ${worstDay[0]}s (${worstDay[1]} workouts vs ${bestDay[1]} on ${bestDay[0]}s).`, recommendation: `Plan something specific for ${worstDay[0]} — even a 20-min session breaks the pattern.`, impact: 'medium' });
    }
  }

  if (dietLogs.length > 7) {
    const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
    const proteinTarget = user?.dailyProteinTarget || 140;
    const hitDays = dietLogs.filter(d => d.totalProteinG >= proteinTarget * 0.9).length;
    const hitRate = hitDays / dietLogs.length;
    insights.push({ type: 'protein_consistency', title: 'Protein target consistency', message: `You hit your protein target on ${Math.round(hitRate * 100)}% of tracked days (${hitDays}/${dietLogs.length}).`, recommendation: hitRate < 0.7 ? 'Add a protein-rich snack between meals — curd, eggs, or paneer work.' : 'Solid protein consistency — keep it up.', impact: hitRate < 0.7 ? 'high' : 'low' });
  }

  let gymStreak = 0;
  for (const log of habitLogs) { if (log.gym) gymStreak++; else break; }
  if (gymStreak >= 5) {
    insights.push({ type: 'streak_momentum', title: `${gymStreak}-day gym streak — protect it!`, message: `You're on a ${gymStreak}-day gym streak. This is rare — most people break at day 7.`, recommendation: "Don't skip tomorrow even for 20 minutes. Streaks compound.", impact: 'high' });
  }

  return { insights, generatedAt: new Date() };
}

module.exports = { getDashboard, getScoreBreakdown, getTrends, getInsights, getProactiveInsights, getCorrelationInsights };
