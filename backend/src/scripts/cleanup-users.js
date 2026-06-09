// Delete all users EXCEPT nagendrameesala83@gmail.com and all their data
require('dotenv').config();
const prisma = require('../lib/prisma');

const KEEP_EMAIL = 'nagendrameesala83@gmail.com';

async function main() {
  const keepUser = await prisma.user.findUnique({ where: { email: KEEP_EMAIL } });
  if (!keepUser) { console.error(`User ${KEEP_EMAIL} not found in DB`); process.exit(1); }
  console.log(`Keeping: ${keepUser.name} (${keepUser.email})`);

  const othersToDelete = await prisma.user.findMany({
    where: { email: { not: KEEP_EMAIL } },
    select: { id: true, email: true, name: true },
  });

  if (othersToDelete.length === 0) {
    console.log('No other users to delete.');
    return;
  }

  console.log(`\nDeleting ${othersToDelete.length} other user(s):`);
  othersToDelete.forEach(u => console.log(`  - ${u.email} (${u.name})`));

  const otherIds = othersToDelete.map(u => u.id);

  // Delete all their data first (children before parents)
  await prisma.workoutSession.deleteMany({ where: { program: { userId: { in: otherIds } } } });
  await prisma.workoutProgram.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.weightLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.workoutLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.sleepLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.habitLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.dietLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.studyLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.englishLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.kannadaLog.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.bodyMeasurement.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.vocabularyCard.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.errorPattern.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.lifeScore.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.weeklyReport.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.morningCheckin.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.dailyLesson.deleteMany({ where: { userId: { in: otherIds } } });
  await prisma.aIMemory.deleteMany({ where: { userId: { in: otherIds } } });

  const deleted = await prisma.user.deleteMany({ where: { id: { in: otherIds } } });
  console.log(`\n✅ Deleted ${deleted.count} user(s) and all their data.`);
  console.log(`✅ Kept: ${KEEP_EMAIL}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
