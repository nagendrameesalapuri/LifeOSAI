import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { EnglishService } from '../english/english.service';
import { KANNADA_CURRICULUM } from '../ai/prompts/prompts';

@Injectable()
export class KannadaService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private englishService: EnglishService,
  ) {}

  private getTodayKannadaDay(): number {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
    return (dayOfYear % KANNADA_CURRICULUM.length) + 1;
  }

  async getDailyLesson(userId: string, dayOverride?: number) {
    const dayNumber = dayOverride ?? this.getTodayKannadaDay();

    // DB-first: if today's lesson already exists for this dayNumber, return it
    if (!dayOverride) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const cached = await this.prisma.dailyLesson.findFirst({
        where: {
          userId,
          language: 'kannada',
          dayNumber,
          date: { gte: today, lt: tomorrow },
        },
      });

      if (cached?.lessonData && !(cached.lessonData as any)?.parseError) {
        const reviewCards = await this.englishService.getDueVocabularyCards(userId, 'kannada').catch(() => []);
        return { ...(cached.lessonData as any), reviewCards: reviewCards.slice(0, 5), fromCache: true };
      }
    }

    // Cache miss — call AI
    const lesson = await this.aiService.getKannadaLesson(userId, dayOverride);

    if (lesson?.dayNumber && !lesson?.parseError) {
      await this.prisma.dailyLesson.upsert({
        where: { userId_language_dayNumber: { userId, language: 'kannada', dayNumber: lesson.dayNumber } },
        update: { lessonData: lesson, topic: lesson.theme || 'Kannada Lesson' },
        create: { userId, language: 'kannada', dayNumber: lesson.dayNumber, topic: lesson.theme || 'Kannada Lesson', lessonData: lesson },
      });

      if (lesson?.words) {
        for (const word of lesson.words) {
          await this.englishService.addVocabularyCard(userId, {
            word: word.kannada,
            meaning: word.meaning,
            example: word.when_to_use,
            pronunciation: word.pronunciation,
          }, 'kannada').catch(() => {});
        }
      }
    }

    const reviewCards = await this.englishService.getDueVocabularyCards(userId, 'kannada').catch(() => []);
    return { ...lesson, reviewCards: reviewCards.slice(0, 5) };
  }

  async getLessonByDay(userId: string, dayNumber: number) {
    const existing = await this.prisma.dailyLesson.findUnique({
      where: { userId_language_dayNumber: { userId, language: 'kannada', dayNumber } },
    });

    if (existing) return existing.lessonData;

    return this.getDailyLesson(userId, dayNumber);
  }

  getCurriculum() {
    return KANNADA_CURRICULUM;
  }

  async getLessonHistory(userId: string) {
    return this.prisma.dailyLesson.findMany({
      where: { userId, language: 'kannada' },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }

  async completeLesson(userId: string, dayNumber: number) {
    return this.prisma.dailyLesson.updateMany({
      where: { userId, language: 'kannada', dayNumber },
      data: { completed: true, completedAt: new Date() },
    });
  }

  async logProgress(userId: string, data: any) {
    const lastLog = await this.prisma.kannadaLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
    });

    const newVocabCount = (lastLog?.vocabularyCount || 0) + (data.wordsLearned?.length || 0);

    return this.prisma.kannadaLog.create({
      data: {
        userId,
        wordsLearned: data.wordsLearned || [],
        practiceText: data.practiceText,
        vocabularyCount: newVocabCount,
        confidenceScore: data.confidenceScore || 1,
      },
    });
  }

  async getProgress(userId: string) {
    const [logs, vocabStats, completedLessons] = await Promise.all([
      this.prisma.kannadaLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 30,
      }),
      this.englishService.getAllVocabularyCards(userId, 'kannada'),
      this.prisma.dailyLesson.findMany({
        where: { userId, language: 'kannada', completed: true },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const totalVocab = vocabStats.length; // Use actual vocab bank count
    const avgConfidence = logs.length
      ? Math.round(logs.reduce((a, l) => a + l.confidenceScore, 0) / logs.length)
      : 0;

    const allWords = vocabStats.map((v) => v.word);
    const kannadaScore = Math.min(100, Math.round((totalVocab / 500) * 100));

    // Current curriculum position
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const currentDay = dayOfYear % KANNADA_CURRICULUM.length + 1;
    const currentCurriculum = KANNADA_CURRICULUM[currentDay - 1];

    return {
      totalVocab,
      avgConfidence,
      kannadaScore,
      completedLessons: completedLessons.length,
      currentDay,
      currentLevel: currentCurriculum?.level,
      recentWords: allWords.slice(0, 20),
      logs: logs.slice(0, 10),
      curriculum: KANNADA_CURRICULUM,
    };
  }

  async getScriptLesson(userId: string) {
    // Structured Kannada script lessons
    const SCRIPT_LESSONS = [
      {
        section: 'Vowels (ಸ್ವರಗಳು)',
        letters: [
          { letter: 'ಅ', name: 'a', sound: 'like a in "about"', example: 'ಅಮ್ಮ (amma = mother)' },
          { letter: 'ಆ', name: 'aa', sound: 'like a in "father"', example: 'ಆಕಾಶ (aakaasha = sky)' },
          { letter: 'ಇ', name: 'i', sound: 'like i in "in"', example: 'ಇಲ್ಲ (illa = no/not here)' },
          { letter: 'ಈ', name: 'ee', sound: 'like ee in "see"', example: 'ಈರುಳ್ಳಿ (eerulli = onion)' },
          { letter: 'ಉ', name: 'u', sound: 'like u in "put"', example: 'ಉಪ್ಪು (uppu = salt)' },
          { letter: 'ಊ', name: 'oo', sound: 'like oo in "food"', example: 'ಊಟ (ooTa = meal)' },
        ],
      },
      {
        section: 'Common Consonants Group 1 (ಕ ವರ್ಗ)',
        letters: [
          { letter: 'ಕ', name: 'ka', sound: 'like k in "kite"', example: 'ಕಣ್ಣು (kannu = eye)' },
          { letter: 'ಖ', name: 'kha', sound: 'k with breath', example: 'ಖಾಲಿ (khaali = empty)' },
          { letter: 'ಗ', name: 'ga', sound: 'like g in "go"', example: 'ಗಡಿಯಾರ (gadiyaara = clock)' },
          { letter: 'ನ', name: 'na', sound: 'like n in "name"', example: 'ನಮಸ್ಕಾರ (namaskara = hello)' },
        ],
      },
    ];

    return SCRIPT_LESSONS;
  }
}
