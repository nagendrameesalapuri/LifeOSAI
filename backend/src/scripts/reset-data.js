// One-time data reset — deletes all logs/history but keeps the User profile.
require('dotenv').config();
const prisma = require('../lib/prisma');

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'nagendra' } },
  });
  if (!user) { console.error('User not found'); process.exit(1); }
  console.log(`Resetting data for: ${user.name} (${user.email})`);

  const id = user.id;

  // Delete in safe order (children before parents)
  const results = {};
  results.workoutSession  = await prisma.workoutSession.deleteMany({ where: { program: { userId: id } } });
  results.workoutProgram  = await prisma.workoutProgram.deleteMany({ where: { userId: id } });
  results.weightLog       = await prisma.weightLog.deleteMany({ where: { userId: id } });
  results.workoutLog      = await prisma.workoutLog.deleteMany({ where: { userId: id } });
  results.sleepLog        = await prisma.sleepLog.deleteMany({ where: { userId: id } });
  results.habitLog        = await prisma.habitLog.deleteMany({ where: { userId: id } });
  results.dietLog         = await prisma.dietLog.deleteMany({ where: { userId: id } });
  results.studyLog        = await prisma.studyLog.deleteMany({ where: { userId: id } });
  results.englishLog      = await prisma.englishLog.deleteMany({ where: { userId: id } });
  results.kannadaLog      = await prisma.kannadaLog.deleteMany({ where: { userId: id } });
  results.bodyMeasurement = await prisma.bodyMeasurement.deleteMany({ where: { userId: id } });
  results.vocabularyCard  = await prisma.vocabularyCard.deleteMany({ where: { userId: id } });
  results.errorPattern    = await prisma.errorPattern.deleteMany({ where: { userId: id } });
  results.lifeScore       = await prisma.lifeScore.deleteMany({ where: { userId: id } });
  results.weeklyReport    = await prisma.weeklyReport.deleteMany({ where: { userId: id } });
  results.morningCheckin  = await prisma.morningCheckin.deleteMany({ where: { userId: id } });
  results.dailyLesson     = await prisma.dailyLesson.deleteMany({ where: { userId: id } });

  // Reset AI memories — keep USER_PROFILE and CAREER so AI still knows who you are
  results.aiMemory = await prisma.aIMemory.deleteMany({
    where: { userId: id, memoryType: { in: ['HABIT', 'FITNESS', 'WEEKLY_REVIEW'] } },
  });

  console.log('\n✅ Deleted:');
  Object.entries(results).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v.count}`));
  console.log('\n✅ Kept: User profile, USER_PROFILE memory, CAREER memory, LEARNING memory');
  console.log('\nFresh start. Go get it 💪');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
