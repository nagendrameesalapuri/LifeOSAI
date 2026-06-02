import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SAFE_DIET_SELECT } from '../prisma/prisma-safe-select';

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

@Injectable()
export class DietService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // Mifflin-St Jeor BMR formula
  calculateBMR(weightKg: number, heightCm: number, age: number): number {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }

  calculateTDEE(weightKg: number, heightCm: number, age: number, activityLevel: string): number {
    const bmr = this.calculateBMR(weightKg, heightCm, age);
    const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
    return Math.round(bmr * multiplier);
  }

  calculateProteinTarget(weightKg: number): number {
    return Math.round(weightKg * 2.2);
  }

  calculateCalorieTarget(tdee: number, goal: string): number {
    if (goal === 'lean_bulk') return tdee + 250;
    if (goal === 'cut') return tdee - 300;
    return tdee; // maintain
  }

  async updateUserTargets(userId: string): Promise<{ tdee: number; calorieTarget: number; proteinTarget: number }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weightKg: true, heightCm: true, age: true, targetWeightKg: true } });
      if (!user || !user.heightCm || !user.age) {
        return { tdee: 2600, calorieTarget: 2800, proteinTarget: 140 };
      }

      const userAny = user as any;
      const activityLevel = userAny.activityLevel || 'moderate';
      const primaryGoal = userAny.primaryGoal || 'lean_bulk';

      const tdee = this.calculateTDEE(user.weightKg, user.heightCm, user.age, activityLevel);
      const calorieTarget = this.calculateCalorieTarget(tdee, primaryGoal);
      const proteinTarget = this.calculateProteinTarget(user.weightKg);

      // Try to update new fields — may fail if migration not run yet
      await this.prisma.user.update({
        where: { id: userId },
        data: { tdeeKcal: tdee, dailyCalorieTarget: calorieTarget, dailyProteinTarget: proteinTarget } as any,
      }).catch(() => {});

      return { tdee, calorieTarget, proteinTarget };
    } catch {
      return { tdee: 2600, calorieTarget: 2800, proteinTarget: 140 };
    }
  }

  async logDiet(userId: string, data: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await this.prisma.dietLog.findFirst({
      where: { userId, loggedAt: { gte: today, lt: tomorrow } },
      orderBy: { loggedAt: 'desc' },
    });

    if (existing) {
      // APPEND-MODE: merge new meals into existing day's meals, aggregate totals
      const existingMeals = (existing.meals as any[]) || [];
      const newMeals = (data.meals as any[]) || [];
      const mergedMeals = [...existingMeals, ...newMeals];

      // Recalculate totals from all meals combined
      const mergedCalories = (existing.totalCalories || 0) + (data.totalCalories || 0);
      const mergedProtein = (existing.totalProteinG || 0) + (data.totalProteinG || 0);
      const mergedCarbs = (existing.totalCarbsG || 0) + (data.totalCarbsG || 0);
      const mergedFats = (existing.totalFatsG || 0) + (data.totalFatsG || 0);
      // Water: take the max (user might re-enter current total rather than increment)
      const mergedWater = Math.max(existing.waterLitres || 0, data.waterLitres || 0);

      return (this.prisma.dietLog.update as any)({
        where: { id: existing.id },
        data: {
          meals: mergedMeals,
          totalCalories: mergedCalories,
          totalProteinG: mergedProtein,
          totalCarbsG: mergedCarbs,
          totalFatsG: mergedFats,
          waterLitres: mergedWater,
          ...(data.mealTiming ? { mealTiming: data.mealTiming } : {}),
        },
      });
    }

    return (this.prisma.dietLog.create as any)({
      data: {
        userId,
        meals: data.meals || [],
        totalCalories: data.totalCalories || 0,
        totalProteinG: data.totalProteinG || 0,
        totalCarbsG: data.totalCarbsG || 0,
        totalFatsG: data.totalFatsG || 0,
        waterLitres: data.waterLitres || 0,
        ...(data.mealTiming ? { mealTiming: data.mealTiming } : {}),
      },
    });
  }

  async replaceDiet(userId: string, data: any) {
    // Explicit replace — for when user wants to re-enter the full day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await this.prisma.dietLog.findFirst({
      where: { userId, loggedAt: { gte: today, lt: tomorrow } },
      orderBy: { loggedAt: 'desc' },
    });

    if (existing) {
      return (this.prisma.dietLog.update as any)({
        where: { id: existing.id },
        data: {
          meals: data.meals || [],
          totalCalories: data.totalCalories || 0,
          totalProteinG: data.totalProteinG || 0,
          totalCarbsG: data.totalCarbsG || 0,
          totalFatsG: data.totalFatsG || 0,
          waterLitres: data.waterLitres ?? existing.waterLitres,
          ...(data.mealTiming ? { mealTiming: data.mealTiming } : {}),
        },
      });
    }
    return this.logDiet(userId, data);
  }

  async getTodayDiet(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [log, user] = await Promise.all([
      this.prisma.dietLog.findFirst({
        where: { userId, loggedAt: { gte: today, lt: tomorrow } },
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weightKg: true, heightCm: true, age: true, targetWeightKg: true } }),
    ]);

    const userAny = user as any;
    return {
      log,
      targets: {
        calories: userAny?.dailyCalorieTarget || 2800,
        protein: userAny?.dailyProteinTarget || 140,
        water: 4,
      },
    };
  }

  async getDietHistory(userId: string) {
    return this.prisma.dietLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
      select: SAFE_DIET_SELECT,
    });
  }

  async getDietPlan(userId: string) {
    // Auto-update targets based on current weight before generating plan
    await this.updateUserTargets(userId);
    return this.aiService.generateDietPlan(userId);
  }

  async getShoppingList(userId: string) {
    const plan = await this.aiService.generateDietPlan(userId);
    if (plan?.shoppingList) return plan.shoppingList;
    // Return default if AI plan doesn't have it
    return {
      weekly: [
        '500g chicken breast',
        '12 eggs',
        '1kg curd',
        '200g paneer',
        '500g oats',
        '2kg rice',
        '500g dal (toor/moong)',
        '250g whey protein (optional)',
        '1 bunch spinach',
        'Bananas (6)',
      ],
      estimatedCostRs: 800,
    };
  }

  async getMealTimingAdvice(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const proteinTarget = user?.dailyProteinTarget || 140;

    return {
      preWorkout: {
        timing: '1-2 hours before gym',
        targetCarbs: 30,
        targetProtein: 20,
        suggestions: ['4 dates + 2 eggs', '1 banana + whey shake', '1 cup oats + milk'],
        why: 'Fuel your workout with fast carbs and some protein',
      },
      postWorkout: {
        timing: 'Within 30 minutes after gym',
        targetCarbs: 50,
        targetProtein: Math.round(proteinTarget * 0.3),
        suggestions: ['Rice 200g + chicken 200g', 'Rice 200g + 3 eggs', 'Whey shake + banana + boiled eggs'],
        why: 'Critical window — protein synthesis is highest after training',
      },
      casein: {
        timing: '30-60 min before bed',
        targetProtein: 20,
        suggestions: ['Curd 200g', 'Paneer 100g', 'Milk 300ml'],
        why: 'Slow-digesting protein repairs muscles while you sleep',
      },
      supplements: [
        { name: 'Creatine Monohydrate', dose: '5g/day', timing: 'Any time, same time daily', cost: '~₹150/month', priority: 'Essential' },
        { name: 'Vitamin D3', dose: '2000 IU/day', timing: 'With breakfast', cost: '~₹100/month', priority: 'High (most Indians deficient)' },
        { name: 'Whey Protein', dose: '25-30g after workout', timing: 'Post-workout', cost: '~₹2000/month', priority: 'Optional if hitting food protein' },
      ],
    };
  }

  async getTodayWater(userId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const log = await this.prisma.dietLog.findFirst({
      where: { userId, loggedAt: { gte: today, lt: tomorrow } },
      orderBy: { loggedAt: 'desc' },
    });
    return { litres: log?.waterLitres ?? 0, goal: 4 };
  }

  async logWater(userId: string, litres: number) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const existing = await this.prisma.dietLog.findFirst({
      where: { userId, loggedAt: { gte: today, lt: tomorrow } },
      orderBy: { loggedAt: 'desc' },
    });
    if (existing) {
      return this.prisma.dietLog.update({
        where: { id: existing.id },
        data: { waterLitres: litres },
      });
    }
    return this.prisma.dietLog.create({
      data: { userId, meals: [], totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatsG: 0, waterLitres: litres },
    });
  }

  async parseMeal(description: string) {
    const prompt = `Parse this meal description and calculate nutrition for each item: "${description}"
Return ONLY a JSON array (no markdown):
[{"name":"food name","quantity":"amount with unit","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}]
Be accurate with Indian food values. Each item must have all fields as numbers.`;

    const response = await this.aiService['client'].messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const text = (response.content[0] as any).text.trim();
      const json = text.replace(/```json?\n?|\n?```/g, '').trim();
      return { items: JSON.parse(json) };
    } catch {
      return { items: [] };
    }
  }

  async getNutrition(food: string, qty: string) {
    const prompt = `Calculate the nutritional info for: "${qty} of ${food}".
Return ONLY a JSON object (no markdown, no explanation):
{"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number}
Use realistic values. If unsure, estimate conservatively.`;

    const response = await this.aiService['client'].messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const text = (response.content[0] as any).text.trim();
      const json = text.replace(/```json?\n?|\n?```/g, '').trim();
      return JSON.parse(json);
    } catch {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
  }

  async getDietStats(userId: string) {
    const [logs, user] = await Promise.all([
      this.prisma.dietLog.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 7,
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, weightKg: true, heightCm: true, age: true, targetWeightKg: true } }),
    ]);

    const userAny = user as any;
    const proteinTarget = userAny?.dailyProteinTarget || 140;
    const calorieTarget = userAny?.dailyCalorieTarget || 2800;
    const tdee = userAny?.tdeeKcal || 2600;

    if (!logs.length) {
      return { avgCalories: 0, avgProtein: 0, avgWater: 0, logs: [], proteinTarget, calorieTarget, tdee };
    }

    const avgCalories = Math.round(logs.reduce((a, l) => a + l.totalCalories, 0) / logs.length);
    const avgProtein = Math.round(logs.reduce((a, l) => a + l.totalProteinG, 0) / logs.length);
    const avgWater = Math.round((logs.reduce((a, l) => a + l.waterLitres, 0) / logs.length) * 10) / 10;

    const proteinScore = Math.min(100, Math.round((avgProtein / proteinTarget) * 100));
    const calorieScore = Math.min(100, Math.round((avgCalories / calorieTarget) * 100));

    // Week-over-week comparison
    const prevWeekLogs = await this.prisma.dietLog.findMany({
      where: { userId, loggedAt: { gte: new Date(Date.now() - 14 * 86400000), lt: new Date(Date.now() - 7 * 86400000) } },
      orderBy: { loggedAt: 'desc' },
    });
    const prevAvgProtein = prevWeekLogs.length
      ? Math.round(prevWeekLogs.reduce((a, l) => a + l.totalProteinG, 0) / prevWeekLogs.length)
      : 0;

    return {
      avgCalories,
      avgProtein,
      avgWater,
      proteinScore,
      calorieScore,
      proteinTarget,
      calorieTarget,
      tdee,
      proteinTrend: prevAvgProtein > 0 ? avgProtein - prevAvgProtein : 0,
      logs,
    };
  }
}
