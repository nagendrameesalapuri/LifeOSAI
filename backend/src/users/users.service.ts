import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const base = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true,
        weightKg: true, targetWeightKg: true,
        heightCm: true, age: true, profession: true,
        createdAt: true,
      },
    });
    if (!base) return null;

    try {
      const extended = await (this.prisma.user.findUnique as any)({
        where: { id: userId },
        select: {
          activityLevel: true, tdeeKcal: true, gymDaysPerWeek: true,
          dailyProteinTarget: true, dailyCalorieTarget: true,
          gymAccess: true, fitnessLevel: true,
          onboardingComplete: true, telegramChatId: true,
          primaryGoal: true, motivationNote: true,
          careerGoal: true, careerGoalCustom: true,
          languageGoals: true, nativeLanguage: true,
        },
      });
      return { ...base, ...extended };
    } catch {
      return base;
    }
  }

  async getStats(userId: string) {
    const [
      workoutCount, weightLogCount, sleepLogCount, dietLogCount,
      studyLogs, englishLogs, kannadaLogs, habitLogs, bodyMeasurements,
      weeklyReports, morningCheckins, lifeScore,
    ] = await Promise.all([
      this.prisma.workoutLog.count({ where: { userId } }),
      this.prisma.weightLog.count({ where: { userId } }),
      this.prisma.sleepLog.count({ where: { userId } }),
      this.prisma.dietLog.count({ where: { userId } }),
      this.prisma.studyLog.findMany({ where: { userId } }),
      this.prisma.englishLog.count({ where: { userId } }),
      this.prisma.kannadaLog.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' } }),
      this.prisma.habitLog.count({ where: { userId } }),
      (this.prisma as any).bodyMeasurement?.count({ where: { userId } }).catch(() => 0) ?? 0,
      this.prisma.weeklyReport.count({ where: { userId } }),
      (this.prisma as any).morningCheckin?.count({ where: { userId } }).catch(() => 0) ?? 0,
      this.prisma.lifeScore.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    ]);

    const totalStudyMinutes = studyLogs.reduce((a, l) => a + l.durationMin, 0);
    const studyTopics = [...new Set(studyLogs.map(l => l.topic))];

    // Calculate days since joining
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    const daysSinceJoin = user ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000) : 0;

    // 30-day habit log for streak
    const recentHabits = await this.prisma.habitLog.findMany({
      where: { userId }, orderBy: { date: 'desc' }, take: 90,
    });
    let gymStreak = 0;
    for (const h of recentHabits) { if (h.gym) gymStreak++; else break; }

    return {
      workoutCount,
      weightLogCount,
      sleepLogCount,
      dietLogCount,
      totalStudyHours: Math.round(totalStudyMinutes / 60),
      totalStudyMinutes,
      studyTopicsCount: studyTopics.length,
      studyTopics,
      englishCorrections: englishLogs,
      kannadaVocab: kannadaLogs?.vocabularyCount || 0,
      habitLogCount: habitLogs,
      bodyMeasurementCount: bodyMeasurements,
      weeklyReportCount: weeklyReports,
      morningCheckinCount: morningCheckins,
      currentLifeScore: lifeScore?.overall || 0,
      gymStreak,
      daysSinceJoin,
    };
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    const allowed = [
      'name', 'weightKg', 'targetWeightKg', 'heightCm', 'age', 'profession',
      'activityLevel', 'gymDaysPerWeek', 'gymAccess', 'fitnessLevel',
      'primaryGoal', 'motivationNote', 'onboardingComplete', 'telegramChatId',
      'dailyCalorieTarget', 'dailyProteinTarget', 'tdeeKcal',
      'careerGoal', 'careerGoalCustom', 'languageGoals', 'nativeLanguage',
    ];
    for (const field of allowed) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }
    return (this.prisma.user.update as any)({ where: { id: userId }, data: updateData });
  }
}
