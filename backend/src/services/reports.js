const prisma = require('../lib/prisma');
const ai = require('./ai');
const anthropic = require('../lib/anthropic');
const cache = require('../lib/cache');
const { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } = require('../data/safe-select');

const HAIKU = 'claude-haiku-4-5-20251001';

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

// Check this week's life scores vs last week. If no improvement (delta < 5),
// generate an AI-adapted plan targeting weak areas and store it in AIMemory.
// Result is cached 6h per user so it doesn't re-run on every dashboard load.
async function checkProgressAndAdapt(userId) {
  const cacheKey = `progress_check:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);

  const [thisWeekScores, lastWeekScores] = await Promise.all([
    prisma.lifeScore.findMany({ where: { userId, date: { gte: weekAgo } } }),
    prisma.lifeScore.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: weekAgo } } }),
  ]);

  if (thisWeekScores.length < 3 || lastWeekScores.length < 3) {
    const result = { status: 'insufficient_data', adaptedPlan: null };
    await cache.set(cacheKey, result, 6 * 3600);
    return result;
  }

  const avg = (arr, key) => Math.round(arr.reduce((s, x) => s + (x[key] || 0), 0) / arr.length);
  const thisOverall = avg(thisWeekScores, 'overall');
  const lastOverall = avg(lastWeekScores, 'overall');
  const delta = thisOverall - lastOverall;

  const scoreKeys = ['fitness', 'sleep', 'discipline', 'career'];
  const weakAreas = scoreKeys.filter(k => avg(thisWeekScores, k) < 50);

  if (delta >= 5) {
    const result = { status: 'improving', delta, thisOverall, lastOverall, adaptedPlan: null, weakAreas };
    await cache.set(cacheKey, result, 24 * 3600);
    return result;
  }

  // Already have a recent (< 7 days) plan adaptation? Return it without re-generating.
  const existing = await prisma.aIMemory.findUnique({
    where: { userId_memoryType: { userId, memoryType: 'WEEKLY_REVIEW' } },
  });

  if (existing?.content?.plan) {
    const adaptedAt = new Date(existing.content.adaptedAt || 0);
    const daysSince = (now.getTime() - adaptedAt.getTime()) / (1000 * 3600 * 24);
    if (daysSince < 7) {
      const result = {
        status: 'stagnant',
        delta,
        thisOverall,
        lastOverall,
        adaptedPlan: existing.content.plan,
        seen: existing.content.seen || false,
        weakAreas,
      };
      await cache.set(cacheKey, result, 6 * 3600);
      return result;
    }
  }

  // Generate new adaptive plan via AI
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, primaryGoal: true },
  });
  const weakStr = weakAreas.join(', ') || 'overall consistency';

  let plan = '';
  try {
    const response = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are an AI life coach. This user's life scores have NOT improved for a week (${lastOverall}→${thisOverall}/100).

Weak areas: ${weakStr}
Goal: ${user?.primaryGoal || 'lean_bulk'}
Name: ${user?.name || 'there'}

Generate a REVISED adaptive plan to break the plateau. Be specific and actionable. Plain text only.

Format exactly like this:
🎯 WHY YOU'RE STAGNANT: [1-2 sentences identifying the root cause]

🔄 REVISED PLAN FOR NEXT 7 DAYS:
• Fitness: [specific change from current approach]
• Sleep: [specific bedtime/routine action]
• Discipline: [1 keystone habit to anchor the week]
• Career: [specific study goal with hours/topic]

⚡ THE ONE THING: [Single highest-leverage action this week]`,
      }],
    });
    plan = response.content[0].text.trim();
  } catch (e) {
    console.error('Plan adaptation AI failed:', e.message);
    plan = `Your scores haven't improved this week (${thisOverall} vs ${lastOverall} last week).\n\n🎯 WHY YOU'RE STAGNANT: The current approach isn't creating enough consistency in: ${weakStr}.\n\n🔄 REVISED PLAN: Pick ONE area from [${weakStr}] and commit to a non-negotiable daily action for 7 days. Consistency beats intensity this week.\n\n⚡ THE ONE THING: Show up every day, even for just 10 minutes.`;
  }

  // Persist in AIMemory (upsert — one WEEKLY_REVIEW record per user)
  await prisma.aIMemory.upsert({
    where: { userId_memoryType: { userId, memoryType: 'WEEKLY_REVIEW' } },
    update: { content: { plan, adaptedAt: now.toISOString(), seen: false, weakAreas, delta, thisOverall, lastOverall } },
    create: {
      userId,
      memoryType: 'WEEKLY_REVIEW',
      content: { plan, adaptedAt: now.toISOString(), seen: false, weakAreas, delta, thisOverall, lastOverall },
    },
  });

  const result = { status: 'stagnant', delta, thisOverall, lastOverall, adaptedPlan: plan, seen: false, weakAreas };
  await cache.set(cacheKey, result, 6 * 3600);
  return result;
}

// Mark the current plan update as seen so the banner no longer shows.
async function dismissPlanUpdate(userId) {
  const existing = await prisma.aIMemory.findUnique({
    where: { userId_memoryType: { userId, memoryType: 'WEEKLY_REVIEW' } },
  });
  if (!existing) return;
  await prisma.aIMemory.update({
    where: { id: existing.id },
    data: { content: { ...existing.content, seen: true } },
  });
  // Clear cache so next dashboard load reflects the dismissed state
  await cache.del(`progress_check:${userId}`);
}

module.exports = {
  generateWeeklyReport,
  getReports,
  getLatestReport,
  checkProgressAndAdapt,
  dismissPlanUpdate,
};
