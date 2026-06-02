import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class HabitsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async checkIn(userId: string, data: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.habitLog.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        gym: data.gym ?? false,
        sleep: data.sleep ?? false,
        study: data.study ?? false,
        english: data.english ?? false,
        kannada: data.kannada ?? false,
        waterLitres: data.waterLitres ?? 0,
        notes: data.notes,
      },
      create: {
        userId,
        date: today,
        gym: data.gym ?? false,
        sleep: data.sleep ?? false,
        study: data.study ?? false,
        english: data.english ?? false,
        kannada: data.kannada ?? false,
        waterLitres: data.waterLitres ?? 0,
        notes: data.notes,
      },
    });
  }

  async getHabitHistory(userId: string) {
    return this.prisma.habitLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }

  async getHabitScores(userId: string) {
    const logs = await this.prisma.habitLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 30,
    });

    if (!logs.length) {
      return {
        disciplineScore: 0,
        consistencyScore: 0,
        streaks: { gym: 0, sleep: 0, study: 0, english: 0, kannada: 0 },
        weeklyCompletion: {},
        logs: [],
      };
    }

    const last7 = logs.slice(0, 7);
    const gymDays = last7.filter((l) => l.gym).length;
    const sleepDays = last7.filter((l) => l.sleep).length;
    const studyDays = last7.filter((l) => l.study).length;
    const englishDays = last7.filter((l) => l.english).length;
    const kannadaDays = last7.filter((l) => l.kannada).length;
    const waterDays = last7.filter((l) => l.waterLitres >= 2.5).length;

    const weeklyCompletion = {
      gym: Math.round((gymDays / 7) * 100),
      sleep: Math.round((sleepDays / 7) * 100),
      study: Math.round((studyDays / 7) * 100),
      english: Math.round((englishDays / 7) * 100),
      kannada: Math.round((kannadaDays / 7) * 100),
      water: Math.round((waterDays / 7) * 100),
    };

    const disciplineScore = Math.round(
      (gymDays * 25 + sleepDays * 20 + studyDays * 20 + englishDays * 15 + kannadaDays * 10 + waterDays * 10) /
      (7 * 100) * 100,
    );

    const streaks = {
      gym: this.calculateStreak(logs, 'gym'),
      sleep: this.calculateStreak(logs, 'sleep'),
      study: this.calculateStreak(logs, 'study'),
      english: this.calculateStreak(logs, 'english'),
      kannada: this.calculateStreak(logs, 'kannada'),
    };

    const allHabitsAvg = Object.values(weeklyCompletion).reduce((a, b) => a + b, 0) / 6;
    const consistencyScore = Math.round(allHabitsAvg);

    return { disciplineScore, consistencyScore, streaks, weeklyCompletion, logs };
  }

  private calculateStreak(logs: any[], habit: string): number {
    let streak = 0;
    for (const log of logs) {
      if (log[habit]) streak++;
      else break;
    }
    return streak;
  }

  async getStreaks(userId: string) {
    const logs = await this.prisma.habitLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 90,
    });
    if (!logs.length) {
      return { gym: 0, sleep: 0, study: 0, english: 0, kannada: 0, overall: 0 };
    }
    const gym = this.calculateStreak(logs, 'gym');
    const sleep = this.calculateStreak(logs, 'sleep');
    const study = this.calculateStreak(logs, 'study');
    const english = this.calculateStreak(logs, 'english');
    const kannada = this.calculateStreak(logs, 'kannada');

    // "Overall" streak: days where at least 3 core habits were completed
    let overall = 0;
    for (const log of logs) {
      const coreHabits = [log.gym, log.sleep, log.study].filter(Boolean).length;
      if (coreHabits >= 2) overall++;
      else break;
    }

    return { gym, sleep, study, english, kannada, overall };
  }

  async saveMorningCheckin(userId: string, data: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prismaAny = this.prisma as any;
    if (!prismaAny.morningCheckin) {
      return { error: 'Run database migration: npx prisma db push' };
    }

    const checkin = await prismaAny.morningCheckin.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        mood: data.mood,
        energy: data.energy,
        yesterdayRating: data.yesterdayRating,
        todayGoals: data.todayGoals || [],
        completedVia: 'web',
      },
      create: {
        userId,
        date: today,
        mood: data.mood,
        energy: data.energy,
        yesterdayRating: data.yesterdayRating,
        todayGoals: data.todayGoals || [],
        completedVia: 'web',
      },
    });

    return checkin;
  }

  async getMorningCheckin(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const prismaAny = this.prisma as any;
    if (!prismaAny.morningCheckin) return null;

    const [todayCheckin, aiMessage, streaks] = await Promise.all([
      prismaAny.morningCheckin.findFirst({
        where: { userId, date: { gte: today, lt: tomorrow } },
      }),
      this.aiService.generateMorningCheckin(userId).catch(() => null),
      this.getStreaks(userId),
    ]);

    return { todayCheckin, aiMessage, streaks };
  }
}
