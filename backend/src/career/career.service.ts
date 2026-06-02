import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MemoryService } from '../ai/memory/memory.service';
import { CAREER_ROADMAP } from '../ai/prompts/prompts';
import { MemoryType } from '@prisma/client';

@Injectable()
export class CareerService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private memoryService: MemoryService,
  ) {}

  async logStudy(userId: string, data: any) {
    const log = await this.prisma.studyLog.create({
      data: {
        userId,
        topic: data.topic,
        subtopics: data.subtopics || [],
        durationMin: data.durationMin,
        notes: data.notes,
        resources: data.resources || [],
      },
    });
    await this.memoryService.updateCareerMemory(userId, data);
    return log;
  }

  async getStudyHistory(userId: string) {
    return this.prisma.studyLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    });
  }

  async getRoadmap(userId: string) {
    const studyLogs = await this.prisma.studyLog.findMany({ where: { userId } });
    const memory = await this.prisma.aIMemory.findUnique({
      where: { userId_memoryType: { userId, memoryType: MemoryType.CAREER } },
    });

    const careerData = (memory?.content as any) || {};
    const topicsProgress = careerData.topicsProgress || {};

    const roadmapWithProgress = CAREER_ROADMAP.map((item) => {
      const minutesStudied = topicsProgress[item.topic] || 0;
      const hoursStudied = Math.round(minutesStudied / 60);
      const completion = Math.min(100, Math.round((hoursStudied / item.estimatedHours) * 100));
      return {
        ...item,
        hoursStudied,
        completion,
        status: completion >= 100 ? 'completed' : completion > 0 ? 'in-progress' : 'not-started',
      };
    });

    const careerScore = Math.round(
      roadmapWithProgress.reduce((a, t) => a + t.completion, 0) / CAREER_ROADMAP.length,
    );

    return {
      roadmap: roadmapWithProgress,
      careerScore,
      totalHours: careerData.totalHours || 0,
      currentTopic: careerData.currentTopic || 'Docker',
    };
  }

  async careerChat(userId: string, message: string) {
    return this.aiService.careerCoach(userId, message);
  }

  async getCareerStats(userId: string) {
    const logs = await this.prisma.studyLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    });

    const totalMinutes = logs.reduce((a, l) => a + l.durationMin, 0);
    const last7Days = logs.filter(
      (l) => new Date(l.loggedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const weeklyHours = Math.round(last7Days.reduce((a, l) => a + l.durationMin, 0) / 60);

    const topicCounts: Record<string, number> = {};
    logs.forEach((l) => {
      topicCounts[l.topic] = (topicCounts[l.topic] || 0) + l.durationMin;
    });

    return {
      totalHours: Math.round(totalMinutes / 60),
      weeklyHours,
      studyDaysThisMonth: logs.length,
      topicBreakdown: topicCounts,
      recentLogs: logs.slice(0, 7),
    };
  }
}
