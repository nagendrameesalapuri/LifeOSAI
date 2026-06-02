import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SAFE_WORKOUT_SELECT } from '../prisma/prisma-safe-select';

@Injectable()
export class FitnessService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async logWeight(userId: string, data: { weightKg: number; note?: string }) {
    const log = await this.prisma.weightLog.create({
      data: { userId, weightKg: data.weightKg, note: data.note },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { weightKg: data.weightKg },
    });
    return log;
  }

  async getWeightHistory(userId: string) {
    const logs = await this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'asc' },
    });

    // Calculate 7-day moving average
    const withMovingAvg = logs.map((log, idx) => {
      const window = logs.slice(Math.max(0, idx - 6), idx + 1);
      const avg = window.reduce((a, l) => a + l.weightKg, 0) / window.length;
      return { ...log, movingAvg7: Math.round(avg * 10) / 10 };
    });

    return withMovingAvg;
  }

  async logWorkout(userId: string, data: any) {
    return (this.prisma.workoutLog.create as any)({
      data: {
        userId,
        type: data.type,
        exercises: data.exercises,
        durationMin: data.durationMin,
        proteinG: data.proteinG,
        caloriesBurned: data.caloriesBurned,
        notes: data.notes,
        // New fields — safe with spread (ignored if column doesn't exist in DB yet)
        ...(data.sorenessLevel != null ? { sorenessLevel: data.sorenessLevel } : {}),
        ...(data.progressNote ? { progressNote: data.progressNote } : {}),
      },
    });
  }

  async getWorkoutHistory(userId: string) {
    return this.prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
      select: SAFE_WORKOUT_SELECT,
    });
  }

  async getWorkoutPlan(userId: string) {
    return this.aiService.generateWorkoutPlan(userId);
  }

  async generateProgram(userId: string) {
    try {
      const program = await this.aiService.generateWorkoutProgram(userId);
      if (!program || program.error) return { error: 'Could not generate program', details: program };

      // Check if WorkoutProgram model exists (migration may not have run)
      const prismaAny = this.prisma as any;
      if (!prismaAny.workoutProgram) {
        return { program: null, details: program, message: 'Run database migration first: npx prisma db push' };
      }

      const savedProgram = await prismaAny.workoutProgram.create({
        data: {
          userId,
          name: program.programName || 'My Program',
          split: program.split || 'PPL',
          daysPerWeek: program.daysPerWeek || 4,
          weekDuration: 12,
        },
      });

      if (program.sessions && Array.isArray(program.sessions)) {
        for (const session of program.sessions) {
          for (let week = 1; week <= 12; week++) {
            // Calculate progressive overload: apply progressionPerWeek per exercise per week
            const progressedExercises = (session.exercises || []).map((ex: any) => {
              const weekIncrement = (week - 1) * (ex.progressionPerWeek || 0);
              const phase = week <= 4 ? 'foundation' : week <= 8 ? 'build' : week <= 11 ? 'peak' : 'deload';
              const deloadMultiplier = phase === 'deload' ? 0.6 : 1;
              const targetWeight = ex.week1TargetKg != null
                ? Math.round((ex.week1TargetKg + weekIncrement) * deloadMultiplier * 2) / 2
                : null;

              return {
                ...ex,
                weekNumber: week,
                targetWeightKg: targetWeight,
                phase,
                // Adjust reps for peak phase (reduce reps, increase weight)
                repsRange: phase === 'peak' && ex.repsRange
                  ? ex.repsRange.replace(/\d+/g, (n: string) => String(Math.max(1, parseInt(n) - 2)))
                  : ex.repsRange,
                progressionNote: targetWeight != null
                  ? `Week ${week} target: ${targetWeight}kg${phase === 'deload' ? ' (deload week — 60% intensity)' : ''}`
                  : undefined,
              };
            });

            await prismaAny.workoutSession.create({
              data: {
                programId: savedProgram.id,
                weekNumber: week,
                dayLabel: session.dayLabel,
                splitType: session.splitType,
                exercises: progressedExercises,
              },
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

  async getActiveProgram(userId: string) {
    try {
      const prismaAny = this.prisma as any;
      if (!prismaAny.workoutProgram) return null;

      const program = await prismaAny.workoutProgram.findFirst({
        where: { userId, isActive: true },
        include: { sessions: { orderBy: { weekNumber: 'asc' } } },
      });

      if (!program) return null;

      const daysSinceStart = Math.floor((Date.now() - program.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.min(Math.ceil(daysSinceStart / 7) + 1, program.weekDuration);

      const currentWeekSessions = program.sessions.filter((s: any) => s.weekNumber === currentWeek);
      const completedSessions = program.sessions.filter((s: any) => s.completed && s.weekNumber === currentWeek);

      return {
        ...program,
        currentWeek,
        currentWeekSessions,
        completedSessions: completedSessions.length,
        totalWeekSessions: currentWeekSessions.length,
        weekProgress: Math.round((daysSinceStart / (program.weekDuration * 7)) * 100),
      };
    } catch (e) {
      console.error('getActiveProgram error:', e);
      return null;
    }
  }

  async completeSession(userId: string, sessionId: string, actualLog: any) {
    try {
      const prismaAny = this.prisma as any;
      if (!prismaAny.workoutSession) throw new Error('Migration required');
      const session = await prismaAny.workoutSession.findUnique({
        where: { id: sessionId },
        include: { program: true },
      });
      if (!session || session.program.userId !== userId) throw new Error('Session not found');
      return prismaAny.workoutSession.update({
        where: { id: sessionId },
        data: { completed: true, completedAt: new Date(), actualLog },
      });
    } catch (e) {
      console.error('completeSession error:', e);
      throw e;
    }
  }

  async getProgressiveOverload(userId: string, exerciseName: string) {
    const workouts = await this.prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'asc' },
      take: 30,
    });

    const history = workouts
      .map((w) => {
        const exercises = w.exercises as any[];
        const ex = exercises?.find((e: any) => e.name?.toLowerCase() === exerciseName.toLowerCase());
        if (!ex) return null;
        return {
          date: w.loggedAt,
          sets: ex.sets,
          reps: ex.reps,
          weightKg: ex.weightKg || 0,
          volume: (ex.sets || 0) * (ex.reps || 0) * (ex.weightKg || 0),
        };
      })
      .filter(Boolean);

    const recommendation = history.length > 0 ? this.getOverloadRecommendation(history) : null;
    return { history, recommendation };
  }

  private getOverloadRecommendation(history: any[]) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    if (!prev) return `First session recorded at ${last.weightKg}kg × ${last.reps} reps`;
    if (last.weightKg > prev.weightKg) {
      return `Progress! ${prev.weightKg}kg → ${last.weightKg}kg. Next: aim for ${last.weightKg + 2.5}kg`;
    }
    return `Stuck at ${last.weightKg}kg. Add 1-2 reps before increasing weight`;
  }

  async logBodyMeasurement(userId: string, data: any) {
    try {
      const prismaAny = this.prisma as any;
      if (!prismaAny.bodyMeasurement) {
        return { error: 'Run database migration first: npx prisma db push' };
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weightKg: true, heightCm: true, targetWeightKg: true } });
      let ffmi: number | undefined;

      if (data.bodyFatPct && user?.heightCm && user?.weightKg) {
        const leanMassKg = user.weightKg * (1 - data.bodyFatPct / 100);
        const heightM = user.heightCm / 100;
        ffmi = Math.round((leanMassKg / (heightM * heightM)) * 10) / 10;
      }

      return prismaAny.bodyMeasurement.create({
        data: {
          userId,
          chestCm: data.chestCm,
          waistCm: data.waistCm,
          hipCm: data.hipCm,
          leftArmCm: data.leftArmCm,
          rightArmCm: data.rightArmCm,
          leftLegCm: data.leftLegCm,
          rightLegCm: data.rightLegCm,
          bodyFatPct: data.bodyFatPct,
          ffmi,
          notes: data.notes,
        },
      });
    } catch (e) {
      console.error('logBodyMeasurement error:', e);
      return { error: 'Database migration required' };
    }
  }

  async getBodyMeasurements(userId: string) {
    try {
      const prismaAny = this.prisma as any;
      if (!prismaAny.bodyMeasurement) return [];
      return prismaAny.bodyMeasurement.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 20,
      });
    } catch (e) {
      return [];
    }
  }

  async getFitnessStats(userId: string) {
    const [weightLogs, workoutLogs, user] = await Promise.all([
      this.prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 }),
      this.prisma.workoutLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30 }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, weightKg: true, targetWeightKg: true, heightCm: true, age: true, profession: true } }),
    ]);

    // Try to get body measurements if table exists
    let lastMeasurement: any = null;
    try {
      const prismaAny = this.prisma as any;
      if (prismaAny.bodyMeasurement) {
        lastMeasurement = await prismaAny.bodyMeasurement.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } });
      }
    } catch {}

    const last30DaysWorkouts = workoutLogs.filter(
      (w) => new Date(w.loggedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );

    const recentWeights = weightLogs.slice(0, 7);
    const movingAvg7 = recentWeights.length
      ? Math.round(recentWeights.reduce((a, w) => a + w.weightKg, 0) / recentWeights.length * 10) / 10
      : user?.weightKg || 62;

    const gymDaysPerWeek = (user as any)?.gymDaysPerWeek ?? 4;
    const targetWorkouts = gymDaysPerWeek * 4;
    const fitnessScore = Math.min(100, Math.round((last30DaysWorkouts.length / targetWorkouts) * 100));

    // FFMI from last measurement
    let ffmi: number | undefined;
    if (lastMeasurement?.bodyFatPct && user?.heightCm && user?.weightKg) {
      const leanMassKg = user.weightKg * (1 - lastMeasurement.bodyFatPct / 100);
      const heightM = user.heightCm / 100;
      ffmi = Math.round((leanMassKg / (heightM * heightM)) * 10) / 10;
    }

    const deloadRecommended = workoutLogs.length > 0 && workoutLogs.length % 24 >= 20;

    return {
      currentWeight: user?.weightKg,
      movingAvg7,
      targetWeight: user?.targetWeightKg,
      weightProgress: weightLogs.length > 1
        ? Math.round((weightLogs[0].weightKg - weightLogs[weightLogs.length - 1].weightKg) * 10) / 10
        : 0,
      workoutsThisMonth: last30DaysWorkouts.length,
      fitnessScore,
      weightHistory: weightLogs,
      ffmi,
      deloadRecommended,
      lastMeasurement,
    };
  }
}
