# Database Migration Guide

## New Schema Changes

The following new models and fields have been added. Run these commands to apply:

### 1. Generate the migration (local dev)
```bash
npx prisma migrate dev --name add_new_features
```

### 2. Apply to production (Supabase)
```bash
npx prisma migrate deploy
```

### 3. If migration fails, use db push (for Supabase free tier)
```bash
npx prisma db push
```

## What's New

### New User Fields
- `activityLevel` - sedentary/light/moderate/active/very_active
- `tdeeKcal` - calculated TDEE
- `gymDaysPerWeek` - target gym days per week
- `dailyProteinTarget` - dynamic protein target (2.2g × weight)
- `dailyCalorieTarget` - TDEE-based calorie target
- `gymAccess` - commercial/home/none
- `fitnessLevel` - beginner/intermediate/advanced
- `onboardingComplete` - whether user completed setup
- `telegramChatId` - for personalized Telegram messages
- `primaryGoal` - lean_bulk/cut/maintain
- `motivationNote` - user's 90-day motivation

### New Models
- `BodyMeasurement` - chest, waist, arm, leg, body fat %, FFMI
- `VocabularyCard` - spaced repetition word bank (English + Kannada)
- `ErrorPattern` - recurring English mistake tracking
- `MorningCheckin` - daily morning check-in records
- `WorkoutProgram` - 12-week structured workout program
- `WorkoutSession` - individual sessions within a program

### Modified Models
- `WorkoutLog` - added sorenessLevel, progressNote, sessionProgramId
- `DietLog` - added mealTiming JSON field
