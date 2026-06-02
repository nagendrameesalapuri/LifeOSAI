import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } from '../prisma/prisma-safe-select';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  private computeWeights(languageGoals: string[]): Record<string, number> {
    const hasEnglish = languageGoals.includes('english');
    const hasKannada = languageGoals.includes('kannada');
    const langCount = (hasEnglish ? 1 : 0) + (hasKannada ? 1 : 0);

    // Base weights — always present
    const base = { fitness: 0.25, sleep: 0.20, discipline: 0.30, career: 0.25 };
    const langPool = 0.20; // total weight redistributed to language if tracking
    const perLang = langCount > 0 ? langPool / langCount : 0;

    if (langCount === 0) return base; // no language learning — redistribute evenly to core

    const reduction = langPool / 4; // spread reduction across 4 core categories
    return {
      fitness: base.fitness - reduction,
      sleep: base.sleep - reduction,
      discipline: base.discipline - reduction,
      career: base.career - reduction,
      ...(hasEnglish ? { english: perLang } : {}),
      ...(hasKannada ? { kannada: perLang } : {}),
    };
  }

  async getDashboard(userId: string) {
    const [user, habitScores, sleepData, fitnessData, studyData, englishData, kannadaData] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, weightKg: true, targetWeightKg: true, heightCm: true, age: true, profession: true, tdeeKcal: true, dailyCalorieTarget: true, dailyProteinTarget: true } as any }),
        this.getHabitScoreData(userId),
        this.getSleepScoreData(userId),
        this.getFitnessScoreData(userId),
        this.getStudyScoreData(userId),
        this.getEnglishScoreData(userId),
        this.getKannadaScoreData(userId),
      ]);

    const userAny = user as any;
    const languageGoals: string[] = userAny?.languageGoals || [];
    const weights = this.computeWeights(languageGoals);

    const scores: Record<string, number> = {
      fitness: fitnessData.score,
      sleep: sleepData.score,
      discipline: habitScores.disciplineScore,
      career: studyData.score,
      ...(languageGoals.includes('english') ? { english: englishData.score } : {}),
      ...(languageGoals.includes('kannada') ? { kannada: kannadaData.score } : {}),
    };

    const overall = Math.round(
      Object.entries(scores).reduce((sum, [key, val]) => sum + val * (weights[key] || 0), 0),
    );

    await this.prisma.lifeScore.create({
      data: {
        userId, date: new Date(), overall,
        fitness: scores.fitness, sleep: scores.sleep, discipline: scores.discipline,
        career: scores.career,
        english: scores.english ?? 0,
        kannada: scores.kannada ?? 0,
      },
    }).catch(() => {});

    return {
      user: {
        name: userAny?.name,
        weightKg: userAny?.weightKg,
        targetWeightKg: userAny?.targetWeightKg,
        tdeeKcal: userAny?.tdeeKcal ?? null,
        dailyCalorieTarget: userAny?.dailyCalorieTarget ?? 2800,
        dailyProteinTarget: userAny?.dailyProteinTarget ?? 140,
        languageGoals,
      },
      scores: { ...scores, overall },
      weights,
      details: {
        fitness: fitnessData,
        sleep: sleepData,
        habits: habitScores,
        study: studyData,
        english: englishData,
        kannada: kannadaData,
      },
    };
  }

  async getScoreBreakdown(userId: string) {
    try {
      const [user, habitScores, sleepData, fitnessData, studyData, englishData, kannadaData,
        recentWorkouts, recentSleep, recentDiet, recentStudy, recentEnglish, kannadaLogs] =
        await Promise.all([
          this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, weightKg: true, targetWeightKg: true, heightCm: true, age: true, profession: true } }),
          this.getHabitScoreData(userId),
          this.getSleepScoreData(userId),
          this.getFitnessScoreData(userId),
          this.getStudyScoreData(userId),
          this.getEnglishScoreData(userId),
          this.getKannadaScoreData(userId),
          this.prisma.workoutLog.findMany({ where: { userId, loggedAt: { gte: new Date(Date.now() - 30 * 86400000) } }, orderBy: { loggedAt: 'desc' }, select: SAFE_WORKOUT_SELECT }),
          this.prisma.sleepLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' } }),
          this.prisma.dietLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' }, select: SAFE_DIET_SELECT }),
          this.prisma.studyLog.findMany({ where: { userId, loggedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
          this.prisma.englishLog.findMany({ where: { userId }, take: 10, orderBy: { loggedAt: 'desc' } }),
          this.prisma.kannadaLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 1 }),
        ]);

      const proteinTarget = (user as any)?.dailyProteinTarget || 140;
      const gymTarget = ((user as any)?.gymDaysPerWeek || 4) * 4;
      const avgProtein = recentDiet.length
        ? Math.round(recentDiet.reduce((a, d) => a + d.totalProteinG, 0) / recentDiet.length)
        : 0;
      const avgSleep = recentSleep.length
        ? (recentSleep.reduce((a, s) => a + s.durationHours, 0) / recentSleep.length).toFixed(1)
        : '0';
      const weeklyStudyMins = recentStudy.reduce((a, s) => a + s.durationMin, 0);
      const avgGrammarScore = recentEnglish.length
        ? Math.round(recentEnglish.reduce((a, l) => a + l.grammarScore, 0) / recentEnglish.length)
        : 0;
      const vocabCount = kannadaLogs[0]?.vocabularyCount || 0;

      const userFull = await this.prisma.user.findUnique({ where: { id: userId }, select: { languageGoals: true } as any });
      const languageGoals: string[] = (userFull as any)?.languageGoals || [];
      const weights = this.computeWeights(languageGoals);

      const scores: Record<string, number> = {
        fitness: fitnessData.score,
        sleep: sleepData.score,
        discipline: habitScores.disciplineScore,
        career: studyData.score,
        ...(languageGoals.includes('english') ? { english: englishData.score } : {}),
        ...(languageGoals.includes('kannada') ? { kannada: kannadaData.score } : {}),
      };

      const breakdown: Record<string, any> = {
        fitness: {
          score: scores.fitness,
          whyThisScore: `You did ${recentWorkouts.length}/${gymTarget} target workouts this month`,
          dataPoints: [
            `Workouts this month: ${recentWorkouts.length}`,
            `Monthly target: ${gymTarget} sessions`,
            `Protein avg: ${avgProtein}g (target: ${proteinTarget}g)`,
          ],
          toRaiseBy10: `Complete ${Math.ceil(gymTarget * 0.1)} more workouts this week and hit ${proteinTarget}g protein daily`,
          quickWin: recentWorkouts.length === 0 ? 'Go to gym TODAY — break the streak' : 'Log your next planned workout',
        },
        sleep: {
          score: scores.sleep,
          whyThisScore: `Your 7-day sleep average is ${avgSleep} hours (target: 8 hours)`,
          dataPoints: [
            `7-day sleep average: ${avgSleep} hours`,
            `Target: 8 hours/night`,
            `Days under 7 hours: ${recentSleep.filter(s => s.durationHours < 7).length}`,
          ],
          toRaiseBy10: `Sleep before 10:30pm for 5 consecutive nights — this alone adds 10+ points`,
          quickWin: 'Set a phone alarm for 10pm as a "prepare for sleep" reminder',
        },
        discipline: {
          score: scores.discipline,
          whyThisScore: `Habit consistency based on your tracked habits (gym, sleep, study${languageGoals.includes('english') ? ', english' : ''}${languageGoals.includes('kannada') ? ', kannada' : ''})`,
          dataPoints: [
            `Gym days: ${habitScores.gymDays}/7`,
            `Sleep habit: ${habitScores.sleepDays}/7`,
            `Study days: ${habitScores.studyDays}/7`,
            ...(languageGoals.includes('english') ? [`English practice: ${habitScores.englishDays}/7`] : []),
            ...(languageGoals.includes('kannada') ? [`Kannada practice: ${habitScores.kannadaDays}/7`] : []),
          ],
          toRaiseBy10: `Hit all your tracked habits consistently for 3 days`,
          quickWin: "Log today's habits even if incomplete — tracking builds consistency",
        },
        career: {
          score: scores.career,
          whyThisScore: `You studied ${weeklyStudyMins} minutes this week (target: 840 min / 14 hrs)`,
          dataPoints: [
            `Weekly study: ${Math.round(weeklyStudyMins / 60)} hours`,
            `Weekly target: 14 hours`,
            `Sessions this week: ${recentStudy.length}`,
          ],
          toRaiseBy10: `Study 30 minutes daily for 7 days — consistency beats marathon sessions`,
          quickWin: 'Open your learning resource right now and study for 15 minutes',
        },
        ...(languageGoals.includes('english') ? {
          english: {
            score: scores.english,
            whyThisScore: `Average grammar score from last ${recentEnglish.length} corrections: ${avgGrammarScore}/100`,
            dataPoints: [
              `Avg grammar score: ${avgGrammarScore}/100`,
              `Total corrections: ${recentEnglish.length}`,
            ],
            toRaiseBy10: `Practice English correction daily for 7 days`,
            quickWin: 'Use the English correction tool right now — type any sentence you said today',
          },
        } : {}),
        ...(languageGoals.includes('kannada') ? {
          kannada: {
            score: scores.kannada,
            whyThisScore: `Vocabulary count: ${vocabCount} words out of 500 word target`,
            dataPoints: [
              `Words learned: ${vocabCount}`,
              `Target: 500 words`,
              `Progress: ${Math.round((vocabCount / 500) * 100)}%`,
            ],
            toRaiseBy10: `Complete 5 Kannada lessons — each lesson adds 5-7 words`,
            quickWin: "Take today's Kannada lesson and say the challenge sentence to someone",
          },
        } : {}),
      };

      const overall = Math.round(
        Object.entries(scores).reduce((sum, [key, val]) => sum + val * (weights[key] || 0), 0),
      );

      const lowestScore = Object.entries(scores).sort(([, a], [, b]) => (a as number) - (b as number))[0];

      return {
        scores: { ...scores, overall },
        breakdown,
        focusArea: lowestScore[0],
        focusReason: `${lowestScore[0]} is your lowest score at ${lowestScore[1]}/100 — fixing this has the highest impact`,
        overallInsight: this.getOverallInsight(scores, overall),
      };
    } catch (e) {
      console.error('getScoreBreakdown error:', e);
      return null;
    }
  }

  private getOverallInsight(scores: any, overall: number): string {
    if (overall >= 80) return "You're crushing it across all areas. Keep the momentum going!";
    if (scores.discipline < 40) return 'Discipline is your foundation — when habits break, everything else follows. Fix sleep and gym first.';
    if (scores.fitness < 40) return 'Your fitness score is pulling down your overall. Consistent workouts + protein will give you the biggest jump.';
    if (scores.sleep < 40) return 'Poor sleep is silently sabotaging your fitness gains and energy. This is your #1 priority.';
    return "You're building momentum. Pick ONE area and dominate it this week.";
  }

  async getTrends(userId: string) {
    const [weightLogs, sleepLogs, habitLogs, studyLogs, lifeScores, dietLogs] = await Promise.all([
      this.prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 }),
      this.prisma.sleepLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 }),
      this.prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
      this.prisma.studyLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30 }),
      this.prisma.lifeScore.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
      this.prisma.dietLog.findMany({ where: { userId }, orderBy: { loggedAt: 'asc' }, take: 30, select: SAFE_DIET_SELECT }),
    ]);

    // 7-day moving average for weight
    const weightWithMovingAvg = weightLogs.map((log, idx) => {
      const window = weightLogs.slice(Math.max(0, idx - 6), idx + 1);
      const avg = window.reduce((a, l) => a + l.weightKg, 0) / window.length;
      return { ...log, movingAvg7: Math.round(avg * 10) / 10 };
    });

    return { weightLogs: weightWithMovingAvg, sleepLogs, habitLogs, studyLogs, lifeScores, dietLogs };
  }

  async getInsights(userId: string) {
    return this.aiService.generateAiInsights(userId);
  }

  async getCorrelationInsights(userId: string) {
    const [workouts, sleepLogs, habitLogs, dietLogs] = await Promise.all([
      this.prisma.workoutLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 60,
        select: { loggedAt: true, type: true, durationMin: true },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 60,
      }),
      this.prisma.habitLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 60,
      }),
      this.prisma.dietLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 30,
        select: { loggedAt: true, totalProteinG: true, totalCalories: true },
      }),
    ]);

    const insights: any[] = [];

    // Sleep → Gym attendance correlation
    if (workouts.length > 5 && sleepLogs.length > 5) {
      const workoutDates = new Set(workouts.map((w) => new Date(w.loggedAt).toDateString()));
      const goodSleepDays = sleepLogs.filter((s) => s.durationHours >= 7.5);
      const poorSleepDays = sleepLogs.filter((s) => s.durationHours < 6.5);

      const goodSleepGymRate = goodSleepDays.length > 0
        ? goodSleepDays.filter((s) => {
            const nextDay = new Date(s.wakeupTime);
            return workoutDates.has(nextDay.toDateString());
          }).length / goodSleepDays.length
        : 0;

      const poorSleepGymRate = poorSleepDays.length > 0
        ? poorSleepDays.filter((s) => {
            const nextDay = new Date(s.wakeupTime);
            return workoutDates.has(nextDay.toDateString());
          }).length / poorSleepDays.length
        : 0;

      if (goodSleepDays.length >= 3 && Math.abs(goodSleepGymRate - poorSleepGymRate) > 0.15) {
        insights.push({
          type: 'sleep_workout_correlation',
          title: 'Sleep drives your gym attendance',
          message: `You work out ${Math.round(goodSleepGymRate * 100)}% of days after 7.5+ hrs sleep, but only ${Math.round(poorSleepGymRate * 100)}% after under 6.5 hrs.`,
          recommendation: 'Prioritize sleep to maintain gym consistency.',
          impact: 'high',
        });
      }
    }

    // Day-of-week gym pattern
    if (workouts.length > 10) {
      const dayCount: Record<string, number> = {};
      const dayTotal: Record<string, number> = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };

      workouts.forEach((w) => {
        const day = new Date(w.loggedAt).toLocaleDateString('en-US', { weekday: 'long' });
        dayCount[day] = (dayCount[day] || 0) + 1;
      });

      const weeksOfData = Math.max(1, Math.ceil(workouts.length / 5));
      const worstDay = Object.entries(dayCount).sort(([, a], [, b]) => a - b)[0];
      const bestDay = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0];

      if (worstDay && bestDay && bestDay[1] > worstDay[1] * 2) {
        insights.push({
          type: 'day_of_week_pattern',
          title: `${worstDay[0]} is your weak day`,
          message: `You consistently skip gym on ${worstDay[0]}s (${worstDay[1]} workouts vs ${bestDay[1]} on ${bestDay[0]}s).`,
          recommendation: `Plan something specific for ${worstDay[0]} — even a 20-min session breaks the pattern.`,
          impact: 'medium',
        });
      }
    }

    // Protein consistency
    if (dietLogs.length > 7) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { dailyProteinTarget: true } as any });
      const proteinTarget = (user as any)?.dailyProteinTarget || 140;
      const hitDays = dietLogs.filter((d) => d.totalProteinG >= proteinTarget * 0.9).length;
      const hitRate = hitDays / dietLogs.length;

      insights.push({
        type: 'protein_consistency',
        title: 'Protein target consistency',
        message: `You hit your protein target on ${Math.round(hitRate * 100)}% of tracked days (${hitDays}/${dietLogs.length}).`,
        recommendation: hitRate < 0.7 ? 'Add a protein-rich snack between meals — curd, eggs, or paneer work.' : 'Solid protein consistency — keep it up.',
        impact: hitRate < 0.7 ? 'high' : 'low',
      });
    }

    // Streak momentum
    const gymStreak = this.calculateCurrentStreak(habitLogs, 'gym');
    if (gymStreak >= 5) {
      insights.push({
        type: 'streak_momentum',
        title: `${gymStreak}-day gym streak — protect it!`,
        message: `You're on a ${gymStreak}-day gym streak. This is rare — most people break at day 7.`,
        recommendation: "Don't skip tomorrow even for 20 minutes. Streaks compound.",
        impact: 'high',
      });
    }

    return { insights, generatedAt: new Date() };
  }

  private calculateCurrentStreak(logs: any[], habit: string): number {
    let streak = 0;
    for (const log of logs) {
      if (log[habit]) streak++;
      else break;
    }
    return streak;
  }

  async getProactiveInsights(userId: string) {
    return this.aiService.generateProactiveInsights(userId);
  }

  private async getHabitScoreData(userId: string) {
    const [logs, user] = await Promise.all([
      this.prisma.habitLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 7 }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { languageGoals: true } as any }),
    ]);
    if (!logs.length) return { disciplineScore: 0, consistencyScore: 0 };

    const languageGoals: string[] = (user as any)?.languageGoals || [];
    const hasEnglish = languageGoals.includes('english');
    const hasKannada = languageGoals.includes('kannada');

    const gymDays = logs.filter((l) => l.gym).length;
    const sleepDays = logs.filter((l) => l.sleep).length;
    const studyDays = logs.filter((l) => l.study).length;
    const englishDays = hasEnglish ? logs.filter((l) => l.english).length : 0;
    const kannadaDays = hasKannada ? logs.filter((l) => l.kannada).length : 0;

    // Dynamic weights and max score based on which habits the user tracks
    const coreWeight = gymDays !== undefined ? 25 : 0;   // gym
    const sleepWeight = 25;
    const studyWeight = 25;
    const englishWeight = hasEnglish ? 15 : 0;
    const kannadaWeight = hasKannada ? 10 : 0;
    const totalWeight = coreWeight + sleepWeight + studyWeight + englishWeight + kannadaWeight;
    const maxDailyScore = totalWeight; // max per day
    const maxTotal = 7 * maxDailyScore; // max over 7 days

    const earnedScore = gymDays * coreWeight + sleepDays * sleepWeight + studyDays * studyWeight +
      englishDays * englishWeight + kannadaDays * kannadaWeight;

    const disciplineScore = maxTotal > 0 ? Math.round((earnedScore / maxTotal) * 100) : 0;
    const consistencyScore = Math.round(((gymDays + sleepDays + studyDays) / (7 * 3)) * 100);
    return {
      disciplineScore: Math.min(100, disciplineScore),
      consistencyScore: Math.min(100, consistencyScore),
      gymDays, sleepDays, studyDays, englishDays, kannadaDays,
      trackedHabits: ['gym', 'sleep', 'study', ...(hasEnglish ? ['english'] : []), ...(hasKannada ? ['kannada'] : [])],
    };
  }

  private async getSleepScoreData(userId: string) {
    const logs = await this.prisma.sleepLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 7 });
    if (!logs.length) return { score: 0 };
    const avg = logs.reduce((a, l) => a + l.durationHours, 0) / logs.length;
    return { score: Math.min(100, Math.round((avg / 8) * 100)), avgHours: avg.toFixed(1) };
  }

  private async getFitnessScoreData(userId: string) {
    const [workouts, user] = await Promise.all([
      this.prisma.workoutLog.findMany({
        where: { userId, loggedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    // Safe access — gymDaysPerWeek may not exist if migration not run yet
    const gymDaysPerWeek = (user as any)?.gymDaysPerWeek ?? 4;
    const targetPerMonth = gymDaysPerWeek * 4;
    return {
      score: Math.min(100, Math.round((workouts.length / targetPerMonth) * 100)),
      workoutsThisMonth: workouts.length,
      targetPerMonth,
    };
  }

  private async getStudyScoreData(userId: string) {
    const logs = await this.prisma.studyLog.findMany({
      where: { userId, loggedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    const weeklyMins = logs.reduce((a, l) => a + l.durationMin, 0);
    return { score: Math.min(100, Math.round((weeklyMins / 840) * 100)), weeklyMinutes: weeklyMins };
  }

  private async getEnglishScoreData(userId: string) {
    const logs = await this.prisma.englishLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 10 });
    if (!logs.length) return { score: 0 };
    return { score: Math.round(logs.reduce((a, l) => a + l.grammarScore, 0) / logs.length) };
  }

  private async getKannadaScoreData(userId: string) {
    const log = await this.prisma.kannadaLog.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } });
    return { score: Math.min(100, Math.round(((log?.vocabularyCount || 0) / 500) * 100)) };
  }
}
