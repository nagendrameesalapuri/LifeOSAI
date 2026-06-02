'use client';
import { useCallback } from 'react';
import { api } from '../api';

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _tokenExpiry > now) return _cachedToken;

  const res = await fetch('/api/auth/token');
  if (!res.ok) throw new Error('Not authenticated');
  const { token } = await res.json();
  if (!token) throw new Error('Not authenticated');

  _cachedToken = token;
  _tokenExpiry = now + 50 * 60 * 1000;
  return token;
}

export function invalidateToken() {
  _cachedToken = null;
  _tokenExpiry = 0;
}

export function useApi() {
  const withToken = useCallback(
    async (fn: (token: string) => Promise<any>) => {
      const token = await getToken();
      return fn(token);
    },
    [],
  );

  return {
    getProfile: () => withToken(api.getProfile),
    updateProfile: (data: any) => withToken((t) => api.updateProfile(t, data)),
    getUserStats: () => withToken(api.getUserStats),

    // Analytics
    getDashboard: () => withToken(api.getDashboard),
    getTrends: () => withToken(api.getTrends),
    getInsights: () => withToken(api.getInsights),
    getScoreBreakdown: () => withToken(api.getScoreBreakdown),
    getProactiveInsights: () => withToken(api.getProactiveInsights),

    // Fitness
    logWeight: (data: any) => withToken((t) => api.logWeight(t, data)),
    getWeightHistory: () => withToken(api.getWeightHistory),
    logWorkout: (data: any) => withToken((t) => api.logWorkout(t, data)),
    getWorkoutHistory: () => withToken(api.getWorkoutHistory),
    getWorkoutPlan: () => withToken(api.getWorkoutPlan),
    getProgressiveOverload: (exercise: string) => withToken((t) => api.getProgressiveOverload(t, exercise)),
    getFitnessStats: () => withToken(api.getFitnessStats),
    generateProgram: () => withToken(api.generateProgram),
    getActiveProgram: () => withToken(api.getActiveProgram),
    completeSession: (sessionId: string, actualLog: any) => withToken((t) => api.completeSession(t, sessionId, actualLog)),
    logMeasurement: (data: any) => withToken((t) => api.logMeasurement(t, data)),
    getMeasurements: () => withToken(api.getMeasurements),

    // Diet
    logDiet: (data: any) => withToken((t) => api.logDiet(t, data)),
    getTodayDiet: () => withToken(api.getTodayDiet),
    logWater: (litres: number) => withToken((t) => api.logWater(t, litres)),
    getTodayWater: () => withToken(api.getTodayWater),
    getDietPlan: () => withToken(api.getDietPlan),
    getDietStats: () => withToken(api.getDietStats),
    getNutrition: (food: string, qty: string) => withToken((t) => api.getNutrition(t, food, qty)),
    parseMeal: (description: string) => withToken((t) => api.parseMeal(t, description)),
    getShoppingList: () => withToken(api.getShoppingList),
    getMealTiming: () => withToken(api.getMealTiming),
    getTDEE: () => withToken(api.getTDEE),

    // Sleep
    logSleep: (data: any) => withToken((t) => api.logSleep(t, data)),
    getSleepScore: () => withToken(api.getSleepScore),

    // Habits
    habitCheckin: (data: any) => withToken((t) => api.habitCheckin(t, data)),
    getHabitScores: () => withToken(api.getHabitScores),
    getStreaks: () => withToken(api.getStreaks),
    saveMorningCheckin: (data: any) => withToken((t) => api.saveMorningCheckin(t, data)),
    getMorningCheckin: () => withToken(api.getMorningCheckin),
    replaceDiet: (data: any) => withToken((t) => api.replaceDiet(t, data)),
    getCorrelationInsights: () => withToken(api.getCorrelationInsights),

    // AI
    chat: (message: string) => withToken((t) => api.chat(t, message)),
    getDailyPlan: () => withToken(api.getDailyPlan),

    // English
    correctEnglish: (text: string) => withToken((t) => api.correctEnglish(t, text)),
    getEnglishLesson: (topic?: string) => withToken((t) => api.getEnglishLesson(t, topic)),
    getEnglishLessonHistory: () => withToken(api.getEnglishLessonHistory),
    completeEnglishLesson: (dayNumber: number) => withToken((t) => api.completeEnglishLesson(t, dayNumber)),
    practiceEnglishSpeaking: (situation: string) => withToken((t) => api.practiceEnglishSpeaking(t, situation)),
    getEnglishStats: () => withToken(api.getEnglishStats),
    getErrorPatterns: () => withToken(api.getErrorPatterns),
    getAllVocabulary: (language?: string) => withToken((t) => api.getAllVocabulary(t, language)),
    getDueVocabulary: (language?: string) => withToken((t) => api.getDueVocabulary(t, language)),
    getVocabularyStats: () => withToken(api.getVocabularyStats),
    addVocabularyCard: (data: any) => withToken((t) => api.addVocabularyCard(t, data)),
    reviewVocabularyCard: (cardId: string, quality: number) => withToken((t) => api.reviewVocabularyCard(t, cardId, quality)),

    // Kannada
    getKannadaLesson: (day?: number) => withToken((t) => api.getKannadaLesson(t, day)),
    getKannadaLessonByDay: (day: number) => withToken((t) => api.getKannadaLessonByDay(t, day)),
    getKannadaCurriculum: () => withToken(api.getKannadaCurriculum),
    getKannadaScript: () => withToken(api.getKannadaScript),
    getKannadaLessonHistory: () => withToken(api.getKannadaLessonHistory),
    completeKannadaLesson: (dayNumber: number) => withToken((t) => api.completeKannadaLesson(t, dayNumber)),
    logKannada: (data: any) => withToken((t) => api.logKannada(t, data)),
    getKannadaProgress: () => withToken(api.getKannadaProgress),

    // Career
    logStudy: (data: any) => withToken((t) => api.logStudy(t, data)),
    getCareerRoadmap: () => withToken(api.getCareerRoadmap),
    getCareerStats: () => withToken(api.getCareerStats),
    careerChat: (message: string) => withToken((t) => api.careerChat(t, message)),

    // Reports
    generateWeeklyReport: () => withToken(api.generateWeeklyReport),
    getReports: () => withToken(api.getReports),
    getLatestReport: () => withToken(api.getLatestReport),
  };
}
