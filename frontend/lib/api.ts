const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // User
  getProfile: (token: string) => apiCall('/users/me', {}, token),
  updateProfile: (token: string, data: any) =>
    apiCall('/users/me', { method: 'PUT', body: JSON.stringify(data) }, token),
  getUserStats: (token: string) => apiCall('/users/me/stats', {}, token),

  // Analytics
  getDashboard: (token: string) => apiCall('/analytics/dashboard', {}, token),
  getTrends: (token: string) => apiCall('/analytics/trends', {}, token),
  getInsights: (token: string) => apiCall('/analytics/insights', {}, token),
  getScoreBreakdown: (token: string) => apiCall('/analytics/score-breakdown', {}, token),
  getProactiveInsights: (token: string) => apiCall('/analytics/proactive-insights', {}, token),

  // Fitness
  logWeight: (token: string, data: any) =>
    apiCall('/fitness/weight', { method: 'POST', body: JSON.stringify(data) }, token),
  getWeightHistory: (token: string) => apiCall('/fitness/weight/history', {}, token),
  logWorkout: (token: string, data: any) =>
    apiCall('/fitness/workout', { method: 'POST', body: JSON.stringify(data) }, token),
  getWorkoutHistory: (token: string) => apiCall('/fitness/workout/history', {}, token),
  getWorkoutPlan: (token: string) => apiCall('/fitness/workout/plan', {}, token),
  getProgressiveOverload: (token: string, exercise: string) =>
    apiCall(`/fitness/workout/overload?exercise=${encodeURIComponent(exercise)}`, {}, token),
  getFitnessStats: (token: string) => apiCall('/fitness/stats', {}, token),
  // Workout Program
  generateProgram: (token: string) =>
    apiCall('/fitness/program/generate', { method: 'POST' }, token),
  getActiveProgram: (token: string) => apiCall('/fitness/program/active', {}, token),
  completeSession: (token: string, sessionId: string, actualLog: any) =>
    apiCall(`/fitness/program/session/${sessionId}/complete`, { method: 'POST', body: JSON.stringify({ actualLog }) }, token),
  // Body Measurements
  logMeasurement: (token: string, data: any) =>
    apiCall('/fitness/measurements', { method: 'POST', body: JSON.stringify(data) }, token),
  getMeasurements: (token: string) => apiCall('/fitness/measurements', {}, token),

  // Diet
  logDiet: (token: string, data: any) =>
    apiCall('/diet/log', { method: 'POST', body: JSON.stringify(data) }, token),
  getDietHistory: (token: string) => apiCall('/diet/history', {}, token),
  getDietPlan: (token: string) => apiCall('/diet/plan', {}, token),
  getTodayDiet: (token: string) => apiCall('/diet/today', {}, token),
  logWater: (token: string, litres: number) =>
    apiCall('/diet/water', { method: 'POST', body: JSON.stringify({ litres }) }, token),
  getTodayWater: (token: string) => apiCall('/diet/water/today', {}, token),
  getDietStats: (token: string) => apiCall('/diet/stats', {}, token),
  getNutrition: (token: string, food: string, qty: string) =>
    apiCall(`/diet/nutrition?food=${encodeURIComponent(food)}&qty=${encodeURIComponent(qty)}`, {}, token),
  parseMeal: (token: string, description: string) =>
    apiCall('/diet/parse-meal', { method: 'POST', body: JSON.stringify({ description }) }, token),
  getShoppingList: (token: string) => apiCall('/diet/shopping-list', {}, token),
  getMealTiming: (token: string) => apiCall('/diet/meal-timing', {}, token),
  getTDEE: (token: string) => apiCall('/diet/tdee', {}, token),

  // Sleep
  logSleep: (token: string, data: any) =>
    apiCall('/sleep/log', { method: 'POST', body: JSON.stringify(data) }, token),
  getSleepHistory: (token: string) => apiCall('/sleep/history', {}, token),
  getSleepScore: (token: string) => apiCall('/sleep/score', {}, token),

  // Habits
  habitCheckin: (token: string, data: any) =>
    apiCall('/habits/checkin', { method: 'POST', body: JSON.stringify(data) }, token),
  getHabitHistory: (token: string) => apiCall('/habits/history', {}, token),
  getHabitScores: (token: string) => apiCall('/habits/scores', {}, token),
  getStreaks: (token: string) => apiCall('/habits/streaks', {}, token),
  saveMorningCheckin: (token: string, data: any) =>
    apiCall('/habits/morning-checkin', { method: 'POST', body: JSON.stringify(data) }, token),
  getMorningCheckin: (token: string) => apiCall('/habits/morning-checkin', {}, token),
  replaceDiet: (token: string, data: any) =>
    apiCall('/diet/replace', { method: 'POST', body: JSON.stringify(data) }, token),
  getFrequentMeals: (token: string) => apiCall('/diet/frequent-meals', {}, token),
  parseMealFromPhoto: (token: string, imageBase64: string, mediaType = 'image/jpeg') =>
    apiCall('/diet/parse-photo', { method: 'POST', body: JSON.stringify({ imageBase64, mediaType }) }, token),
  getBarcodeNutrition: (token: string, barcode: string) => apiCall(`/diet/barcode/${encodeURIComponent(barcode)}`, {}, token),
  getCorrelationInsights: (token: string) => apiCall('/analytics/correlations', {}, token),

  // AI
  chat: (token: string, message: string) =>
    apiCall('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }, token),
  getDailyPlan: (token: string) => apiCall('/ai/daily-plan', {}, token),

  // English
  correctEnglish: (token: string, text: string) =>
    apiCall('/english/correct', { method: 'POST', body: JSON.stringify({ text }) }, token),
  getEnglishLesson: (token: string, topic?: string) =>
    apiCall(`/english/lesson${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`, {}, token),
  getEnglishLessonHistory: (token: string) => apiCall('/english/lessons/history', {}, token),
  completeEnglishLesson: (token: string, dayNumber: number) =>
    apiCall('/english/lessons/complete', { method: 'POST', body: JSON.stringify({ dayNumber }) }, token),
  practiceEnglishSpeaking: (token: string, situation: string) =>
    apiCall('/english/speaking', { method: 'POST', body: JSON.stringify({ situation }) }, token),
  getEnglishStats: (token: string) => apiCall('/english/stats', {}, token),
  // Error patterns
  getErrorPatterns: (token: string) => apiCall('/english/error-patterns', {}, token),
  // Vocabulary / Spaced Repetition
  getAllVocabulary: (token: string, language?: string) =>
    apiCall(`/english/vocabulary${language ? `?language=${language}` : ''}`, {}, token),
  getDueVocabulary: (token: string, language?: string) =>
    apiCall(`/english/vocabulary/due${language ? `?language=${language}` : ''}`, {}, token),
  getVocabularyStats: (token: string) => apiCall('/english/vocabulary/stats', {}, token),
  addVocabularyCard: (token: string, data: any) =>
    apiCall('/english/vocabulary', { method: 'POST', body: JSON.stringify(data) }, token),
  reviewVocabularyCard: (token: string, cardId: string, quality: number) =>
    apiCall(`/english/vocabulary/${cardId}/review`, { method: 'POST', body: JSON.stringify({ quality }) }, token),

  // Kannada
  getKannadaLesson: (token: string, day?: number) =>
    apiCall(`/kannada/lesson${day ? `?day=${day}` : ''}`, {}, token),
  getKannadaLessonByDay: (token: string, day: number) => apiCall(`/kannada/lesson/${day}`, {}, token),
  getKannadaCurriculum: (token: string) => apiCall('/kannada/curriculum', {}, token),
  getKannadaScript: (token: string) => apiCall('/kannada/script', {}, token),
  getKannadaLessonHistory: (token: string) => apiCall('/kannada/lessons/history', {}, token),
  completeKannadaLesson: (token: string, dayNumber: number) =>
    apiCall('/kannada/lessons/complete', { method: 'POST', body: JSON.stringify({ dayNumber }) }, token),
  logKannada: (token: string, data: any) =>
    apiCall('/kannada/log', { method: 'POST', body: JSON.stringify(data) }, token),
  getKannadaProgress: (token: string) => apiCall('/kannada/progress', {}, token),

  // Career
  logStudy: (token: string, data: any) =>
    apiCall('/career/study', { method: 'POST', body: JSON.stringify(data) }, token),
  getCareerRoadmap: (token: string) => apiCall('/career/roadmap', {}, token),
  getCareerStats: (token: string) => apiCall('/career/stats', {}, token),
  careerChat: (token: string, message: string) =>
    apiCall('/career/chat', { method: 'POST', body: JSON.stringify({ message }) }, token),

  // Reports
  generateWeeklyReport: (token: string) =>
    apiCall('/reports/weekly', { method: 'POST' }, token),
  getReports: (token: string) => apiCall('/reports/all', {}, token),
  getLatestReport: (token: string) => apiCall('/reports/latest', {}, token),
};
