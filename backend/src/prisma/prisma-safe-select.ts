/**
 * Safe Prisma select objects — only include original DB columns.
 * New columns added in schema updates may not exist in DB until migration runs.
 * Using these selects prevents Prisma from querying non-existent columns.
 */

export const SAFE_WORKOUT_SELECT = {
  id: true,
  userId: true,
  type: true,
  exercises: true,
  durationMin: true,
  proteinG: true,
  caloriesBurned: true,
  notes: true,
  loggedAt: true,
} as const;

export const SAFE_DIET_SELECT = {
  id: true,
  userId: true,
  meals: true,
  totalCalories: true,
  totalProteinG: true,
  totalCarbsG: true,
  totalFatsG: true,
  waterLitres: true,
  loggedAt: true,
} as const;

export const SAFE_USER_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  name: true,
  weightKg: true,
  targetWeightKg: true,
  heightCm: true,
  age: true,
  profession: true,
  createdAt: true,
  updatedAt: true,
} as const;
