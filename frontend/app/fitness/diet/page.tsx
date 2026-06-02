'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { Trash2, Sparkles, Loader2, Send } from 'lucide-react';

const EXAMPLES = [
  'Rice 300g with dal 1 cup',
  '2 roti and paneer 150g',
  'Chicken breast 200g',
  'Oats 80g with milk 200ml',
  'Idli 3 pieces with sambar',
];

interface Meal {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export default function DietPage() {
  const api = useApi();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [water, setWater] = useState(0);
  const [loadingToday, setLoadingToday] = useState(true);
  const [savingWater, setSavingWater] = useState(false);
  const WATER_GOAL = 4;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plan, setPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [input, setInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getTodayDiet().catch(() => null),
      api.getTodayWater().catch(() => null),
    ]).then(([diet, waterData]) => {
      // API returns { log: DietLog | null, targets: {...} }
      const log = diet?.log;
      if (diet?.targets) setTargets(diet.targets);
      if (log?.meals?.length) {
        setMeals((log.meals as any[]).map((m: any) => ({
          name: m.name?.replace(/\s*\(.*\)$/, '') || m.name,
          quantity: m.name?.match(/\((.+)\)$/)?.[1] || '',
          calories: m.calories || 0,
          protein: m.proteinG || m.protein || 0,
          carbs: m.carbs || 0,
          fat: m.fat || 0,
          fiber: m.fiber || 0,
        })));
      }
      if (waterData?.litres !== undefined) setWater(waterData.litres);
    }).finally(() => setLoadingToday(false));
  }, []);

  const [targets, setTargets] = useState({ calories: 2800, protein: 140, water: 4 });

  const totals = meals.reduce(
    (a, m) => ({ cal: a.cal + m.calories, pro: a.pro + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { cal: 0, pro: 0, carbs: 0, fat: 0 },
  );

  async function addMeal() {
    if (!input.trim() || parsing) return;
    setError('');
    setParsing(true);
    try {
      const data = await api.parseMeal(input.trim());
      if (!data?.items?.length) {
        setError('Could not parse. Try: "Rice 300g, Chicken 200g"');
        return;
      }
      setMeals(p => [...p, ...data.items]);
      setInput('');
    } catch (e) {
      setError('Failed to calculate nutrition. Try again.');
    } finally {
      setParsing(false);
    }
  }

  function removeMeal(i: number) { setMeals(p => p.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!meals.length) return;
    setSaving(true);
    try {
      await api.logDiet({
        meals: meals.map(m => ({ name: `${m.name} (${m.quantity})`, calories: m.calories, proteinG: m.protein })),
        totalCalories: totals.cal,
        totalProteinG: totals.pro,
        totalCarbsG: totals.carbs,
        totalFatsG: totals.fat,
        waterLitres: water, // carry current water value along
      });
      setSaved(true);
      setMeals([]);
      // Invalidate dashboard diet cache so it refreshes on next visit
      cache.delete('dashboard_diet');
      cache.delete('dashboard_data');
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function getMealPlan() {
    setPlanLoading(true);
    try {
      const data = await api.getDietPlan();
      setPlan(data?.plan || data);
    } catch {} finally { setPlanLoading(false); }
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Diet Tracker</h1>
            <p className="text-gray-400 text-sm">Target: {targets.calories} kcal · {targets.protein}g protein/day (calculated from your TDEE)</p>
          </div>
          <div className="flex gap-2">
            <a href="/fitness/diet/timing" className="lifeos-btn-ghost text-xs px-3 py-2">⏰ Meal Timing</a>
            <a href="/fitness/diet/shopping" className="lifeos-btn-ghost text-xs px-3 py-2">🛒 Shopping List</a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">

            {/* Macro totals */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Calories', val: totals.cal, target: 2800, unit: 'kcal', color: totals.cal >= 2500 ? '#10b981' : '#f59e0b' },
                { label: 'Protein',  val: totals.pro, target: 140, unit: 'g', color: totals.pro >= 120 ? '#10b981' : '#6366f1' },
                { label: 'Carbs',    val: totals.carbs, target: 300, unit: 'g', color: '#06b6d4' },
                { label: 'Fat',      val: totals.fat, target: 80, unit: 'g', color: '#8b5cf6' },
              ].map((s) => (
                <div key={s.label} className="lifeos-card text-center p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: s.color }}>
                    {Math.round(s.val)}<span className="text-[10px] text-gray-500 ml-0.5">{s.unit}</span>
                  </p>
                  <div className="w-full bg-[#1a1a2e] rounded-full h-1 mt-2">
                    <div className="h-1 rounded-full transition-all duration-500"
                      style={{ backgroundColor: s.color, width: `${Math.min(100, (s.val / s.target) * 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1">/ {s.target}{s.unit}</p>
                </div>
              ))}
            </div>

            {/* Smart input */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-1">What did you eat?</p>
              <p className="text-xs text-gray-600 mb-3">Describe your meal — AI calculates nutrition automatically</p>

              <div className="flex gap-2">
                <input
                  className="lifeos-input flex-1 text-sm"
                  placeholder={loadingToday ? 'Loading today\'s diet...' : 'e.g. Rice 300g with chicken 200g and dal 1 cup'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMeal()}
                  disabled={parsing}
                />
                <button
                  onClick={addMeal}
                  disabled={parsing || !input.trim()}
                  className="lifeos-btn px-4 flex items-center gap-2 min-w-[90px] justify-center"
                >
                  {parsing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {parsing ? 'Parsing...' : 'Add'}
                </button>
              </div>

              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

              <div className="flex flex-wrap gap-1.5 mt-3">
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => setInput(ex)}
                    className="text-xs bg-[#1a1a2e] hover:bg-[#2a2a4a] border border-[#2a2a4a] text-gray-500 hover:text-gray-300 rounded-full px-2.5 py-1 transition-all">
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Meals list */}
            <AnimatePresence>
              {meals.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lifeos-card">
                  <p className="text-sm font-semibold text-gray-300 mb-3">Today's Meals</p>
                  <div className="space-y-2">
                    {meals.map((meal, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-2 bg-[#0a0a0f] rounded-lg px-3 py-2.5">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-white font-medium">{meal.name}</span>
                            <span className="text-xs text-gray-500">{meal.quantity}</span>
                          </div>
                          <div className="flex gap-3 mt-1">
                            <span className="text-xs font-medium text-yellow-400">{meal.calories} kcal</span>
                            <span className="text-xs text-emerald-400">P: {meal.protein}g</span>
                            <span className="text-xs text-cyan-400">C: {meal.carbs}g</span>
                            <span className="text-xs text-purple-400">F: {meal.fat}g</span>
                          </div>
                        </div>
                        <button onClick={() => removeMeal(i)}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  {/* Meal total bar */}
                  <div className="mt-3 pt-3 border-t border-[#1e1e36] flex gap-4 text-xs">
                    <span className="text-yellow-400 font-semibold">{Math.round(totals.cal)} kcal</span>
                    <span className="text-emerald-400">P: {Math.round(totals.pro)}g</span>
                    <span className="text-cyan-400">C: {Math.round(totals.carbs)}g</span>
                    <span className="text-purple-400">F: {Math.round(totals.fat)}g</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Water Tracker */}
            <div className="lifeos-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-300">💧 Water Intake</p>
                <span className={`text-sm font-bold ${water >= WATER_GOAL ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {water.toFixed(1)}L / {WATER_GOAL}L
                  {water >= WATER_GOAL && ' ✅'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#1a1a2e] rounded-full h-2 mb-3">
                <div className="h-2 rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (water / WATER_GOAL) * 100)}%` }} />
              </div>

              {/* Quick add buttons */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[0.25, 0.5, 1, 1.5].map((l) => (
                  <button key={l} disabled={savingWater || water >= WATER_GOAL}
                    onClick={async () => {
                      const newVal = Math.min(WATER_GOAL, water + l);
                      setWater(newVal);
                      setSavingWater(true);
                      try { await api.logWater(newVal); } catch {} finally { setSavingWater(false); }
                    }}
                    className="py-2 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400
                      hover:bg-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    +{l}L
                  </button>
                ))}
              </div>

              {/* Set exact amount */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((l) => (
                  <button key={l}
                    onClick={async () => {
                      setWater(l);
                      setSavingWater(true);
                      try { await api.logWater(l); } catch {} finally { setSavingWater(false); }
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition-all
                      ${water >= l ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' : 'bg-[#1a1a2e] border border-[#2a2a4a] text-gray-500'}`}>
                    {l}L
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                {savingWater ? '💾 Saving...' : 'Synced with Telegram /water command'}
              </p>
            </div>

            <button onClick={save} disabled={saving || !meals.length}
              className={`lifeos-btn w-full py-3 text-sm font-medium ${saved ? 'bg-emerald-600' : ''}`}>
              {saved ? '✅ Saved to Database!' : saving ? 'Saving...' : `Save Today's Diet${meals.length ? ` (${meals.length} items)` : ''}`}
            </button>
          </div>

          {/* AI Meal Plan */}
          <div className="lifeos-card h-fit">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-yellow-400" />
                <p className="text-sm font-semibold text-gray-300">AI Indian Meal Plan</p>
              </div>
              <button onClick={getMealPlan} disabled={planLoading} className="lifeos-btn text-xs">
                {planLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {plan ? (
              <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{plan}</div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-3xl mb-3">🍛</p>
                <p className="text-sm text-gray-500">Get your personalized Indian meal plan</p>
                <p className="text-xs text-gray-600 mt-1">2800 kcal · 140g protein · Budget-friendly</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
