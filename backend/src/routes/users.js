const router = require('express').Router();
const users = require('../services/users');
const { cacheMiddleware, invalidateUserCache } = require('../middleware/cache');
const prisma = require('../lib/prisma');
const anthropic = require('../lib/anthropic');
const diet = require('../services/diet');

const FIVE_MIN = 5 * 60 * 1000;

router.get('/me', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await users.getProfile(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/me', async (req, res) => {
  try {
    invalidateUserCache(req.user.id);
    res.json(await users.updateProfile(req.user.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me/stats', cacheMiddleware(FIVE_MIN), async (req, res) => {
  try { res.json(await users.getStats(req.user.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/generate-plan
// Called at end of onboarding. Uses AI to generate personalised nutrition
// targets then stores them all in DB. Returns the full plan so the UI
// can show real values instead of placeholders.
router.post('/generate-plan', async (req, res) => {
  try {
    const userId = req.user.id;

    // Step 1: calculate TDEE (stores calorieTarget + proteinTarget)
    const base = await diet.updateUserTargets(userId);

    // Step 2: fetch full profile for AI context
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const goalLabel = { lean_bulk: 'Lean Bulk (gain muscle)', cut: 'Cut (lose fat)', maintain: 'Maintain & Recomp' }[user.primaryGoal] || 'Lean Bulk';
    const activityLabel = { sedentary: 'Mostly sitting', light: 'Light (1-3x/week)', moderate: 'Moderate (3-5x/week)', active: 'Very active (6+/week)' }[user.activityLevel] || 'Moderate';

    const prompt = `You are a precision sports nutritionist. Generate a personalised daily nutrition plan for this user.

USER PROFILE:
- Age: ${user.age || 27} | Height: ${user.heightCm || 170}cm | Weight: ${user.weightKg || 62}kg
- Target Weight: ${user.targetWeightKg || 70}kg | Goal: ${goalLabel}
- Activity: ${activityLabel} | Gym: ${user.gymDaysPerWeek || 4} days/week
- Fitness Level: ${user.fitnessLevel || 'intermediate'}
- TDEE (calculated): ${base.tdee} kcal

RULES:
- Calories: TDEE ${user.primaryGoal === 'lean_bulk' ? '+200 to +300' : user.primaryGoal === 'cut' ? '-300 to -400' : '±0'} kcal
- Protein: 2.0–2.4g per kg body weight for muscle building
- Fat: 0.8–1.0g per kg body weight minimum
- Carbs: fill remaining calories after protein and fat
- Water: 35ml per kg body weight + 500ml per gym day
- Meals: 4-5 meals for muscle building, 3-4 for cut

Return ONLY valid JSON (no markdown):
{
  "dailyCalories": number,
  "dailyProtein": number,
  "dailyCarbs": number,
  "dailyFat": number,
  "dailyWater": number,
  "mealsPerDay": number,
  "preWorkoutCarbs": number,
  "postWorkoutProtein": number,
  "summary": "one sentence personalised insight for this user"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.replace(/```json?\n?|\n?```/g, '').trim();
    let plan;
    try { plan = JSON.parse(raw); } catch {
      // AI parse failed — fall back to formula values
      plan = {
        dailyCalories: base.calorieTarget,
        dailyProtein: Math.round(base.proteinTarget),
        dailyCarbs: Math.round((base.calorieTarget - base.proteinTarget * 4) * 0.55 / 4),
        dailyFat: Math.round((base.calorieTarget - base.proteinTarget * 4) * 0.45 / 9),
        dailyWater: Math.round((user.weightKg || 62) * 0.035 * 10) / 10 + (user.gymDaysPerWeek || 4) * 0.07,
        mealsPerDay: 4,
        preWorkoutCarbs: 30,
        postWorkoutProtein: Math.round(base.proteinTarget * 0.3),
        summary: `Your personalised plan: ${base.calorieTarget} kcal/day with ${Math.round(base.proteinTarget)}g protein for ${goalLabel.toLowerCase()}.`,
      };
    }

    // Step 3: store all targets in DB
    invalidateUserCache(userId);
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyCalorieTarget: Math.round(plan.dailyCalories),
        dailyProteinTarget: Math.round(plan.dailyProtein),
        dailyCarbsTarget: Math.round(plan.dailyCarbs),
        dailyFatTarget: Math.round(plan.dailyFat),
        dailyWaterTarget: Math.round(plan.dailyWater * 10) / 10,
        tdeeKcal: base.tdee,
      },
    });

    res.json({
      tdee: base.tdee,
      dailyCalories: Math.round(plan.dailyCalories),
      dailyProtein: Math.round(plan.dailyProtein),
      dailyCarbs: Math.round(plan.dailyCarbs),
      dailyFat: Math.round(plan.dailyFat),
      dailyWater: Math.round(plan.dailyWater * 10) / 10,
      mealsPerDay: plan.mealsPerDay || 4,
      preWorkoutCarbs: plan.preWorkoutCarbs || 30,
      postWorkoutProtein: plan.postWorkoutProtein || Math.round(plan.dailyProtein * 0.3),
      summary: plan.summary,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
