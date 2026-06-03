const SAFE_WORKOUT_SELECT = {
  id: true, userId: true, type: true, exercises: true,
  durationMin: true, proteinG: true, caloriesBurned: true,
  notes: true, loggedAt: true,
};

const SAFE_DIET_SELECT = {
  id: true, userId: true, meals: true, totalCalories: true,
  totalProteinG: true, totalCarbsG: true, totalFatsG: true,
  waterLitres: true, loggedAt: true,
};

module.exports = { SAFE_WORKOUT_SELECT, SAFE_DIET_SELECT };
