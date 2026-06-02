import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { MemoryService } from './memory/memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_PROMPTS, KANNADA_CURRICULUM } from './prompts/prompts';

// Simple in-memory cache entry
interface CacheEntry { data: any; expiresAt: number }

@Injectable()
export class AiService {
  private client: Anthropic;
  private readonly HAIKU = 'claude-haiku-4-5-20251001';
  private readonly SONNET = 'claude-sonnet-4-6';

  // Per-user per-day caches
  private readonly workoutPlanCache = new Map<string, CacheEntry>();
  private readonly dietPlanCache = new Map<string, CacheEntry>();
  private readonly morningCheckinCache = new Map<string, CacheEntry>();
  private readonly proactiveInsightsCache = new Map<string, CacheEntry>();

  constructor(
    private memoryService: MemoryService,
    private prisma: PrismaService,
  ) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  private dayKey(userId: string): string {
    // Key changes at midnight so cache auto-expires daily
    const d = new Date();
    return `${userId}_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
  }

  private async getUserProfile(userId: string) {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, profession: true,
          nativeLanguage: true, languageGoals: true,
          careerGoal: true, careerGoalCustom: true,
        } as any,
      });
    } catch {
      // Prisma client may not have new fields yet — fall back to safe subset
      return this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, profession: true },
      });
    }
  }

  private extractJson(raw: string): any {
    // Strip markdown code fences
    const stripped = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    // Try direct parse first
    try { return JSON.parse(stripped); } catch {}
    // Find the first { ... } block spanning the whole text
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(stripped.slice(start, end + 1)); } catch {}
    }
    return null;
  }

  async chat(userId: string, message: string): Promise<string> {
    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 1024,
      system: SYSTEM_PROMPTS.MAIN_COACH(context),
      messages: [{ role: 'user', content: message }],
    });
    return (response.content[0] as any).text;
  }

  async correctEnglish(text: string, userId?: string): Promise<any> {
    const userProfile = userId ? await this.getUserProfile(userId) : null;
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 1024,
      system: SYSTEM_PROMPTS.ENGLISH_CORRECTION(userProfile as any),
      messages: [{ role: 'user', content: `Please correct this text: "${text}"` }],
    });
    const raw = (response.content[0] as any).text;
    return this.extractJson(raw) || { correctedText: text, mistakes: [], grammarScore: 75, encouragement: 'Good effort!' };
  }

  async generateWorkoutPlan(userId: string): Promise<any> {
    const key = this.dayKey(userId);
    const cached = this.workoutPlanCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.WORKOUT_PLAN(context),
      messages: [{ role: 'user', content: 'Generate my workout plan for today based on my history and goals.' }],
    });
    const raw = (response.content[0] as any).text;
    const data = this.extractJson(raw) || { plan: raw };
    // Cache until end of day (midnight)
    const midnight = new Date(); midnight.setHours(23, 59, 59, 999);
    this.workoutPlanCache.set(key, { data, expiresAt: midnight.getTime() });
    return data;
  }

  async generateWorkoutProgram(userId: string): Promise<any> {
    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 4096,
      system: SYSTEM_PROMPTS.WORKOUT_PROGRAM_GENERATOR(context),
      messages: [{ role: 'user', content: 'Generate a 12-week workout program for lean muscle building based on my profile.' }],
    });
    const raw = (response.content[0] as any).text;
    try {
      return JSON.parse(raw.replace(/```json?\n?|\n?```/g, '').trim());
    } catch {
      return { error: 'Could not generate program', raw };
    }
  }

  async generateDietPlan(userId: string): Promise<any> {
    const key = this.dayKey(userId);
    const cached = this.dietPlanCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 3000,
      system: SYSTEM_PROMPTS.DIET_PLAN(context),
      messages: [{ role: 'user', content: 'Generate my meal plan for today with meal timing based on my goals.' }],
    });
    const raw = (response.content[0] as any).text;
    const data = this.extractJson(raw) || { plan: raw };
    const midnight = new Date(); midnight.setHours(23, 59, 59, 999);
    this.dietPlanCache.set(key, { data, expiresAt: midnight.getTime() });
    return data;
  }

  async getKannadaLesson(userId: string, dayOverride?: number): Promise<any> {
    const [userProfile] = await Promise.all([this.getUserProfile(userId)]);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
    const curriculumIndex = (dayOverride != null ? dayOverride - 1 : dayOfYear) % KANNADA_CURRICULUM.length;
    const curriculum = KANNADA_CURRICULUM[curriculumIndex];
    const dayNumber = curriculumIndex + 1;
    const nativeLang = (userProfile as any)?.nativeLanguage || 'telugu';

    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 2500,
      system: SYSTEM_PROMPTS.KANNADA_LESSON(userProfile as any),
      messages: [{
        role: 'user',
        content: `Day ${dayNumber} of ${KANNADA_CURRICULUM.length}.
Theme: "${curriculum.theme}"
Level: ${curriculum.level}
Teach this topic with 5-7 words and 2-3 sentences for a heritage learner whose native language is ${nativeLang}.`,
      }],
    });
    const raw = (response.content[0] as any).text;
    const parsed = this.extractJson(raw);
    if (parsed) {
      return { ...parsed, dayNumber, curriculum: curriculum.level };
    }
    // Fallback: at least return the theme so the page doesn't break
    console.error('Kannada lesson JSON parse failed. Raw:', raw.slice(0, 200));
    return { theme: curriculum.theme, dayNumber, curriculum: curriculum.level, parseError: true };
  }

  async careerCoach(userId: string, message: string): Promise<string> {
    const [context, userProfile] = await Promise.all([
      this.memoryService.getContextualMemory(userId),
      this.getUserProfile(userId),
    ]);
    const careerProfile = {
      currentRole: (userProfile as any)?.profession,
      careerGoal: (userProfile as any)?.careerGoal,
      careerGoalCustom: (userProfile as any)?.careerGoalCustom,
    };
    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 1024,
      system: SYSTEM_PROMPTS.CAREER_COACH(context, careerProfile),
      messages: [{ role: 'user', content: message }],
    });
    return (response.content[0] as any).text;
  }

  async generateWeeklyReport(userId: string): Promise<string> {
    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 3000,
      system: SYSTEM_PROMPTS.WEEKLY_REPORT(context),
      messages: [{ role: 'user', content: 'Generate my complete weekly life report with week-over-week comparison.' }],
    });
    return (response.content[0] as any).text;
  }

  async generateDailyPlan(userId: string): Promise<string> {
    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 1500,
      system: SYSTEM_PROMPTS.MAIN_COACH(context),
      messages: [{
        role: 'user',
        content: 'Generate my complete daily plan for today: workout, diet with timing, study topic, English practice, Kannada word, and top 3 priorities.',
      }],
    });
    return (response.content[0] as any).text;
  }

  async getEnglishLesson(topic?: string, userId?: string): Promise<any> {
    const userProfile = userId ? await this.getUserProfile(userId) : null;
    const DAILY_TOPICS = [
      'When to use HAVE vs HAS vs HAD',
      'Using WAS and WERE correctly',
      'Articles: A, AN, THE — when to use each',
      'Simple Present tense: AM / IS / ARE',
      'Simple Past tense (went, ate, did, was)',
      'How to ask questions in English',
      'Using WILL for future plans',
      'Saying what you WANT, NEED, LIKE',
      'Using SINCE and FOR with time',
      'Describing people and things (adjectives)',
      'How to say sorry and be polite',
      'Talking about daily routine',
      'Using CAN and COULD correctly',
      'Expressing opinions: I think, I feel, I believe',
      'Connecting sentences: AND, BUT, SO, BECAUSE',
      'Using SHOULD and MUST for advice',
      'Comparing things: more, most, better, best',
      'Talking about past habits: USED TO',
      'Using ALREADY, YET, STILL, JUST',
      'Prepositions: IN, ON, AT (time and place)',
      'Phrasal verbs for office: follow up, check in, wrap up',
      'Email writing basics: how to start and end',
      'Talking about your job and skills',
      'Asking for help politely at work',
      'Numbers, dates and times in English',
      'Body language words in English',
      'Positive and negative words (good/bad vocabulary)',
      'Idioms Indians use wrongly',
      'Speaking faster: contractions (I\'m, don\'t, can\'t)',
      'Building vocabulary: word families (act/action/active)',
    ];

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
    const todayTopic = topic || DAILY_TOPICS[dayOfYear % DAILY_TOPICS.length];
    const dayNumber = dayOfYear % DAILY_TOPICS.length + 1;

    const prompt = `Day ${dayNumber}. Topic: "${todayTopic}".
Teach this grammar topic and give 5 new vocabulary words for an Indian English learner.`;

    const response = await this.client.messages.create({
      model: this.SONNET,
      max_tokens: 2000,
      system: SYSTEM_PROMPTS.ENGLISH_LESSON(userProfile as any),
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = (response.content[0] as any).text;
    try {
      return JSON.parse(raw.replace(/```json?\n?|\n?```/g, '').trim());
    } catch {
      return { topic: todayTopic, dayNumber, error: raw };
    }
  }

  async practiceEnglishSpeaking(situation: string): Promise<any> {
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 800,
      system: SYSTEM_PROMPTS.ENGLISH_SPEAKING,
      messages: [{ role: 'user', content: situation }],
    });
    const raw = (response.content[0] as any).text;
    try {
      return JSON.parse(raw.replace(/```json?\n?|\n?```/g, '').trim());
    } catch {
      return null;
    }
  }

  async analyzeErrorPatterns(patterns: any[]): Promise<any> {
    const patternsText = patterns.map(p => `${p.errorType}: ${p.count} times`).join('\n');
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 1000,
      system: SYSTEM_PROMPTS.ENGLISH_PATTERN_ANALYSIS,
      messages: [{ role: 'user', content: `Analyze these error patterns:\n${patternsText}` }],
    });
    const raw = (response.content[0] as any).text;
    try {
      return JSON.parse(raw.replace(/```json?\n?|\n?```/g, '').trim());
    } catch {
      return null;
    }
  }

  async generateAiInsights(userId: string): Promise<string> {
    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 512,
      system: SYSTEM_PROMPTS.MAIN_COACH(context),
      messages: [{
        role: 'user',
        content: 'Give me 3 short AI insights about my performance this week. Be specific with numbers. One sentence each.',
      }],
    });
    return (response.content[0] as any).text;
  }

  async generateProactiveInsights(userId: string): Promise<any> {
    const key = this.dayKey(userId);
    const cached = this.proactiveInsightsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 1000,
      system: SYSTEM_PROMPTS.PROACTIVE_INSIGHTS(context),
      messages: [{ role: 'user', content: 'Analyze my data and give me specific proactive insights and nudges.' }],
    });
    const raw = (response.content[0] as any).text;
    const data = this.extractJson(raw) || { insights: [], weekPattern: raw };
    const midnight = new Date(); midnight.setHours(23, 59, 59, 999);
    this.proactiveInsightsCache.set(key, { data, expiresAt: midnight.getTime() });
    return data;
  }

  async generateMorningCheckin(userId: string): Promise<any> {
    const key = this.dayKey(userId);
    const cached = this.morningCheckinCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const context = await this.memoryService.getContextualMemory(userId);
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 800,
      system: SYSTEM_PROMPTS.MORNING_CHECKIN(context),
      messages: [{ role: 'user', content: 'Generate my morning check-in for today.' }],
    });
    const raw = (response.content[0] as any).text;
    const data = this.extractJson(raw) || { greeting: 'Good morning!', message: raw };
    const midnight = new Date(); midnight.setHours(23, 59, 59, 999);
    this.morningCheckinCache.set(key, { data, expiresAt: midnight.getTime() });
    return data;
  }

  async generateScoreBreakdown(userId: string, scores: any): Promise<any> {
    const context = await this.memoryService.getContextualMemory(userId);
    const scoresText = Object.entries(scores).map(([k, v]) => `${k}: ${v}/100`).join(', ');
    const response = await this.client.messages.create({
      model: this.HAIKU,
      max_tokens: 1500,
      system: SYSTEM_PROMPTS.SCORE_BREAKDOWN(context),
      messages: [{
        role: 'user',
        content: `Current scores: ${scoresText}. Explain why each score is what it is and how to improve.`,
      }],
    });
    const raw = (response.content[0] as any).text;
    try {
      return JSON.parse(raw.replace(/```json?\n?|\n?```/g, '').trim());
    } catch {
      return null;
    }
  }
}
