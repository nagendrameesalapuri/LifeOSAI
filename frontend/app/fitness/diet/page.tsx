'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { Trash2, Sparkles, Loader2, Send, Camera, History, Barcode } from 'lucide-react';

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
  // Water goal comes from targets.water (set by API from user profile)
  // 4L is only used before the API responds

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plan, setPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [input, setInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [frequentMeals, setFrequentMeals] = useState<{ name: string; calories: number; protein: number; count: number }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Show cached data instantly
    const cachedDiet = cache.get('diet_today');
    if (cachedDiet) {
      applyDietData(cachedDiet.diet, cachedDiet.water);
      setLoadingToday(false);
    }
    // Refresh in background
    api.getFrequentMeals().then(setFrequentMeals).catch(() => {});

    Promise.all([
      api.getTodayDiet().catch(() => null),
      api.getTodayWater().catch(() => null),  // always fresh — Telegram may have logged water
    ]).then(([diet, waterData]) => {
      cache.set('diet_today', { diet, water: waterData }, 30 * 1000); // 30s — Telegram syncs fast
      applyDietData(diet, waterData);
    }).finally(() => setLoadingToday(false));
  }, []);

  function applyDietData(diet: any, waterData: any) {
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
  }

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
      const updated = [...meals, ...data.items];
      setMeals(updated);
      setInput('');
      silentSave(updated);
    } catch (e) {
      setError('Failed to calculate nutrition. Try again.');
    } finally {
      setParsing(false);
    }
  }

  async function addMealFromPhoto(file: File) {
    setPhotoLoading(true);
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target!.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await api.parseMealFromPhoto(base64, file.type || 'image/jpeg');
      if (!data?.items?.length) { setError('Could not identify food. Try a clearer photo or type instead.'); return; }
      const updated = [...meals, ...data.items];
      setMeals(updated);
      silentSave(updated);
    } catch { setError('Photo analysis failed. Try typing instead.'); } finally { setPhotoLoading(false); }
  }

  function addFrequentMeal(m: any) {
    const updated = [...meals, { name: m.name, quantity: '', calories: m.calories, protein: m.protein, carbs: m.carbs || 0, fat: m.fat || 0, fiber: 0 }];
    setMeals(updated);
    silentSave(updated);
  }

  async function lookupBarcode() {
    if (!barcodeInput.trim() || barcodeLoading) return;
    setBarcodeLoading(true);
    setError('');
    try {
      const data = await api.getBarcodeNutrition(barcodeInput.trim());
      const updated = [...meals, { name: data.name, quantity: data.quantity, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat, fiber: data.fiber || 0 }];
      setMeals(updated);
      setBarcodeInput('');
      setShowBarcodeInput(false);
      silentSave(updated);
    } catch { setError('Barcode not found. Try a different code or type the meal instead.'); } finally { setBarcodeLoading(false); }
  }

  function removeMeal(i: number) {
    const updated = meals.filter((_, idx) => idx !== i);
    setMeals(updated);
    silentSave(updated);
  }

  // Silently saves current meal list to DB — called after every add/remove so data persists on refresh
  async function silentSave(currentMeals: Meal[]) {
    if (!currentMeals.length) return;
    const t = currentMeals.reduce(
      (a, m) => ({ cal: a.cal + m.calories, pro: a.pro + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
      { cal: 0, pro: 0, carbs: 0, fat: 0 },
    );
    try {
      await api.logDiet({
        meals: currentMeals.map(m => ({ name: m.quantity ? `${m.name} (${m.quantity})` : m.name, calories: m.calories, proteinG: m.protein, carbs: m.carbs, fat: m.fat })),
        totalCalories: t.cal, totalProteinG: t.pro, totalCarbsG: t.carbs, totalFatsG: t.fat,
        waterLitres: water,
      });
      cache.delete('diet_today');
      cache.delete('dashboard_diet');
    } catch (e) { console.error('Auto-save failed:', e); }
  }

  async function save() {
    if (!meals.length) return;
    setSaving(true);
    try {
      await api.logDiet({
        meals: meals.map(m => ({ name: m.quantity ? `${m.name} (${m.quantity})` : m.name, calories: m.calories, proteinG: m.protein, carbs: m.carbs, fat: m.fat })),
        totalCalories: totals.cal,
        totalProteinG: totals.pro,
        totalCarbsG: totals.carbs,
        totalFatsG: totals.fat,
        waterLitres: water,
      });
      setSaved(true);
      cache.delete('diet_today');
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
      <main className="md:ml-56 flex-1 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Diet Tracker</h1>
            <p className="text-gray-400 text-sm">Target: {targets.calories} kcal · {targets.protein}g protein/day</p>
          </div>
          <div className="flex gap-2">
            <a href="/fitness/diet/timing" className="lifeos-btn-ghost text-xs px-3 py-2">⏰ Meal Timing</a>
            <a href="/fitness/diet/shopping" className="lifeos-btn-ghost text-xs px-3 py-2">🛒 Shopping List</a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">

            {/* Macro totals — all targets from user profile via API */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: 'Calories', val: totals.cal,   target: targets.calories, unit: 'kcal', color: totals.cal   >= targets.calories * 0.9 ? '#10b981' : '#f59e0b' },
                { label: 'Protein',  val: totals.pro,   target: targets.protein,  unit: 'g',    color: totals.pro   >= targets.protein  * 0.85 ? '#10b981' : '#6366f1' },
                { label: 'Carbs',    val: totals.carbs, target: Math.round(targets.calories * 0.4 / 4), unit: 'g', color: '#06b6d4' },
                { label: 'Fat',      val: totals.fat,   target: Math.round(targets.calories * 0.25 / 9), unit: 'g', color: '#8b5cf6' },
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
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-300">What did you eat?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setShowBarcodeInput(v => !v); setError(''); }}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all
                      ${showBarcodeInput ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-[#2a2a4a] bg-[#1a1a2e] text-gray-500 hover:text-gray-300 hover:border-cyan-500/30'}`}>
                    <Barcode size={12} /> Barcode
                  </button>
                  <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-all
                    ${photoLoading ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-[#2a2a4a] bg-[#1a1a2e] text-gray-500 hover:text-gray-300 hover:border-indigo-500/30'}`}>
                    {photoLoading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    {photoLoading ? 'Analysing...' : 'Photo'}
                    <input type="file" accept="image/*" className="hidden" disabled={photoLoading}
                      onChange={(e) => e.target.files?.[0] && addMealFromPhoto(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-3">Type, snap a photo, or scan a barcode — AI calculates nutrition</p>

              {/* Barcode input panel */}
              {showBarcodeInput && (
                <div className="mb-3 flex gap-2">
                  <input
                    className="lifeos-input flex-1 text-sm"
                    placeholder="Enter barcode number (EAN-13, UPC-A)"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookupBarcode()}
                    inputMode="numeric"
                    autoFocus
                  />
                  <button
                    onClick={lookupBarcode}
                    disabled={barcodeLoading || !barcodeInput.trim()}
                    className="lifeos-btn px-4 flex items-center gap-2 min-w-[80px] justify-center"
                  >
                    {barcodeLoading ? <Loader2 size={13} className="animate-spin" /> : <Barcode size={13} />}
                    {barcodeLoading ? '...' : 'Lookup'}
                  </button>
                </div>
              )}

              {/* Quick-tap from history */}
              {frequentMeals.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <History size={9} /> Your usual meals
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {frequentMeals.map((m) => (
                      <button key={m.name} onClick={() => addFrequentMeal(m)}
                        className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-full px-2.5 py-1 transition-all flex items-center gap-1.5">
                        <span>{m.name}</span>
                        <span className="text-[9px] text-emerald-600">{m.calories}kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                <span className={`text-sm font-bold ${water >= targets.water ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {water.toFixed(1)}L / {targets.water}L
                  {water >= targets.water && ' ✅'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#1a1a2e] rounded-full h-2 mb-3">
                <div className="h-2 rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (water / targets.water) * 100)}%` }} />
              </div>

              {/* Quick add buttons */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[0.25, 0.5, 1, 1.5].map((l) => (
                  <button key={l} disabled={savingWater || water >= targets.water}
                    onClick={async () => {
                      const newVal = Math.min(targets.water, water + l);
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
                <p className="text-xs text-gray-600 mt-1">{targets.calories} kcal · {targets.protein}g protein · Budget-friendly</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
