import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT } from '../prisma/prisma-safe-select';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async generateWeeklyReport(userId: string) {
    const aiInsights = await this.aiService.generateWeeklyReport(userId);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const [habitLogs, workoutLogs, sleepLogs, studyLogs, dietLogs] = await Promise.all([
      this.prisma.habitLog.findMany({ where: { userId, date: { gte: weekStart } } }),
      this.prisma.workoutLog.findMany({ where: { userId, loggedAt: { gte: weekStart } }, select: SAFE_WORKOUT_SELECT }),
      this.prisma.sleepLog.findMany({ where: { userId, loggedAt: { gte: weekStart } } }),
      this.prisma.studyLog.findMany({ where: { userId, loggedAt: { gte: weekStart } } }),
      this.prisma.dietLog.findMany({ where: { userId, loggedAt: { gte: weekStart } }, select: SAFE_DIET_SELECT }),
    ]);

    const report = {
      fitness: {
        workoutsCompleted: workoutLogs.length,
        gymDays: habitLogs.filter((h) => h.gym).length,
        avgProtein: dietLogs.length
          ? Math.round(dietLogs.reduce((a, d) => a + d.totalProteinG, 0) / dietLogs.length)
          : 0,
      },
      sleep: {
        avgDuration: sleepLogs.length
          ? Math.round((sleepLogs.reduce((a, s) => a + s.durationHours, 0) / sleepLogs.length) * 10) / 10
          : 0,
        nightsLogged: sleepLogs.length,
      },
      habits: {
        gymDays: habitLogs.filter((h) => h.gym).length,
        studyDays: habitLogs.filter((h) => h.study).length,
        englishDays: habitLogs.filter((h) => h.english).length,
        kannadaDays: habitLogs.filter((h) => h.kannada).length,
      },
      career: {
        studySessions: studyLogs.length,
        totalHours: Math.round(studyLogs.reduce((a, s) => a + s.durationMin, 0) / 60),
        topics: [...new Set(studyLogs.map((s) => s.topic))],
      },
    };

    return this.prisma.weeklyReport.create({
      data: {
        userId,
        weekStart,
        weekEnd: now,
        report,
        aiInsights,
      },
    });
  }

  async getReports(userId: string) {
    return this.prisma.weeklyReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async getLatestReport(userId: string) {
    return this.prisma.weeklyReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Auto-generate weekly reports every Sunday at 8PM
  @Cron('0 20 * * 0')
  async autoGenerateReports() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      await this.generateWeeklyReport(user.id).catch(console.error);
    }
    console.log(`Auto-generated weekly reports for ${users.length} users`);
  }
}
