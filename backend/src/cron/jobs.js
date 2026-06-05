const cron = require('node-cron');
const reports = require('../services/reports');
const telegram = require('../services/telegram');
const prisma = require('../lib/prisma');

async function detectAndSendPatternNudges() {
  const users = await prisma.user.findMany({
    select: { id: true, telegramChatId: true, weightKg: true, targetWeightKg: true, dailyProteinTarget: true }
  }).catch(() => []);

  for (const user of users) {
    if (!user.telegramChatId) continue;
    try {
      const nudges = await buildPatternNudges(user);
      if (nudges.length > 0) {
        await telegram.sendPatternNudge(user.telegramChatId, nudges);
      }
    } catch (e) { console.error(`Pattern nudge error for user ${user.id}:`, e.message); }
  }
}

async function buildPatternNudges(user) {
  const nudges = [];
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const [habitLogs, sleepLogs, dietLogs, workoutLogs] = await Promise.all([
    prisma.habitLog.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 30 }).catch(() => []),
    prisma.sleepLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 14 }).catch(() => []),
    prisma.dietLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 14 }).catch(() => []),
    prisma.workoutLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 30 }).catch(() => []),
  ]);

  // Pattern 1: Gym skip streak
  let gymMissStreak = 0;
  for (const l of habitLogs) { if (!l.gym) gymMissStreak++; else break; }
  if (gymMissStreak >= 3) {
    nudges.push({ priority: 'high', emoji: '💪', message: `${gymMissStreak} days without gym. Longest streak you've gone without it. Even 20 min today resets the pattern.` });
  }

  // Pattern 2: Day-of-week gym skip pattern
  const dayGymMap = {};
  habitLogs.forEach(h => {
    const day = new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!dayGymMap[day]) dayGymMap[day] = { total: 0, gym: 0 };
    dayGymMap[day].total++;
    if (h.gym) dayGymMap[day].gym++;
  });
  const todayData = dayGymMap[dayOfWeek];
  if (todayData && todayData.total >= 3 && todayData.gym / todayData.total < 0.25) {
    nudges.push({ priority: 'medium', emoji: '📅', message: `${dayOfWeek} is your weakest gym day (${Math.round(todayData.gym/todayData.total*100)}% attendance). Break the pattern today!` });
  }

  // Pattern 3: Sleep degradation trend
  if (sleepLogs.length >= 5) {
    const recent3 = sleepLogs.slice(0, 3).reduce((a, s) => a + s.durationHours, 0) / 3;
    const prev5Slice = sleepLogs.slice(3, 8);
    const prev5 = prev5Slice.length > 0 ? prev5Slice.reduce((a, s) => a + s.durationHours, 0) / prev5Slice.length : 0;
    if (prev5 > 0 && recent3 < prev5 - 0.5) {
      nudges.push({ priority: 'high', emoji: '😴', message: `Sleep dropping: avg ${recent3.toFixed(1)}hrs last 3 nights vs ${prev5.toFixed(1)}hrs before. This is silently killing your gym performance.` });
    }
    if (recent3 < 6.5) {
      nudges.push({ priority: 'high', emoji: '🚨', message: `Averaging ${recent3.toFixed(1)}hrs sleep. Under 7hrs = 30% less muscle recovery. Set a 10pm bedtime alarm tonight.` });
    }
  }

  // Pattern 4: Protein consistency
  const proteinTarget = user.dailyProteinTarget || 140;
  if (dietLogs.length >= 5) {
    const avgProtein = dietLogs.reduce((a, d) => a + d.totalProteinG, 0) / dietLogs.length;
    const hitRate = dietLogs.filter(d => d.totalProteinG >= proteinTarget * 0.9).length / dietLogs.length;
    if (hitRate < 0.5) {
      const gap = Math.round(proteinTarget - avgProtein);
      nudges.push({ priority: 'medium', emoji: '🥩', message: `Hitting protein target only ${Math.round(hitRate*100)}% of days. Avg ${Math.round(avgProtein)}g vs ${proteinTarget}g target. Add curd or eggs to close the ${gap}g gap.` });
    }
  }

  // Pattern 5: Weight stall for 2+ weeks
  const recentWeights = await prisma.weightLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' }, take: 14 }).catch(() => []);
  if (recentWeights.length >= 14) {
    const recent7 = recentWeights.slice(0, 7);
    const prev7 = recentWeights.slice(7, 14);
    const recentAvg = recent7.reduce((a, w) => a + w.weightKg, 0) / recent7.length;
    const prevAvg = prev7.reduce((a, w) => a + w.weightKg, 0) / prev7.length;
    if (prevAvg > 0 && Math.abs(recentAvg - prevAvg) < 0.3 && user.targetWeightKg && Math.abs(recentAvg - user.targetWeightKg) > 2) {
      nudges.push({ priority: 'medium', emoji: '⚖️', message: `Weight stuck at ~${recentAvg.toFixed(1)}kg for 2 weeks. Consider adjusting calories by 100-150kcal to break the plateau.` });
    }
  }

  // Pattern 6: Study gap
  const lastStudy = await prisma.studyLog.findFirst({ where: { userId: user.id }, orderBy: { loggedAt: 'desc' } }).catch(() => null);
  if (lastStudy) {
    const daysSince = Math.floor((Date.now() - new Date(lastStudy.loggedAt).getTime()) / 86400000);
    if (daysSince >= 5) {
      nudges.push({ priority: 'medium', emoji: '📚', message: `${daysSince} days without studying ${lastStudy.topic}. Even 15 minutes today maintains momentum.` });
    }
  }

  // Return max 3 nudges, highest priority first
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return nudges.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 3);
}

function initCronJobs() {
  // Sunday 8pm — auto-generate weekly reports for all users
  cron.schedule('0 20 * * 0', async () => {
    console.log('Running auto weekly reports...');
    try {
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        await reports.generateWeeklyReport(user.id).catch(console.error);
      }
      console.log(`Auto-generated weekly reports for ${users.length} users`);
    } catch (e) { console.error('Weekly report cron error:', e); }
  });

  // Daily 7am — morning check-ins via Telegram
  cron.schedule('0 7 * * *', () => {
    telegram.sendMorningCheckins().catch(console.error);
  });

  // Daily 9am — pattern-based nudges (not generic)
  cron.schedule('0 9 * * *', () => {
    detectAndSendPatternNudges().catch(console.error);
  });

  // Daily 8pm — evening habit nudges
  cron.schedule('0 20 * * *', () => {
    telegram.sendEveningNudges().catch(console.error);
  });

  // Sunday 9am — weekly planning session
  cron.schedule('0 9 * * 0', () => {
    telegram.sendWeeklyPlanning().catch(console.error);
  });

  // Hourly — water reminders (7am–11pm)
  cron.schedule('0 * * * *', () => {
    telegram.sendWaterReminders().catch(console.error);
  });

  console.log('Cron jobs initialized');
}

module.exports = { initCronJobs };
