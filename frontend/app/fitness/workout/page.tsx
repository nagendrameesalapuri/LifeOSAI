'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { Plus, Trash2, Dumbbell, TrendingUp, X, ChevronUp, ChevronDown } from 'lucide-react';

const WORKOUT_TYPES = ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps)', 'Legs', 'Full Body', 'Cardio', 'Arms', 'Core'];

export default function WorkoutPage() {
  const api = useApi();
  const [type, setType] = useState('Push (Chest, Shoulders, Triceps)');
  const [duration, setDuration] = useState(60);
  const [protein, setProtein] = useState(0);
  const [exercises, setExercises] = useState([{ name: '', sets: 3, reps: 10, weightKg: 0 }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [historyDrawer, setHistoryDrawer] = useState<{ name: string; data: any } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  function addExercise() {
    setExercises((p) => [...p, { name: '', sets: 3, reps: 10, weightKg: 0 }]);
  }
  function removeExercise(i: number) {
    setExercises((p) => p.filter((_, idx) => idx !== i));
  }
  function updateExercise(i: number, field: string, val: any) {
    setExercises((p) => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }

  async function openHistory(name: string) {
    if (!name.trim()) return;
    setHistoryLoading(true);
    setHistoryDrawer({ name, data: null });
    try {
      const data = await api.getProgressiveOverload(name);
      setHistoryDrawer({ name, data });
    } catch {
      setHistoryDrawer({ name, data: { history: [], recommendation: null } });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const shortType = type.split(' ')[0];
      await api.logWorkout({ type: shortType, exercises, durationMin: duration, proteinG: protein, notes });
      setSaved(true);
      setExercises([{ name: '', sets: 3, reps: 10, weightKg: 0 }]);
      // Invalidate dashboard so fitness score refreshes
      cache.delete('dashboard_data');
      cache.delete('dashboard_breakdown');
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function getAIPlan() {
    setPlanLoading(true);
    try {
      const data = await api.getWorkoutPlan();
      setPlan(data);
    } catch {} finally { setPlanLoading(false); }
  }

  function applyAIPlan() {
    if (!plan?.exercises) return;
    setExercises(plan.exercises.map((ex: any) => ({
      name: ex.name,
      sets: ex.sets || 3,
      reps: parseInt(String(ex.reps || ex.repsRange || '10').split('-')[0]) || 10,
      weightKg: ex.targetWeightKg || 0,
    })));
    if (plan.workoutType) setType(plan.workoutType);
    if (plan.duration) setDuration(plan.duration);
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />

      {/* Exercise history drawer */}
      <AnimatePresence>
        {historyDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setHistoryDrawer(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-[#0d0d1a] border border-[#1e1e36] rounded-2xl w-full max-w-md p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white">{historyDrawer.name}</h3>
                  <p className="text-xs text-gray-500">Progressive overload history</p>
                </div>
                <button onClick={() => setHistoryDrawer(null)} className="text-gray-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {historyLoading ? (
                <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
              ) : historyDrawer.data?.history?.length > 0 ? (
                <>
                  {historyDrawer.data.recommendation && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4">
                      <p className="text-xs text-emerald-400 font-medium">Next session</p>
                      <p className="text-sm text-gray-200 mt-0.5">{historyDrawer.data.recommendation}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {historyDrawer.data.history.slice(-5).reverse().map((log: any, i: number) => {
                      const prev = historyDrawer.data.history.slice(-5).reverse()[i + 1];
                      const trend = prev ? log.weightKg - prev.weightKg : 0;
                      return (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e1e36] last:border-0">
                          <div>
                            <p className="text-xs text-gray-400">
                              {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-sm font-medium text-white">
                              {log.sets} × {log.reps} reps @ {log.weightKg}kg
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {trend > 0 && <ChevronUp size={14} className="text-emerald-400" />}
                            {trend < 0 && <ChevronDown size={14} className="text-red-400" />}
                            <span className={`text-xs font-bold ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                              {trend !== 0 ? `${trend > 0 ? '+' : ''}${trend}kg` : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600 italic text-center py-6">
                  No history for "{historyDrawer.name}" yet. Log this exercise today!
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="md:ml-56 flex-1 p-4 md:p-6 pb-24 md:pb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Workout Log</h1>
        <p className="text-gray-400 text-sm mb-6">Log every session · Tap exercise name to see your history</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Workout type */}
            <div className="lifeos-card">
              <label className="text-xs text-gray-500 block mb-2">Workout Type</label>
              <select className="lifeos-input" value={type} onChange={(e) => setType(e.target.value)}>
                {WORKOUT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Meta */}
            <div className="lifeos-card grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Duration (mins)</label>
                <input type="number" className="lifeos-input" value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Post-workout protein (g)</label>
                <input type="number" className="lifeos-input" value={protein} placeholder="e.g. 30"
                  onChange={(e) => setProtein(parseInt(e.target.value) || 0)} />
              </div>
            </div>

            {/* Exercises */}
            <div className="lifeos-card">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-gray-500">Exercises</label>
                <button onClick={addExercise} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {exercises.map((ex, i) => (
                  <div key={i} className="space-y-1">
                    <div className="grid grid-cols-5 gap-2 items-center">
                      <div className="col-span-2 relative">
                        <input
                          className="lifeos-input text-xs w-full pr-6"
                          placeholder="Exercise name"
                          value={ex.name}
                          onChange={(e) => updateExercise(i, 'name', e.target.value)}
                        />
                        {ex.name.trim() && (
                          <button
                            onClick={() => openHistory(ex.name)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300"
                            title="View exercise history"
                          >
                            <TrendingUp size={12} />
                          </button>
                        )}
                      </div>
                      <input type="number" className="lifeos-input text-xs text-center" placeholder="Sets"
                        value={ex.sets} onChange={(e) => updateExercise(i, 'sets', parseInt(e.target.value))} />
                      <input type="number" className="lifeos-input text-xs text-center" placeholder="Reps"
                        value={ex.reps} onChange={(e) => updateExercise(i, 'reps', parseInt(e.target.value))} />
                      <button onClick={() => removeExercise(i)} className="text-gray-600 hover:text-red-400 flex justify-center">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="col-span-2 flex items-center gap-1">
                        <input
                          type="number"
                          className="lifeos-input text-xs w-full"
                          placeholder="Weight (kg)"
                          value={ex.weightKg || ''}
                          onChange={(e) => updateExercise(i, 'weightKg', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">Tap <TrendingUp size={9} className="inline" /> to see your history for any exercise</p>
            </div>

            <input className="lifeos-input" placeholder="Notes (optional)" value={notes}
              onChange={(e) => setNotes(e.target.value)} />

            <button onClick={save} disabled={saving} className={`lifeos-btn w-full py-3 ${saved ? 'bg-emerald-600' : ''}`}>
              {saved ? '✅ Workout Logged!' : saving ? 'Saving...' : 'Log Workout'}
            </button>
          </div>

          {/* AI Plan */}
          <div className="lifeos-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Dumbbell size={14} className="text-indigo-400" />
                <p className="text-sm font-semibold text-gray-300">AI Workout Plan</p>
              </div>
              <button onClick={getAIPlan} disabled={planLoading} className="lifeos-btn text-xs">
                {planLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {plan ? (
              <div>
                {plan.exercises && (
                  <div className="mb-4 space-y-2">
                    {plan.exercises.slice(0, 6).map((ex: any, i: number) => (
                      <div key={i} className="bg-[#12121e] rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{ex.name}</p>
                          {ex.targetWeightKg && <span className="text-xs text-emerald-400">{ex.targetWeightKg}kg</span>}
                        </div>
                        <p className="text-xs text-gray-500">{ex.sets} × {ex.repsRange || ex.reps} reps</p>
                        {ex.progressionNote && <p className="text-xs text-indigo-400 mt-1">{ex.progressionNote}</p>}
                        {ex.formCue && <p className="text-xs text-gray-600 mt-0.5 italic">{ex.formCue}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={applyAIPlan} className="w-full lifeos-btn text-xs py-2">
                  Apply to Log Form
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">Click "Generate" for an AI workout plan based on your history and goals.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
