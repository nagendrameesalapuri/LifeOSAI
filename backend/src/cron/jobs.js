const cron = require('node-cron');
const reports = require('../services/reports');
const telegram = require('../services/telegram');
const prisma = require('../lib/prisma');

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

  // Daily 7am — morning check-ins
  cron.schedule('0 7 * * *', () => {
    telegram.sendMorningCheckins().catch(console.error);
  });

  // Daily 8pm — evening nudges
  cron.schedule('0 20 * * *', () => {
    telegram.sendEveningNudges().catch(console.error);
  });

  // Sunday 9am — weekly planning
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
