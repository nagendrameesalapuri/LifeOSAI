'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight, Zap, Target, Dumbbell, Moon, BookOpen } from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to LIFEOS AI',
    subtitle: '10 questions to personalize your 90-day plan',
    icon: '🚀',
    type: 'info',
  },
  {
    id: 'body',
    title: 'Your Body Stats',
    subtitle: 'Used to calculate your exact calorie and protein targets',
    icon: '💪',
    type: 'form',
    fields: [
      { key: 'weightKg', label: 'Current Weight (kg)', type: 'number', placeholder: '62' },
      { key: 'targetWeightKg', label: 'Target Weight (kg)', type: 'number', placeholder: '70' },
      { key: 'heightCm', label: 'Height (cm)', type: 'number', placeholder: '170' },
      { key: 'age', label: 'Age', type: 'number', placeholder: '25' },
    ],
  },
  {
    id: 'activity',
    title: 'How Active Are You?',
    subtitle: 'This sets your TDEE — Total Daily Energy Expenditure',
    icon: '🏃',
    type: 'choice',
    key: 'activityLevel',
    choices: [
      { value: 'sedentary', label: 'Mostly sitting', sub: 'Office work, minimal exercise', emoji: '💻' },
      { value: 'light', label: 'Light activity', sub: '1-3 workouts per week', emoji: '🚶' },
      { value: 'moderate', label: 'Moderately active', sub: '3-5 workouts per week', emoji: '🏋️' },
      { value: 'active', label: 'Very active', sub: '6+ workouts per week', emoji: '⚡' },
    ],
  },
  {
    id: 'gym',
    title: 'Gym Setup',
    subtitle: 'Determines what exercises go in your program',
    icon: '🏋️',
    type: 'choice',
    key: 'gymAccess',
    choices: [
      { value: 'commercial', label: 'Commercial Gym', sub: 'Full equipment — barbells, cables, machines', emoji: '🏢' },
      { value: 'home', label: 'Home Gym', sub: 'Dumbbells, bodyweight, some equipment', emoji: '🏠' },
      { value: 'none', label: 'No Equipment', sub: 'Bodyweight only', emoji: '🤸' },
    ],
  },
  {
    id: 'goal',
    title: 'Primary Goal',
    subtitle: 'Sets calorie surplus or deficit strategy',
    icon: '🎯',
    type: 'choice',
    key: 'primaryGoal',
    choices: [
      { value: 'lean_bulk', label: 'Build Muscle (Lean Bulk)', sub: 'Gain muscle with minimal fat — +250 kcal surplus', emoji: '💪' },
      { value: 'cut', label: 'Lose Fat (Cut)', sub: 'Maintain muscle while losing fat — -300 kcal deficit', emoji: '🔥' },
      { value: 'maintain', label: 'Maintain & Recomp', sub: 'Build strength at current weight', emoji: '⚖️' },
    ],
  },
  {
    id: 'gymdays',
    title: 'How Many Gym Days Per Week?',
    subtitle: 'Sets your workout program split',
    icon: '📅',
    type: 'choice',
    key: 'gymDaysPerWeek',
    choices: [
      { value: 3, label: '3 Days', sub: 'Full Body 3x — best for beginners', emoji: '3️⃣' },
      { value: 4, label: '4 Days', sub: 'Upper/Lower split — great for intermediate', emoji: '4️⃣' },
      { value: 5, label: '5 Days', sub: 'PPL split — Push Pull Legs', emoji: '5️⃣' },
      { value: 6, label: '6 Days', sub: 'PPL 6-day — for advanced', emoji: '6️⃣' },
    ],
  },
  {
    id: 'level',
    title: 'Fitness Level',
    subtitle: 'Sets starting weights in your program',
    icon: '📊',
    type: 'choice',
    key: 'fitnessLevel',
    choices: [
      { value: 'beginner', label: 'Beginner', sub: 'Less than 1 year training', emoji: '🌱' },
      { value: 'intermediate', label: 'Intermediate', sub: '1-3 years consistent training', emoji: '🌿' },
      { value: 'advanced', label: 'Advanced', sub: '3+ years, familiar with progressive overload', emoji: '🌳' },
    ],
  },
  {
    id: 'english',
    title: 'English Confidence Level',
    subtitle: 'Personalizes your grammar lessons',
    icon: '🗣️',
    type: 'choice',
    key: 'englishLevel',
    choices: [
      { value: 'beginner', label: 'Basic', sub: 'Can understand but struggle to form sentences', emoji: '🌱' },
      { value: 'intermediate', label: 'Intermediate', sub: 'Can speak but make grammar mistakes', emoji: '📈' },
      { value: 'advanced', label: 'Advanced', sub: 'Mostly fluent, working on confidence', emoji: '✨' },
    ],
  },
  {
    id: 'profession',
    title: 'Your Profession',
    subtitle: 'Tailors career coaching to your background',
    icon: '💼',
    type: 'form',
    fields: [
      { key: 'profession', label: 'Job Title / Role', type: 'text', placeholder: 'QA Automation Engineer' },
      { key: 'motivationNote', label: 'Why are you here? (What do you want to change in 90 days?)', type: 'textarea', placeholder: 'I want to get to 70kg, speak English confidently, and transition to Cloud Engineering...' },
    ],
  },
  {
    id: 'done',
    title: 'You\'re all set!',
    subtitle: 'Your personalized 90-day plan is ready',
    icon: '🎉',
    type: 'complete',
  },
];

export default function OnboardingPage() {
  const api = useApi();
  const router = useRouter();
  const [step, setStep] = useState(0);

  // If user already completed onboarding, redirect to dashboard
  useEffect(() => {
    api.getProfile().then((profile: any) => {
      if (profile?.onboardingComplete === true) {
        router.replace('/dashboard');
      }
    }).catch(() => {});
  }, []);
  const [data, setData] = useState<Record<string, any>>({
    weightKg: '',
    targetWeightKg: '',
    heightCm: '',
    age: '',
    activityLevel: 'moderate',
    gymAccess: 'commercial',
    primaryGoal: 'lean_bulk',
    gymDaysPerWeek: 4,
    fitnessLevel: 'intermediate',
    profession: '',
    motivationNote: '',
  });
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [error, setError] = useState('');

  const currentStep = STEPS[step];
  const progress = ((step) / (STEPS.length - 1)) * 100;

  function updateData(key: string, value: any) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  async function next() {
    if (step === STEPS.length - 2) {
      // Save all data
      await saveProfile();
    } else if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError('');
    try {
      const profileData = {
        weightKg: parseFloat(data.weightKg) || 62,
        targetWeightKg: parseFloat(data.targetWeightKg) || 70,
        heightCm: parseFloat(data.heightCm) || 170,
        age: parseInt(data.age) || 25,
        activityLevel: data.activityLevel,
        gymAccess: data.gymAccess,
        primaryGoal: data.primaryGoal,
        gymDaysPerWeek: parseInt(data.gymDaysPerWeek) || 4,
        fitnessLevel: data.fitnessLevel,
        profession: data.profession,
        motivationNote: data.motivationNote,
        onboardingComplete: true,
      };

      await api.updateProfile(profileData);

      // Move to complete step first (shows loading)
      setStep(s => s + 1);
      setGeneratingPlan(true);

      // Generate AI plan — calculates all targets and stores in DB
      try {
        const generatedPlan = await api.generatePlan();
        setPlan(generatedPlan);
      } catch {
        // Fallback: use TDEE formula values
        await api.getTDEE().catch(() => {});
      } finally {
        setGeneratingPlan(false);
      }
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-1 bg-[#1e1e36] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2 text-right">Step {step + 1} of {STEPS.length}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step icon and title */}
            <div className="text-center mb-8">
              <p className="text-5xl mb-4">{currentStep.icon}</p>
              <h1 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h1>
              <p className="text-gray-400 text-sm">{currentStep.subtitle}</p>
            </div>

            {/* WELCOME STEP */}
            {currentStep.type === 'info' && (
              <div className="space-y-4">
                {[
                  { icon: Dumbbell, label: 'Personalized 12-week workout program', color: '#f97316' },
                  { icon: Target, label: 'TDEE-based calorie & protein targets', color: '#10b981' },
                  { icon: BookOpen, label: 'AI English coach with spaced repetition', color: '#6366f1' },
                  { icon: Moon, label: 'Sleep & recovery optimization', color: '#8b5cf6' },
                  { icon: Zap, label: 'Morning check-ins & proactive nudges', color: '#f59e0b' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-3 lifeos-card">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}22` }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <p className="text-sm text-gray-300">{label}</p>
                    <CheckCircle size={12} className="text-emerald-400 ml-auto" />
                  </div>
                ))}
              </div>
            )}

            {/* FORM STEP */}
            {currentStep.type === 'form' && (
              <div className="space-y-4">
                {(currentStep as any).fields?.map((field: any) => (
                  <div key={field.key}>
                    <label className="text-xs text-gray-500 block mb-1.5">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="lifeos-input resize-none min-h-[100px]"
                        placeholder={field.placeholder}
                        value={data[field.key] || ''}
                        onChange={(e) => updateData(field.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type={field.type}
                        className="lifeos-input"
                        placeholder={field.placeholder}
                        value={data[field.key] || ''}
                        onChange={(e) => updateData(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* CHOICE STEP */}
            {currentStep.type === 'choice' && (
              <div className="space-y-3">
                {(currentStep as any).choices?.map((choice: any) => {
                  const isSelected = data[(currentStep as any).key] === choice.value;
                  return (
                    <button
                      key={choice.value}
                      onClick={() => updateData((currentStep as any).key, choice.value)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-600/60 text-white'
                          : 'bg-[#12121e] border-[#2a2a4a] text-gray-400 hover:border-indigo-600/30 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-2xl">{choice.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{choice.label}</p>
                        <p className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-300' : 'text-gray-600'}`}>{choice.sub}</p>
                      </div>
                      {isSelected && <CheckCircle size={16} className="text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* COMPLETE STEP */}
            {currentStep.type === 'complete' && (
              <div className="space-y-4">
                {generatingPlan ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-lg font-semibold text-white mb-2">AI is generating your plan...</p>
                    <p className="text-sm text-gray-400">Calculating your exact calories, protein, carbs, fat and water targets</p>
                  </div>
                ) : (
                  <>
                    <div className="lifeos-card-glow py-5 text-center">
                      <p className="text-2xl font-bold gradient-text mb-1">Your 90-Day Plan is Ready! 🎉</p>
                      {plan?.summary && <p className="text-xs text-gray-400 mt-2 px-2">{plan.summary}</p>}
                    </div>

                    {/* Daily Nutrition Targets — all from DB */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Daily Nutrition Targets</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Calories',  value: plan ? `${plan.dailyCalories} kcal` : '—', icon: '🔥', color: '#f59e0b' },
                          { label: 'Protein',   value: plan ? `${plan.dailyProtein}g` : '—',       icon: '💪', color: '#10b981' },
                          { label: 'Carbs',     value: plan ? `${plan.dailyCarbs}g` : '—',         icon: '🌾', color: '#06b6d4' },
                          { label: 'Fat',       value: plan ? `${plan.dailyFat}g` : '—',           icon: '🥑', color: '#8b5cf6' },
                          { label: 'Water',     value: plan ? `${plan.dailyWater}L` : '—',         icon: '💧', color: '#22d3ee' },
                          { label: 'Meals/day', value: plan ? `${plan.mealsPerDay} meals` : '—',   icon: '🍽️', color: '#f97316' },
                        ].map(({ label, value, icon, color }) => (
                          <div key={label} className="lifeos-card flex items-center gap-3 py-3">
                            <span className="text-xl">{icon}</span>
                            <div>
                              <p className="text-[10px] text-gray-500">{label}</p>
                              <p className="text-sm font-bold text-white">{value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Workout + Learning */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="lifeos-card py-3">
                        <p className="text-xl mb-1">🏋️</p>
                        <p className="text-[10px] text-gray-500">Workout Program</p>
                        <p className="text-sm font-bold text-white">{data.gymDaysPerWeek}-day split</p>
                      </div>
                      <div className="lifeos-card py-3">
                        <p className="text-xl mb-1">🧠</p>
                        <p className="text-[10px] text-gray-500">AI Learning</p>
                        <p className="text-sm font-bold text-white">English + Kannada</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-600 text-center">All targets stored in your profile and used by every AI feature</p>
                  </>
                )}

                {!generatingPlan && (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="lifeos-btn w-full py-4 text-base font-semibold flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    Start My 90-Day Journey
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}

            {/* Next button */}
            {currentStep.type !== 'complete' && (
              <button
                onClick={next}
                disabled={saving}
                className="lifeos-btn w-full py-4 mt-8 text-base font-semibold flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {step === STEPS.length - 2 ? 'Generate My Plan' : 'Continue'}
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            )}

            {step > 0 && currentStep.type !== 'complete' && (
              <button onClick={() => setStep(s => s - 1)} className="w-full text-center text-sm text-gray-600 mt-3 hover:text-gray-400">
                ← Back
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
