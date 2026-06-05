const prisma = require('../lib/prisma');
const { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } = require('../data/safe-select');

const contextCache = new Map(); // userId → { context, expiresAt }
const CONTEXT_TTL_MS = 5 * 60 * 1000;

const SAFE_USER_SELECT = {
  id: true, name: true, weightKg: true, targetWeightKg: true,
  heightCm: true, age: true, profession: true,
  tdeeKcal: true, dailyProteinTarget: true, dailyCalorieTarget: true,
  gymDaysPerWeek: true, primaryGoal: true, gymAccess: true, fitnessLevel: true,
  activityLevel: true, careerGoal: true, careerGoalCustom: true,
  languageGoals: true, nativeLanguage: true,
};

function getCareerLabel(careerGoal, customGoal, profession) {
  const labels = {
    devops: 'DevOps/Cloud Engineer (in transition)',
    data_engineering: 'Data Engineer (in transition)',
    frontend: 'Frontend Engineer (in transition)',
    backend: 'Backend Engineer (in transition)',
    ai_ml: 'AI/ML Engineer (in transition)',
  };
  if (careerGoal === 'custom' && customGoal) return customGoal;
  if (careerGoal && labels[careerGoal]) return profession ? `${profession} → ${labels[careerGoal]}` : labels[careerGoal];
  return profession || 'Professional';
}

function getDaysSinceGym(workouts) {
  if (!workouts.length) return 'unknown';
  const days = Math.floor((Date.now() - new Date(workouts[0].loggedAt).getTime()) / (1000 * 60 * 60 * 24));
  return `${days} days`;
}

function getConsecutiveLowSleep(sleepLogs) {
  let count = 0;
  for (const log of sleepLogs) {
    if (log.durationHours < 7) count++;
    else break;
  }
  return count;
}

async function getContextualMemory(userId) {
  const cached = contextCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.context;

  let user;
  try {
    user = await prisma.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT });
  } catch {
    user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, weightKg: true, targetWeightKg: true, heightCm: true, age: true, profession: true } });
  }

  const [memories, recentHabits, recentWorkouts, recentSleep, recentStudy, recentDiet, weightLogs] = await Promise.all([
    prisma.aIMemory.findMany({ where: { userId } }),
    prisma.habitLog.findMany({ where: { userId }, take: 14, orderBy: { date: 'desc' } }),
    prisma.workoutLog.findMany({ where: { userId }, take: 10, orderBy: { loggedAt: 'desc' }, select: SAFE_WORKOUT_SELECT }),
    prisma.sleepLog.findMany({ where: { userId }, take: 14, orderBy: { loggedAt: 'desc' } }),
    prisma.studyLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' } }),
    prisma.dietLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' }, select: SAFE_DIET_SELECT }),
    prisma.weightLog.findMany({ where: { userId }, take: 30, orderBy: { loggedAt: 'desc' } }),
  ]);

  const careerGoalLabel = getCareerLabel(user?.careerGoal, user?.careerGoalCustom, user?.profession);
  const langGoals = user?.languageGoals || [];
  const nativeLang = user?.nativeLanguage || 'unknown';

  const profileMem = memories.find(m => m.memoryType === 'USER_PROFILE');
  const profileData = profileMem?.content || {};

  const gymDays7 = recentHabits.slice(0, 7).filter(h => h.gym).length;
  const gymDays14 = recentHabits.filter(h => h.gym).length;
  const avgSleep7 = recentSleep.slice(0, 7).length
    ? (recentSleep.slice(0, 7).reduce((a, s) => a + s.durationHours, 0) / recentSleep.slice(0, 7).length).toFixed(1)
    : 'not logged';
  const avgProtein7 = recentDiet.length
    ? Math.round(recentDiet.reduce((a, d) => a + d.totalProteinG, 0) / recentDiet.length)
    : 'not logged';
  const avgCalories7 = recentDiet.length
    ? Math.round(recentDiet.reduce((a, d) => a + d.totalCalories, 0) / recentDiet.length)
    : 'not logged';

  const dayFrequency = {};
  recentHabits.forEach(h => {
    const day = new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!dayFrequency[day]) dayFrequency[day] = { total: 0, gym: 0 };
    dayFrequency[day].total++;
    if (h.gym) dayFrequency[day].gym++;
  });
  const weakDays = Object.entries(dayFrequency)
    .filter(([, v]) => v.total >= 2 && v.gym / v.total < 0.3)
    .map(([day]) => day);

  const recentSleepAvg = recentSleep.slice(0, 3).length
    ? recentSleep.slice(0, 3).reduce((a, s) => a + s.durationHours, 0) / recentSleep.slice(0, 3).length
    : 0;
  const sleepAlert = recentSleepAvg > 0 && recentSleepAvg < 6 ? '⚠️ CRITICAL: Under 6hrs sleep 3 nights in a row' : '';

  const recentWeight = weightLogs.slice(0, 7);
  const avgWeight7 = recentWeight.length
    ? (recentWeight.reduce((a, w) => a + w.weightKg, 0) / recentWeight.length).toFixed(1)
    : user?.weightKg || 62;

  const proteinTarget = user?.dailyProteinTarget || 140;
  const proteinGap = typeof avgProtein7 === 'number' ? Math.round(proteinTarget - avgProtein7) : null;
  const calorieTarget = user?.dailyCalorieTarget || 2800;

  const englishMem = memories.find(m => m.memoryType === 'LEARNING');
  const careerMem = memories.find(m => m.memoryType === 'CAREER');
  const englishData = englishMem?.content || {};
  const careerData = careerMem?.content || {};

  const commChallenges = profileData.communicationChallenges || englishData.challenges || [];
  const languageSection = langGoals.length > 0 ? `
LANGUAGE LEARNING (native: ${nativeLang}):
${langGoals.includes('english') ? `- English goal: Professional fluency and confidence
  Challenges: ${commChallenges.length ? commChallenges.join(', ') : 'building confidence'}
  Progress: corrections done: ${englishData.totalCorrections || 0} | grammar trend: ${(englishData.grammarScoreTrend || []).slice(-3).join(' → ') || 'not assessed'}
  Recent mistakes: ${(englishData.commonMistakes || []).slice(0, 3).join(', ') || 'none logged'}` : ''}
${langGoals.includes('kannada') ? `- Kannada goal: Conversational for daily life and workplace` : ''}` : `
LANGUAGE LEARNING: not tracking any language goals`;

  const context = `
=== LIFEOS MEMORY CONTEXT ===
User: ${user?.name || 'User'} | ${careerGoalLabel}
Current weight: ${user?.weightKg || '?'}kg (7-day avg: ${avgWeight7}kg) | Target: ${user?.targetWeightKg || '?'}kg | Goal: ${user?.primaryGoal || 'lean_bulk'}
Height: ${user?.heightCm || '?'}cm | Age: ${user?.age || '?'}
TDEE: ${user?.tdeeKcal || 2600} kcal | Calorie target: ${calorieTarget} kcal | Protein target: ${proteinTarget}g
Gym days/week goal: ${user?.gymDaysPerWeek || 4} | Equipment: ${user?.gymAccess || 'commercial'} gym | Level: ${user?.fitnessLevel || 'intermediate'}

LAST 7 DAYS PERFORMANCE:
- Gym attendance: ${gymDays7}/7 days ${gymDays7 < 3 ? '(POOR)' : gymDays7 < 5 ? '(AVERAGE)' : '(GOOD)'}
- 14-day gym total: ${gymDays14}/14 days
- Average sleep: ${avgSleep7} hours ${sleepAlert}
- Average protein: ${avgProtein7}g/day (target: ${proteinTarget}g | ${proteinGap !== null ? `${proteinGap}g short` : 'not tracked'})
- Average calories: ${avgCalories7}/day (target: ${calorieTarget})
- Study sessions: ${recentStudy.length} in last 7 days

DETECTED PATTERNS:
- Weak gym days: ${weakDays.length > 0 ? weakDays.join(', ') : 'none detected yet'}
- Sleep trend: ${recentSleepAvg > 0 ? `${recentSleepAvg.toFixed(1)}hrs avg last 3 nights` : 'not enough data'}
- Last workout: ${recentWorkouts[0] ? `${recentWorkouts[0].type} on ${new Date(recentWorkouts[0].loggedAt).toLocaleDateString()}` : 'not logged recently'}

${languageSection}

CAREER:
- Transition: ${user?.profession || 'Engineer'} → ${careerGoalLabel}
- Skills being learned: ${(careerData.learningPath || []).join(', ') || 'not specified'}
- Current topic: ${careerData.currentTopic || recentStudy[0]?.topic || 'not started'}
- Topics completed: ${(careerData.completedTopics || []).join(', ') || 'none yet'}
- Total study hours: ${careerData.totalHours || 0}hrs
- Last study session: ${recentStudy[0] ? `${recentStudy[0].topic} (${recentStudy[0].durationMin} min)` : 'none recent'}

RECURRING CHALLENGES:
- Days since last gym: ${getDaysSinceGym(recentWorkouts)}
- Consecutive low-sleep nights: ${getConsecutiveLowSleep(recentSleep)}
- Protein deficit streak: ${proteinGap && proteinGap > 30 ? `${recentDiet.length} days averaging ${proteinGap}g below target` : 'within range'}

Use this context to personalize ALL responses. Reference specific numbers. Call out patterns.
=== END CONTEXT ===`;

  contextCache.set(userId, { context, expiresAt: Date.now() + CONTEXT_TTL_MS });
  return context;
}

function invalidateContextCache(userId) {
  contextCache.delete(userId);
}

async function updateMemory(userId, type, newData) {
  invalidateContextCache(userId);
  const existing = await prisma.aIMemory.findUnique({
    where: { userId_memoryType: { userId, memoryType: type } },
  });

  let merged = newData;
  if (existing) {
    const prev = existing.content || {};
    merged = { ...prev };
    for (const key of Object.keys(newData)) {
      if (Array.isArray(prev[key]) && Array.isArray(newData[key])) {
        merged[key] = [...new Set([...prev[key], ...newData[key]])].slice(-50);
      } else {
        merged[key] = newData[key];
      }
    }
  }

  await prisma.aIMemory.upsert({
    where: { userId_memoryType: { userId, memoryType: type } },
    update: { content: merged, updatedAt: new Date() },
    create: { userId, memoryType: type, content: merged },
  });
}

async function updateEnglishMemory(userId, mistake) {
  const existing = await prisma.aIMemory.findUnique({
    where: { userId_memoryType: { userId, memoryType: 'LEARNING' } },
  });
  const content = existing?.content || { commonMistakes: [], grammarScoreTrend: [], totalCorrections: 0 };

  if (mistake.mistakes?.length > 0) {
    const types = mistake.mistakes.map(m => m.type);
    content.commonMistakes = [...new Set([...content.commonMistakes, ...types])].slice(-20);
    content.totalCorrections = (content.totalCorrections || 0) + mistake.mistakes.length;
    if (!content.mistakeCounts) content.mistakeCounts = {};
    types.forEach(t => { content.mistakeCounts[t] = (content.mistakeCounts[t] || 0) + 1; });
  }
  content.grammarScoreTrend = [...(content.grammarScoreTrend || []), mistake.grammarScore].slice(-10);

  await prisma.aIMemory.upsert({
    where: { userId_memoryType: { userId, memoryType: 'LEARNING' } },
    update: { content },
    create: { userId, memoryType: 'LEARNING', content },
  });
}

async function updateCareerMemory(userId, studyLog) {
  const existing = await prisma.aIMemory.findUnique({
    where: { userId_memoryType: { userId, memoryType: 'CAREER' } },
  });
  const content = existing?.content || { currentTopic: 'Docker', completedTopics: [], totalHours: 0, topicsProgress: {} };

  content.currentTopic = studyLog.topic;
  content.totalHours = (content.totalHours || 0) + Math.round(studyLog.durationMin / 60);
  if (!content.topicsProgress[studyLog.topic]) content.topicsProgress[studyLog.topic] = 0;
  content.topicsProgress[studyLog.topic] += studyLog.durationMin;

  await prisma.aIMemory.upsert({
    where: { userId_memoryType: { userId, memoryType: 'CAREER' } },
    update: { content },
    create: { userId, memoryType: 'CAREER', content },
  });
}

module.exports = { getContextualMemory, invalidateContextCache, updateMemory, updateEnglishMemory, updateCareerMemory };
