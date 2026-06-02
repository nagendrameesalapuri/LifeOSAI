import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SleepService {
  constructor(private prisma: PrismaService) {}

  async logSleep(userId: string, data: any) {
    const bedtime = new Date(data.bedtime);
    const wakeupTime = new Date(data.wakeupTime);
    const durationHours = (wakeupTime.getTime() - bedtime.getTime()) / (1000 * 60 * 60);
    const qualityScore = this.calculateSleepQuality(durationHours, data.qualityScore);

    return this.prisma.sleepLog.create({
      data: {
        userId,
        bedtime,
        wakeupTime,
        durationHours: Math.round(durationHours * 10) / 10,
        qualityScore,
        notes: data.notes,
      },
    });
  }

  async getSleepHistory(userId: string) {
    return this.prisma.sleepLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    });
  }

  async getSleepScore(userId: string) {
    const logs = await this.prisma.sleepLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 7,
    });

    if (!logs.length) return { sleepScore: 0, avgDuration: 0, avgQuality: 0, logs: [] };

    const avgDuration = logs.reduce((a, l) => a + l.durationHours, 0) / logs.length;
    const avgQuality = logs.reduce((a, l) => a + l.qualityScore, 0) / logs.length;

    const durationScore = Math.min(100, Math.round((avgDuration / 8) * 100));
    const qualityScore = Math.round(avgQuality * 10);
    const consistencyScore = this.calculateConsistency(logs);

    const sleepScore = Math.round(durationScore * 0.4 + qualityScore * 0.4 + consistencyScore * 0.2);

    return {
      sleepScore,
      avgDuration: Math.round(avgDuration * 10) / 10,
      avgQuality: Math.round(avgQuality * 10) / 10,
      recoveryScore: Math.round(sleepScore * 0.9),
      logs,
    };
  }

  private calculateSleepQuality(duration: number, userScore?: number): number {
    if (userScore) return Math.min(10, Math.max(1, userScore));
    if (duration >= 7.5 && duration <= 9) return 8;
    if (duration >= 7 && duration <= 9.5) return 7;
    if (duration >= 6) return 5;
    return 3;
  }

  private calculateConsistency(logs: any[]): number {
    if (logs.length < 2) return 50;
    const durations = logs.map((l) => l.durationHours);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((a, d) => a + Math.pow(d - avg, 2), 0) / durations.length;
    return Math.max(0, Math.min(100, Math.round(100 - variance * 10)));
  }
}
