import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MemoryService } from '../ai/memory/memory.service';
import { MemoryType } from '@prisma/client';

@Injectable()
export class EnglishService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private memoryService: MemoryService,
  ) {}

  // Safe accessor for new models (only exist after migration)
  private get db() { return this.prisma as any; }
  private get hasErrorPattern() { return !!this.db.errorPattern; }
  private get hasVocabCard() { return !!this.db.vocabularyCard; }

  async correctText(userId: string, text: string) {
    const result = await this.aiService.correctEnglish(text);

    await this.prisma.englishLog.create({
      data: {
        userId,
        inputText: text,
        correctedText: result.correctedText || text,
        mistakes: result.mistakes || [],
        grammarScore: result.grammarScore || 75,
      },
    });

    await this.memoryService.updateEnglishMemory(userId, result);

    if (result.mistakes?.length > 0) {
      await this.updateErrorPatterns(userId, result.mistakes).catch(() => {});
    }

    return result;
  }

  private async updateErrorPatterns(userId: string, mistakes: any[]) {
    if (!this.hasErrorPattern) return;

    for (const mistake of mistakes) {
      try {
        const errorType = mistake.type || 'general';
        const example = {
          original: mistake.original,
          corrected: mistake.corrected,
          date: new Date().toISOString(),
        };

        const existing = await this.db.errorPattern.findUnique({
          where: { userId_errorType: { userId, errorType } },
        });

        if (existing) {
          const examples = (existing.examples as any[]) || [];
          examples.push(example);
          await this.db.errorPattern.update({
            where: { userId_errorType: { userId, errorType } },
            data: { count: existing.count + 1, examples: examples.slice(-10), lastSeen: new Date() },
          });
        } else {
          await this.db.errorPattern.create({
            data: { userId, errorType, count: 1, examples: [example] },
          });
        }
      } catch {}
    }
  }

  async getErrorPatterns(userId: string) {
    if (!this.hasErrorPattern) {
      return { patterns: [], analysis: null, message: 'Run database migration to enable pattern tracking' };
    }

    try {
      const patterns = await this.db.errorPattern.findMany({
        where: { userId },
        orderBy: { count: 'desc' },
      });

      if (!patterns.length) return { patterns: [], analysis: null };

      const analysis = await this.aiService.analyzeErrorPatterns(patterns).catch(() => null);

      return {
        patterns: patterns.map((p: any) => ({
          ...p,
          severity: p.count >= 10 ? 'high' : p.count >= 5 ? 'medium' : 'low',
        })),
        analysis,
      };
    } catch (e) {
      return { patterns: [], analysis: null };
    }
  }

  private getTodayDayNumber(): number {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
    const TOPIC_COUNT = 30; // matches DAILY_TOPICS length in ai.service.ts
    return (dayOfYear % TOPIC_COUNT) + 1;
  }

  async getLesson(userId: string, topic?: string) {
    // DB-first: if today's lesson already exists and was generated today, return it
    if (!topic) {
      const dayNumber = this.getTodayDayNumber();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const cached = await this.prisma.dailyLesson.findFirst({
        where: {
          userId,
          language: 'english',
          dayNumber,
          date: { gte: today, lt: tomorrow },
        },
      });

      if (cached?.lessonData) {
        // Return cached lesson + fresh review words
        const reviewWords = this.hasVocabCard
          ? await this.getDueVocabularyCards(userId).catch(() => [])
          : [];
        return { ...(cached.lessonData as any), reviewWords: reviewWords.slice(0, 5), fromCache: true };
      }
    }

    // Cache miss — call AI
    const lesson = await this.aiService.getEnglishLesson(topic, userId);

    if (lesson?.dayNumber) {
      await this.prisma.dailyLesson.upsert({
        where: { userId_language_dayNumber: { userId, language: 'english', dayNumber: lesson.dayNumber } },
        update: { lessonData: lesson, topic: lesson.topic || 'English Lesson' },
        create: { userId, language: 'english', dayNumber: lesson.dayNumber, topic: lesson.topic || 'English Lesson', lessonData: lesson },
      });
    }

    if (lesson?.vocabulary && this.hasVocabCard) {
      for (const word of lesson.vocabulary) {
        await this.addVocabularyCard(userId, {
          word: word.word,
          meaning: word.meaning,
          example: word.example,
          pronunciation: word.pronunciation,
        }, 'english').catch(() => {});
      }
    }

    const reviewWords = this.hasVocabCard
      ? await this.getDueVocabularyCards(userId).catch(() => [])
      : [];
    return { ...lesson, reviewWords: reviewWords.slice(0, 5) };
  }

  async getLessonHistory(userId: string) {
    return this.prisma.dailyLesson.findMany({
      where: { userId, language: 'english' },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }

  async completeLesson(userId: string, dayNumber: number) {
    return this.prisma.dailyLesson.updateMany({
      where: { userId, language: 'english', dayNumber },
      data: { completed: true, completedAt: new Date() },
    });
  }

  async practiceSpeaking(situation: string) {
    return this.aiService.practiceEnglishSpeaking(situation);
  }

  async getEnglishHistory(userId: string) {
    return this.prisma.englishLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 20,
    });
  }

  async getEnglishStats(userId: string) {
    const logs = await this.prisma.englishLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    });

    if (!logs.length) return { grammarScore: 0, totalCorrections: 0, improvementTrend: 'not started' };

    const avgScore = Math.round(logs.reduce((a, l) => a + l.grammarScore, 0) / logs.length);
    const totalMistakes = logs.reduce((a, l) => a + (l.mistakes as any[]).length, 0);

    const recentScore = logs.slice(0, 5).reduce((a, l) => a + l.grammarScore, 0) / Math.min(logs.length, 5);
    const olderScore = logs.slice(5, 15).length
      ? logs.slice(5, 15).reduce((a, l) => a + l.grammarScore, 0) / logs.slice(5, 15).length
      : recentScore;

    const trend = recentScore > olderScore ? 'improving' : recentScore < olderScore ? 'declining' : 'stable';

    const thisWeek = logs.filter((l) => new Date(l.loggedAt) > new Date(Date.now() - 7 * 86400000));
    const lastWeek = logs.filter((l) => {
      const d = new Date(l.loggedAt);
      return d > new Date(Date.now() - 14 * 86400000) && d <= new Date(Date.now() - 7 * 86400000);
    });
    const thisWeekAvg = thisWeek.length ? Math.round(thisWeek.reduce((a, l) => a + l.grammarScore, 0) / thisWeek.length) : 0;
    const lastWeekAvg = lastWeek.length ? Math.round(lastWeek.reduce((a, l) => a + l.grammarScore, 0) / lastWeek.length) : 0;

    return {
      grammarScore: avgScore,
      totalCorrections: totalMistakes,
      improvementTrend: trend,
      recentScore: Math.round(recentScore),
      thisWeekAvg,
      lastWeekAvg,
      weekOverWeek: thisWeekAvg - lastWeekAvg,
      logs: logs.slice(0, 10),
    };
  }

  // SPACED REPETITION (SM-2 algorithm)
  async addVocabularyCard(userId: string, wordData: any, language: string = 'english') {
    if (!this.hasVocabCard) return null;

    try {
      const existing = await this.db.vocabularyCard.findFirst({
        where: { userId, word: wordData.word, language },
      });
      if (existing) return existing;

      return this.db.vocabularyCard.create({
        data: {
          userId,
          word: wordData.word,
          meaning: wordData.meaning,
          example: wordData.example,
          pronunciation: wordData.pronunciation,
          language,
          nextReview: new Date(),
          intervalDays: 1,
          easeFactor: 2.5,
        },
      });
    } catch (e) {
      return null;
    }
  }

  async getDueVocabularyCards(userId: string, language: string = 'english') {
    if (!this.hasVocabCard) return [];
    try {
      return this.db.vocabularyCard.findMany({
        where: { userId, language, nextReview: { lte: new Date() } },
        orderBy: { nextReview: 'asc' },
        take: 20,
      });
    } catch { return []; }
  }

  async getAllVocabularyCards(userId: string, language: string = 'english') {
    if (!this.hasVocabCard) return [];
    try {
      return this.db.vocabularyCard.findMany({
        where: { userId, language },
        orderBy: { createdAt: 'desc' },
      });
    } catch { return []; }
  }

  async reviewVocabularyCard(userId: string, cardId: string, quality: number) {
    if (!this.hasVocabCard) throw new Error('Migration required');

    const card = await this.db.vocabularyCard.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) throw new Error('Card not found');

    let { intervalDays, easeFactor, reviewCount, successCount } = card;
    reviewCount += 1;

    if (quality < 3) {
      intervalDays = 1;
    } else {
      successCount += 1;
      if (reviewCount === 1) intervalDays = 1;
      else if (reviewCount === 2) intervalDays = 6;
      else intervalDays = Math.round(intervalDays * easeFactor);
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);

    return this.db.vocabularyCard.update({
      where: { id: cardId },
      data: { intervalDays, easeFactor, reviewCount, successCount, nextReview, lastReviewed: new Date() },
    });
  }

  async getVocabularyStats(userId: string) {
    if (!this.hasVocabCard) return { total: 0, dueToday: 0, mastered: 0, learning: 0 };
    try {
      const [total, dueToday, mastered] = await Promise.all([
        this.db.vocabularyCard.count({ where: { userId } }),
        this.db.vocabularyCard.count({ where: { userId, nextReview: { lte: new Date() } } }),
        this.db.vocabularyCard.count({ where: { userId, intervalDays: { gte: 21 } } }),
      ]);
      return { total, dueToday, mastered, learning: total - mastered };
    } catch { return { total: 0, dueToday: 0, mastered: 0, learning: 0 }; }
  }
}
