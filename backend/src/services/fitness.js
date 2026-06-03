const prisma = require('../lib/prisma');
const ai = require('./ai');
const { SAFE_WORKOUT_SELECT } = require('../data/safe-select');

async function logWeight(userId, data) {
  const log = await prisma.weightLog.create({ data: { userId, weightKg: data.weightKg, note: data.note } });
  await prisma.user.update({ where: { id: userId }, data: { weightKg: data.weightKg } });
  return log;
}

async function getWeightHistory(userId) {
  const logs = await prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' } });
  return logs.map((log, idx) => {
    const window = logs.slice(Math.max(0, idx - 6), idx + 1);
    const avg = window.reduce((a, l) => a + l.weightKg, 0) / window.length;
    return { ...log, movingAvg7: Math.round(avg * 10) / 10 };
  });
}

async function logWorkout(userId, data) {
  return prisma.workoutLog.create({
    data: {
      userId, type: data.type, exercises: data.exercises,
      durationMin: data.durationMin, proteinG: data.proteinG,
      caloriesBurned: data.caloriesBurned, notes: data.notes,
      ...(data.sorenessLevel != null ? { sorenessLevel: data.sorenessLevel } : {}),
      ...(data.progressNote ? { progressNote: data.progressNote } : {}),
    },
  });
}

async function getWorkoutHistory(userId) {
  return prisma.workoutLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30, select: SAFE_WORKOUT_SELECT });
}

async function getWorkoutPlan(userId) {
  return ai.generateWorkoutPlan(userId);
}

async function generateProgram(userId) {
  try {
    const program = await ai.generateWorkoutProgram(userId);
    if (!program || program.error) return { error: 'Could not generate program', details: program };

    if (!prisma.workoutProgram) {
      return { program: null, details: program, message: 'Run database migration first: npx prisma db push' };
    }

    const savedProgram = await prisma.workoutProgram.create({
      data: { userId, name: program.programName || 'My Program', split: program.split || 'PPL', daysPerWeek: program.daysPerWeek || 4, weekDuration: 12 },
    });

    if (program.sessions && Array.isArray(program.sessions)) {
      for (const session of program.sessions) {
        for (let week = 1; week <= 12; week++) {
          const progressedExercises = (session.exercises || []).map(ex => {
            const weekIncrement = (week - 1) * (ex.progressionPerWeek || 0);
            const phase = week <= 4 ? 'foundation' : week <= 8 ? 'build' : week <= 11 ? 'peak' : 'deload';
            const deloadMultiplier = phase === 'deload' ? 0.6 : 1;
            const targetWeight = ex.week1TargetKg != null
              ? Math.round((ex.week1TargetKg + weekIncrement) * deloadMultiplier * 2) / 2 : null;
            return {
              ...ex, weekNumber: week, targetWeightKg: targetWeight, phase,
              repsRange: phase === 'peak' && ex.repsRange
                ? ex.repsRange.replace(/\d+/g, n => String(Math.max(1, parseInt(n) - 2))) : ex.repsRange,
              progressionNote: targetWeight != null
                ? `Week ${week} target: ${targetWeight}kg${phase === 'deload' ? ' (deload week — 60% intensity)' : ''}` : undefined,
            };
          });
          await prisma.workoutSession.create({
            data: { programId: savedProgram.id, weekNumber: week, dayLabel: session.dayLabel, splitType: session.splitType, exercises: progressedExercises },
          });
        }
      }
    }
    return { program: savedProgram, details: program };
  } catch (e) {
    console.error('generateProgram error:', e);
    return { error: 'Database migration required. Run: npx prisma db push' };
  }
}

async function getActiveProgram(userId) {
  try {
    if (!prisma.workoutProgram) return null;
    const program = await prisma.workoutProgram.findFirst({
      where: { userId, isActive: true },
      include: { sessions: { orderBy: { weekNumber: 'asc' } } },
    });
    if (!program) return null;

    const daysSinceStart = Math.floor((Date.now() - program.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.min(Math.ceil(daysSinceStart / 7) + 1, program.weekDuration);
    const currentWeekSessions = program.sessions.filter(s => s.weekNumber === currentWeek);
    const completedSessions = program.sessions.filter(s => s.completed && s.weekNumber === currentWeek);

    return {
      ...program, currentWeek, currentWeekSessions,
      completedSessions: completedSessions.length, totalWeekSessions: currentWeekSessions.length,
      weekProgress: Math.round((daysSinceStart / (program.weekDuration * 7)) * 100),
    };
  } catch (e) { return null; }
}

async function completeSession(userId, sessionId, actualLog) {
  if (!prisma.workoutSession) throw new Error('Migration required');
  const session = await prisma.workoutSession.findUnique({ where: { id: sessionId }, include: { program: true } });
  if (!session || session.program.userId !== userId) throw new Error('Session not found');
  return prisma.workoutSession.update({ where: { id: sessionId }, data: { completed: true, completedAt: new Date(), actualLog } });
}

async function getProgressiveOverload(userId, exerciseName) {
  const workouts = await prisma.workoutLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 });
  const history = workouts.map(w => {
    const exercises = w.exercises;
    const ex = Array.isArray(exercises) ? exercises.find(e => e.name?.toLowerCase() === exerciseName.toLowerCase()) : null;
    if (!ex) return null;
    return { date: w.loggedAt, sets: ex.sets, reps: ex.reps, weightKg: ex.weightKg || 0, volume: (ex.sets || 0) * (ex.reps || 0) * (ex.weightKg || 0) };
  }).filter(Boolean);

  const recommendation = history.length > 0 ? getOverloadRecommendation(history) : null;
  return { history, recommendation };
}

function getOverloadRecommendation(history) {
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (!prev) return `First session recorded at ${last.weightKg}kg × ${last.reps} reps`;
  if (last.weightKg > prev.weightKg) return `Progress! ${prev.weightKg}kg → ${last.weightKg}kg. Next: aim for ${last.weightKg + 2.5}kg`;
  return `Stuck at ${last.weightKg}kg. Add 1-2 reps before increasing weight`;
}

async function logBodyMeasurement(userId, data) {
  try {
    if (!prisma.bodyMeasurement) return { error: 'Run database migration first: npx prisma db push' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { weightKg: true, heightCm: true } });
    let ffmi;
    if (data.bodyFatPct && user?.heightCm && user?.weightKg) {
      const leanMassKg = user.weightKg * (1 - data.bodyFatPct / 100);
      const heightM = user.heightCm / 100;
      ffmi = Math.round((leanMassKg / (heightM * heightM)) * 10) / 10;
    }
    return prisma.bodyMeasurement.create({
      data: { userId, chestCm: data.chestCm, waistCm: data.waistCm, hipCm: data.hipCm, leftArmCm: data.leftArmCm, rightArmCm: data.rightArmCm, leftLegCm: data.leftLegCm, rightLegCm: data.rightLegCm, bodyFatPct: data.bodyFatPct, ffmi, notes: data.notes },
    });
  } catch (e) { return { error: 'Database migration required' }; }
}

async function getBodyMeasurements(userId) {
  try {
    if (!prisma.bodyMeasurement) return [];
    return prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 20 });
  } catch { return []; }
}

async function getFitnessStats(userId) {
  const [weightLogs, workoutLogs, user] = await Promise.all([
    prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 }),
    prisma.workoutLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 }),
    prisma.user.findUnique({ where: { id: userId }, select: { weightKg: true, targetWeightKg: true, heightCm: true, age: true } }),
  ]);

  let lastMeasurement = null;
  try { if (prisma.bodyMeasurement) lastMeasurement = await prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } }); } catch {}

  const last30DaysWorkouts = workoutLogs.filter(w => new Date(w.loggedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const recentWeights = weightLogs.slice(0, 7);
  const movingAvg7 = recentWeights.length ? Math.round(recentWeights.reduce((a, w) => a + w.weightKg, 0) / recentWeights.length * 10) / 10 : user?.weightKg || 62;
  const gymDaysPerWeek = user?.gymDaysPerWeek ?? 4;
  const targetWorkouts = gymDaysPerWeek * 4;
  const fitnessScore = Math.min(100, Math.round((last30DaysWorkouts.length / targetWorkouts) * 100));

  let ffmi;
  if (lastMeasurement?.bodyFatPct && user?.heightCm && user?.weightKg) {
    const leanMassKg = user.weightKg * (1 - lastMeasurement.bodyFatPct / 100);
    const heightM = user.heightCm / 100;
    ffmi = Math.round((leanMassKg / (heightM * heightM)) * 10) / 10;
  }

  return {
    currentWeight: user?.weightKg, movingAvg7, targetWeight: user?.targetWeightKg,
    weightProgress: weightLogs.length > 1 ? Math.round((weightLogs[0].weightKg - weightLogs[weightLogs.length - 1].weightKg) * 10) / 10 : 0,
    workoutsThisMonth: last30DaysWorkouts.length, fitnessScore, weightHistory: weightLogs,
    ffmi, deloadRecommended: workoutLogs.length > 0 && workoutLogs.length % 24 >= 20, lastMeasurement,
  };
}

module.exports = { logWeight, getWeightHistory, logWorkout, getWorkoutHistory, getWorkoutPlan, generateProgram, getActiveProgram, completeSession, getProgressiveOverload, logBodyMeasurement, getBodyMeasurements, getFitnessStats };
