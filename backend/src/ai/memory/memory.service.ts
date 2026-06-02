import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryType } from '@prisma/client';
import { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } from '../../prisma/prisma-safe-select';

@Injectable()
export class MemoryService {
  constructor(private prisma: PrismaService) {}

  // In-memory cache: userId → { context, expiresAt }
  private readonly contextCache = new Map<string, { context: string; expiresAt: number }>();
  private readonly CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private readonly SAFE_USER_SELECT = {
    id: true, name: true, weightKg: true, targetWeightKg: true,
    heightCm: true, age: true, profession: true,
    tdeeKcal: true, dailyProteinTarget: true, dailyCalorieTarget: true,
    gymDaysPerWeek: true, primaryGoal: true, gymAccess: true, fitnessLevel: true,
    activityLevel: true,
    careerGoal: true, careerGoalCustom: true, languageGoals: true, nativeLanguage: true,
  };

  invalidateContextCache(userId: string) {
    this.contextCache.delete(userId);
  }

  async getContextualMemory(userId: string): Promise<string> {
    // Return cached context if still fresh
    const cached = this.contextCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    const [memories, recentHabits, recentWorkouts, recentSleep, recentStudy, recentDiet, user, weightLogs] =
      await Promise.all([
        this.prisma.aIMemory.findMany({ where: { userId } }),
        this.prisma.habitLog.findMany({ where: { userId }, take: 14, orderBy: { date: 'desc' } }),
        // workoutLog: select only original columns (new ones: sorenessLevel, progressNote, sessionProgramId may not exist in DB)
        this.prisma.workoutLog.findMany({
          where: { userId }, take: 10, orderBy: { loggedAt: 'desc' },
          select: { id: true, userId: true, type: true, exercises: true, durationMin: true, proteinG: true, caloriesBurned: true, notes: true, loggedAt: true },
        }),
        this.prisma.sleepLog.findMany({ where: { userId }, take: 14, orderBy: { loggedAt: 'desc' } }),
        this.prisma.studyLog.findMany({ where: { userId }, take: 7, orderBy: { loggedAt: 'desc' } }),
        // dietLog: select only original columns (new one: mealTiming may not exist in DB)
        this.prisma.dietLog.findMany({
          where: { userId }, take: 7, orderBy: { loggedAt: 'desc' },
          select: { id: true, userId: true, meals: true, totalCalories: true, totalProteinG: true, totalCarbsG: true, totalFatsG: true, waterLitres: true, loggedAt: true },
        }),
        // user: safe select (new columns may not exist in DB)
        this.prisma.user.findUnique({ where: { id: userId }, select: this.SAFE_USER_SELECT }),
        this.prisma.weightLog.findMany({ where: { userId }, take: 30, orderBy: { loggedAt: 'desc' } }),
      ]);

    const userAny = user as any;

    // Build dynamic career label
    const careerGoalLabel = this.getCareerLabel(userAny?.careerGoal, userAny?.careerGoalCustom, userAny?.profession);
    // Build dynamic language goals string
    const langGoals: string[] = userAny?.languageGoals || [];
    const nativeLang = userAny?.nativeLanguage || 'unknown';

    const gymDays7 = recentHabits.slice(0, 7).filter((h) => h.gym).length;
    const gymDays14 = recentHabits.filter((h) => h.gym).length;
    const avgSleep7 = recentSleep.slice(0, 7).length
      ? (recentSleep.slice(0, 7).reduce((a, s) => a + s.durationHours, 0) / recentSleep.slice(0, 7).length).toFixed(1)
      : 'not logged';
    const avgProtein7 = recentDiet.length
      ? Math.round(recentDiet.reduce((a, d) => a + d.totalProteinG, 0) / recentDiet.length)
      : 'not logged';
    const avgCalories7 = recentDiet.length
      ? Math.round(recentDiet.reduce((a, d) => a + d.totalCalories, 0) / recentDiet.length)
      : 'not logged';

    // Pattern detection: find weak days
    const dayFrequency: Record<string, { total: number; gym: number }> = {};
    recentHabits.forEach((h) => {
      const day = new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' });
      if (!dayFrequency[day]) dayFrequency[day] = { total: 0, gym: 0 };
      dayFrequency[day].total++;
      if (h.gym) dayFrequency[day].gym++;
    });
    const weakDays = Object.entries(dayFrequency)
      .filter(([, v]) => v.total >= 2 && v.gym / v.total < 0.3)
      .map(([day]) => day);

    // Sleep quality trend
    const recentSleepAvg = recentSleep.slice(0, 3).length
      ? recentSleep.slice(0, 3).reduce((a, s) => a + s.durationHours, 0) / recentSleep.slice(0, 3).length
      : 0;
    const sleepAlert = recentSleepAvg > 0 && recentSleepAvg < 6 ? '⚠️ CRITICAL: Under 6hrs sleep 3 nights in a row' : '';

    // Weight trend (7-day moving average)
    const recentWeight = weightLogs.slice(0, 7);
    const avgWeight7 = recentWeight.length
      ? (recentWeight.reduce((a, w) => a + w.weightKg, 0) / recentWeight.length).toFixed(1)
      : user?.weightKg || 62;

    // Protein vs target — safe access for new fields
    const proteinTarget = userAny?.dailyProteinTarget || 140;
    const proteinGap = typeof avgProtein7 === 'number' ? Math.round(proteinTarget - avgProtein7) : null;
    const calorieTarget = userAny?.dailyCalorieTarget || 2800;

    const profileMem = memories.find((m) => m.memoryType === MemoryType.USER_PROFILE);
    const englishMem = memories.find((m) => m.memoryType === MemoryType.LEARNING);
    const careerMem = memories.find((m) => m.memoryType === MemoryType.CAREER);
    const weeklyMem = memories.find((m) => m.memoryType === MemoryType.WEEKLY_REVIEW);

    const englishData = englishMem?.content as any;
    const careerData = careerMem?.content as any;

    const languageSection = langGoals.length > 0 ? `
LANGUAGE LEARNING (native: ${nativeLang}):
${langGoals.includes('english') ? `- English coaching: mistakes: ${englishData?.commonMistakes?.slice(0, 3).join(', ') || 'none yet'} | grammar score trend: ${englishData?.grammarScoreTrend?.slice(-3).join(' → ') || 'not assessed'} | corrections: ${englishData?.totalCorrections || 0}` : ''}
${langGoals.includes('kannada') ? `- Kannada: ${(profileMem?.content as any)?.kannadaVocabCount || 0} words learned | confidence: ${(profileMem?.content as any)?.kannadaConfidence || 'beginner'}` : ''}
${langGoals.filter(l => !['english','kannada'].includes(l)).map(l => `- ${l}: in progress`).join('\n')}` : `
LANGUAGE LEARNING: not tracking any language goals`;

    const context = `
=== LIFEOS MEMORY CONTEXT ===
User: ${user?.name || 'User'} | ${careerGoalLabel}
Current weight: ${user?.weightKg || '?'}kg (7-day avg: ${avgWeight7}kg) | Target: ${user?.targetWeightKg || '?'}kg | Goal: ${userAny?.primaryGoal || 'lean_bulk'}
Height: ${user?.heightCm || '?'}cm | Age: ${user?.age || '?'}
TDEE: ${userAny?.tdeeKcal || 2600} kcal | Calorie target: ${calorieTarget} kcal | Protein target: ${proteinTarget}g
Gym days/week goal: ${userAny?.gymDaysPerWeek || 4} | Equipment: ${userAny?.gymAccess || 'commercial'} gym | Level: ${userAny?.fitnessLevel || 'intermediate'}

LAST 7 DAYS PERFORMANCE:
- Gym attendance: ${gymDays7}/7 days ${gymDays7 < 3 ? '(POOR)' : gymDays7 < 5 ? '(AVERAGE)' : '(GOOD)'}
- 14-day gym total: ${gymDays14}/14 days
- Average sleep: ${avgSleep7} hours ${sleepAlert}
- Average protein: ${avgProtein7}g/day (target: ${proteinTarget}g | ${proteinGap !== null ? `${proteinGap}g short` : 'not tracked'})
- Average calories: ${avgCalories7}/day (target: ${calorieTarget})
- Study sessions: ${recentStudy.length} in last 7 days
${langGoals.includes('english') ? `- English practice sessions: ${recentStudy.filter(s => s.topic?.toLowerCase().includes('english')).length} this week` : ''}

DETECTED PATTERNS:
- Weak gym days: ${weakDays.length > 0 ? weakDays.join(', ') : 'none detected yet'}
- Sleep trend: ${recentSleepAvg > 0 ? `${recentSleepAvg.toFixed(1)}hrs avg last 3 nights` : 'not enough data'}
- Last workout: ${recentWorkouts[0] ? `${recentWorkouts[0].type} on ${new Date(recentWorkouts[0].loggedAt).toLocaleDateString()}` : 'not logged recently'}

${languageSection}

CAREER:
- Goal: ${careerGoalLabel}
- Current topic: ${careerData?.currentTopic || 'not started'}
- Topics completed: ${careerData?.completedTopics?.join(', ') || 'none yet'}
- Total study hours: ${careerData?.totalHours || 0}hrs
- Last study session: ${recentStudy[0] ? `${recentStudy[0].topic} (${recentStudy[0].durationMin} min)` : 'none recent'}

RECURRING CHALLENGES:
- Days since last gym: ${this.getDaysSinceGym(recentWorkouts)}
- Consecutive low-sleep nights: ${this.getConsecutiveLowSleep(recentSleep)}
- Protein deficit streak: ${proteinGap && proteinGap > 30 ? `${recentDiet.length} days averaging ${proteinGap}g below target` : 'within range'}

Use this context to personalize ALL responses. Reference specific numbers. Call out patterns.
If the user is making excuses, call it out respectfully but firmly.
=== END CONTEXT ===`;

    // Store in cache
    this.contextCache.set(userId, { context, expiresAt: Date.now() + this.CONTEXT_TTL_MS });
    return context;
  }

  private getCareerLabel(careerGoal: string, customGoal: string, profession: string): string {
    const careerLabels: Record<string, string> = {
      devops: 'DevOps/Cloud Engineer (in transition)',
      data_engineering: 'Data Engineer (in transition)',
      frontend: 'Frontend Engineer (in transition)',
      backend: 'Backend Engineer (in transition)',
      ai_ml: 'AI/ML Engineer (in transition)',
    };
    if (careerGoal === 'custom' && customGoal) return customGoal;
    if (careerGoal && careerLabels[careerGoal]) {
      return profession ? `${profession} → ${careerLabels[careerGoal]}` : careerLabels[careerGoal];
    }
    return profession || 'Professional';
  }

  private getDaysSinceGym(workouts: any[]): string {
    if (!workouts.length) return 'unknown';
    const lastGym = new Date(workouts[0].loggedAt);
    const days = Math.floor((Date.now() - lastGym.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }

  private getConsecutiveLowSleep(sleepLogs: any[]): number {
    let count = 0;
    for (const log of sleepLogs) {
      if (log.durationHours < 7) count++;
      else break;
    }
    return count;
  }

  async updateMemory(userId: string, type: MemoryType, newData: any): Promise<void> {
    this.contextCache.delete(userId); // Invalidate so next AI call rebuilds with fresh data
    const existing = await this.prisma.aIMemory.findUnique({
      where: { userId_memoryType: { userId, memoryType: type } },
    });

    const merged = existing ? this.mergeMemory(existing.content as any, newData) : newData;

    await this.prisma.aIMemory.upsert({
      where: { userId_memoryType: { userId, memoryType: type } },
      update: { content: merged, updatedAt: new Date() },
      create: { userId, memoryType: type, content: merged },
    });
  }

  private mergeMemory(existing: any, newData: any): any {
    const merged = { ...existing };
    for (const key of Object.keys(newData)) {
      if (Array.isArray(existing[key]) && Array.isArray(newData[key])) {
        const combined = [...new Set([...existing[key], ...newData[key]])];
        merged[key] = combined.slice(-50);
      } else {
        merged[key] = newData[key];
      }
    }
    return merged;
  }

  async updateEnglishMemory(userId: string, mistake: any): Promise<void> {
    const existing = await this.prisma.aIMemory.findUnique({
      where: { userId_memoryType: { userId, memoryType: MemoryType.LEARNING } },
    });

    const content = (existing?.content as any) || {
      commonMistakes: [],
      grammarScoreTrend: [],
      totalCorrections: 0,
    };

    if (mistake.mistakes?.length > 0) {
      const types = mistake.mistakes.map((m: any) => m.type);
      content.commonMistakes = [...new Set([...content.commonMistakes, ...types])].slice(-20);
      content.totalCorrections = (content.totalCorrections || 0) + mistake.mistakes.length;

      // Track specific mistake types with counts
      if (!content.mistakeCounts) content.mistakeCounts = {};
      types.forEach((t: string) => {
        content.mistakeCounts[t] = (content.mistakeCounts[t] || 0) + 1;
      });
    }
    content.grammarScoreTrend = [
      ...(content.grammarScoreTrend || []),
      mistake.grammarScore,
    ].slice(-10);

    await this.prisma.aIMemory.upsert({
      where: { userId_memoryType: { userId, memoryType: MemoryType.LEARNING } },
      update: { content },
      create: { userId, memoryType: MemoryType.LEARNING, content },
    });
  }

  async updateCareerMemory(userId: string, studyLog: any): Promise<void> {
    const existing = await this.prisma.aIMemory.findUnique({
      where: { userId_memoryType: { userId, memoryType: MemoryType.CAREER } },
    });

    const content = (existing?.content as any) || {
      currentTopic: 'Docker',
      completedTopics: [],
      totalHours: 0,
      topicsProgress: {},
    };

    content.currentTopic = studyLog.topic;
    content.totalHours = (content.totalHours || 0) + Math.round(studyLog.durationMin / 60);

    if (!content.topicsProgress[studyLog.topic]) {
      content.topicsProgress[studyLog.topic] = 0;
    }
    content.topicsProgress[studyLog.topic] += studyLog.durationMin;

    await this.prisma.aIMemory.upsert({
      where: { userId_memoryType: { userId, memoryType: MemoryType.CAREER } },
      update: { content },
      create: { userId, memoryType: MemoryType.CAREER, content },
    });
  }

  async detectPatterns(userId: string): Promise<any> {
    const [habits, sleep, diet, workouts] = await Promise.all([
      this.prisma.habitLog.findMany({ where: { userId }, take: 30, orderBy: { date: 'desc' } }),
      this.prisma.sleepLog.findMany({ where: { userId }, take: 30, orderBy: { loggedAt: 'desc' } }),
      this.prisma.dietLog.findMany({ where: { userId }, take: 14, orderBy: { loggedAt: 'desc' }, select: SAFE_DIET_SELECT }),
      this.prisma.workoutLog.findMany({ where: { userId }, take: 30, orderBy: { loggedAt: 'desc' }, select: SAFE_WORKOUT_SELECT }),
    ]);

    const patterns: any[] = [];

    // Pattern: Skipping gym on specific days
    const dayGymMap: Record<string, { total: number; gym: number }> = {};
    habits.forEach((h) => {
      const day = new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' });
      if (!dayGymMap[day]) dayGymMap[day] = { total: 0, gym: 0 };
      dayGymMap[day].total++;
      if (h.gym) dayGymMap[day].gym++;
    });
    Object.entries(dayGymMap).forEach(([day, { total, gym }]) => {
      if (total >= 3 && gym / total < 0.25) {
        patterns.push({
          type: 'gym_skip_pattern',
          message: `You skip gym on ${day}s — only ${Math.round((gym / total) * 100)}% attendance on ${day}s`,
          severity: 'high',
        });
      }
    });

    // Pattern: Sleep drops on study nights
    const lateSleepNights = sleep.filter((s) => {
      const bed = new Date(s.bedtime);
      return bed.getHours() >= 0 && bed.getHours() < 4;
    }).length;
    if (lateSleepNights > 3) {
      patterns.push({
        type: 'late_sleep',
        message: `You slept after midnight ${lateSleepNights} times recently — this kills recovery`,
        severity: 'high',
      });
    }

    // Pattern: Low protein consistency
    const lowProteinDays = diet.filter((d) => d.totalProteinG < 100).length;
    if (lowProteinDays > diet.length * 0.5) {
      patterns.push({
        type: 'low_protein',
        message: `Protein below 100g on ${lowProteinDays}/${diet.length} tracked days — muscle growth will stall`,
        severity: 'high',
      });
    }

    // Pattern: Days without workout streak
    if (workouts.length > 0) {
      const lastWorkout = new Date(workouts[0].loggedAt);
      const daysSince = Math.floor((Date.now() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 3) {
        patterns.push({
          type: 'workout_gap',
          message: `${daysSince} days since last workout — momentum is breaking`,
          severity: daysSince >= 5 ? 'critical' : 'high',
        });
      }
    }

    // Pattern: Sleep-workout correlation
    const sleepWorkoutPairs = workouts.slice(0, 10).map((w) => {
      const prevNight = sleep.find((s) => {
        const sleepDate = new Date(s.wakeupTime);
        const workoutDate = new Date(w.loggedAt);
        return Math.abs(sleepDate.getTime() - workoutDate.getTime()) < 24 * 60 * 60 * 1000;
      });
      return { workout: w, sleep: prevNight };
    });

    const poorSleepWorkouts = sleepWorkoutPairs.filter(
      ({ sleep: s }) => s && s.durationHours < 6,
    ).length;
    if (poorSleepWorkouts >= 3) {
      patterns.push({
        type: 'sleep_workout_correlation',
        message: `You workout after poor sleep ${poorSleepWorkouts} times — reduce intensity on low-sleep days`,
        severity: 'medium',
      });
    }

    return patterns;
  }
}
