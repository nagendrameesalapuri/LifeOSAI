const prisma = require('../lib/prisma');
const ai = require('./ai');
const { SAFE_DIET_SELECT } = require('../data/safe-select');

const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

function calculateBMR(weightKg, heightCm, age) { return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5); }
function calculateTDEE(weightKg, heightCm, age, activityLevel) { return Math.round(calculateBMR(weightKg, heightCm, age) * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55)); }
function calculateProteinTarget(weightKg) { return Math.round(weightKg * 2.2); }
function calculateCalorieTarget(tdee, goal) { if (goal === 'lean_bulk') return tdee + 250; if (goal === 'cut') return tdee - 300; return tdee; }

function todayRange() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

async function updateUserTargets(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.heightCm || !user.age) return { tdee: 2600, calorieTarget: 2800, proteinTarget: 140 };
    const activityLevel = user.activityLevel || 'moderate';
    const primaryGoal = user.primaryGoal || 'lean_bulk';
    const tdee = calculateTDEE(user.weightKg, user.heightCm, user.age, activityLevel);
    const calorieTarget = calculateCalorieTarget(tdee, primaryGoal);
    const proteinTarget = calculateProteinTarget(user.weightKg);
    await prisma.user.update({ where: { id: userId }, data: { tdeeKcal: tdee, dailyCalorieTarget: calorieTarget, dailyProteinTarget: proteinTarget } }).catch(() => {});
    return { tdee, calorieTarget, proteinTarget };
  } catch { return { tdee: 2600, calorieTarget: 2800, proteinTarget: 140 }; }
}

async function logDiet(userId, data) {
  const { today, tomorrow } = todayRange();
  const existing = await prisma.dietLog.findFirst({ where: { userId, loggedAt: { gte: today, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } });

  if (existing) {
    const mergedMeals = [...(existing.meals || []), ...(data.meals || [])];
    return prisma.dietLog.update({
      where: { id: existing.id },
      data: {
        meals: mergedMeals,
        totalCalories: (existing.totalCalories || 0) + (data.totalCalories || 0),
        totalProteinG: (existing.totalProteinG || 0) + (data.totalProteinG || 0),
        totalCarbsG: (existing.totalCarbsG || 0) + (data.totalCarbsG || 0),
        totalFatsG: (existing.totalFatsG || 0) + (data.totalFatsG || 0),
        waterLitres: Math.max(existing.waterLitres || 0, data.waterLitres || 0),
        ...(data.mealTiming ? { mealTiming: data.mealTiming } : {}),
      },
    });
  }
  return prisma.dietLog.create({
    data: { userId, meals: data.meals || [], totalCalories: data.totalCalories || 0, totalProteinG: data.totalProteinG || 0, totalCarbsG: data.totalCarbsG || 0, totalFatsG: data.totalFatsG || 0, waterLitres: data.waterLitres || 0, ...(data.mealTiming ? { mealTiming: data.mealTiming } : {}) },
  });
}

async function replaceDiet(userId, data) {
  const { today, tomorrow } = todayRange();
  const existing = await prisma.dietLog.findFirst({ where: { userId, loggedAt: { gte: today, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } });
  if (existing) {
    return prisma.dietLog.update({
      where: { id: existing.id },
      data: { meals: data.meals || [], totalCalories: data.totalCalories || 0, totalProteinG: data.totalProteinG || 0, totalCarbsG: data.totalCarbsG || 0, totalFatsG: data.totalFatsG || 0, waterLitres: data.waterLitres ?? existing.waterLitres, ...(data.mealTiming ? { mealTiming: data.mealTiming } : {}) },
    });
  }
  return logDiet(userId, data);
}

async function getTodayDiet(userId) {
  const { today, tomorrow } = todayRange();
  const [log, user] = await Promise.all([
    prisma.dietLog.findFirst({ where: { userId, loggedAt: { gte: today, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  return { log, targets: { calories: user?.dailyCalorieTarget || 2800, protein: user?.dailyProteinTarget || 140, water: 4 } };
}

async function getDietHistory(userId) {
  return prisma.dietLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 30, select: SAFE_DIET_SELECT });
}

async function getDietPlan(userId) {
  await updateUserTargets(userId);
  return ai.generateDietPlan(userId);
}

async function getShoppingList(userId) {
  const plan = await ai.generateDietPlan(userId);
  if (plan?.shoppingList) return plan.shoppingList;
  return { weekly: ['500g chicken breast', '12 eggs', '1kg curd', '200g paneer', '500g oats', '2kg rice', '500g dal', '250g whey protein (optional)', '1 bunch spinach', 'Bananas (6)'], estimatedCostRs: 800 };
}

async function getMealTimingAdvice(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const proteinTarget = user?.dailyProteinTarget || 140;
  return {
    preWorkout: { timing: '1-2 hours before gym', targetCarbs: 30, targetProtein: 20, suggestions: ['4 dates + 2 eggs', '1 banana + whey shake', '1 cup oats + milk'], why: 'Fuel your workout' },
    postWorkout: { timing: 'Within 30 minutes after gym', targetCarbs: 50, targetProtein: Math.round(proteinTarget * 0.3), suggestions: ['Rice 200g + chicken 200g', 'Rice 200g + 3 eggs'], why: 'Critical window for protein synthesis' },
    casein: { timing: '30-60 min before bed', targetProtein: 20, suggestions: ['Curd 200g', 'Paneer 100g', 'Milk 300ml'], why: 'Slow-digesting protein repairs muscles while you sleep' },
    supplements: [
      { name: 'Creatine Monohydrate', dose: '5g/day', timing: 'Any time, same time daily', cost: '~₹150/month', priority: 'Essential' },
      { name: 'Vitamin D3', dose: '2000 IU/day', timing: 'With breakfast', cost: '~₹100/month', priority: 'High (most Indians deficient)' },
      { name: 'Whey Protein', dose: '25-30g after workout', timing: 'Post-workout', cost: '~₹2000/month', priority: 'Optional if hitting food protein' },
    ],
  };
}

async function getTodayWater(userId) {
  const { today, tomorrow } = todayRange();
  const log = await prisma.dietLog.findFirst({ where: { userId, loggedAt: { gte: today, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } });
  return { litres: log?.waterLitres ?? 0, goal: 4 };
}

async function logWater(userId, litres) {
  const { today, tomorrow } = todayRange();
  const existing = await prisma.dietLog.findFirst({ where: { userId, loggedAt: { gte: today, lt: tomorrow } }, orderBy: { loggedAt: 'desc' } });
  if (existing) return prisma.dietLog.update({ where: { id: existing.id }, data: { waterLitres: litres } });
  return prisma.dietLog.create({ data: { userId, meals: [], totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatsG: 0, waterLitres: litres } });
}

async function parseMeal(description) {
  const prompt = `Parse this meal description and calculate nutrition for each item: "${description}"\nReturn ONLY a JSON array (no markdown):\n[{"name":"food name","quantity":"amount with unit","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}]\nBe accurate with Indian food values.`;
  try {
    const text = await ai.callHaiku(prompt);
    const json = text.trim().replace(/```json?\n?|\n?```/g, '').trim();
    return { items: JSON.parse(json) };
  } catch { return { items: [] }; }
}

async function getNutrition(food, qty) {
  const prompt = `Calculate the nutritional info for: "${qty} of ${food}".\nReturn ONLY a JSON object (no markdown):\n{"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}\nUse realistic values.`;
  try {
    const text = await ai.callHaiku(prompt);
    const json = text.trim().replace(/```json?\n?|\n?```/g, '').trim();
    return JSON.parse(json);
  } catch { return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }; }
}

async function getDietStats(userId) {
  const [logs, user] = await Promise.all([
    prisma.dietLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: 7 }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const proteinTarget = user?.dailyProteinTarget || 140;
  const calorieTarget = user?.dailyCalorieTarget || 2800;
  const tdee = user?.tdeeKcal || 2600;

  if (!logs.length) return { avgCalories: 0, avgProtein: 0, avgWater: 0, logs: [], proteinTarget, calorieTarget, tdee };

  const avgCalories = Math.round(logs.reduce((a, l) => a + l.totalCalories, 0) / logs.length);
  const avgProtein = Math.round(logs.reduce((a, l) => a + l.totalProteinG, 0) / logs.length);
  const avgWater = Math.round((logs.reduce((a, l) => a + l.waterLitres, 0) / logs.length) * 10) / 10;
  const proteinScore = Math.min(100, Math.round((avgProtein / proteinTarget) * 100));
  const calorieScore = Math.min(100, Math.round((avgCalories / calorieTarget) * 100));

  const prevWeekLogs = await prisma.dietLog.findMany({
    where: { userId, loggedAt: { gte: new Date(Date.now() - 14 * 86400000), lt: new Date(Date.now() - 7 * 86400000) } },
  });
  const prevAvgProtein = prevWeekLogs.length ? Math.round(prevWeekLogs.reduce((a, l) => a + l.totalProteinG, 0) / prevWeekLogs.length) : 0;

  return { avgCalories, avgProtein, avgWater, proteinScore, calorieScore, proteinTarget, calorieTarget, tdee, proteinTrend: prevAvgProtein > 0 ? avgProtein - prevAvgProtein : 0, logs };
}

async function getTDEE(userId) {
  return updateUserTargets(userId);
}

module.exports = { updateUserTargets, logDiet, replaceDiet, getTodayDiet, getDietHistory, getDietPlan, getShoppingList, getMealTimingAdvice, getTodayWater, logWater, parseMeal, getNutrition, getDietStats, getTDEE };
