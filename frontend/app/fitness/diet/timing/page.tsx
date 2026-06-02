'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { Clock, Dumbbell, Moon, Coffee, Loader2 } from 'lucide-react';

export default function MealTimingPage() {
  const api = useApi();
  const [timing, setTiming] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMealTiming().then(setTiming).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f]">
        <Sidebar />
        <main className="ml-56 flex-1 p-6 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-white mb-1">Meal Timing</h1>
        <p className="text-gray-400 text-sm mb-6">When you eat matters as much as what you eat — optimize for lean muscle growth</p>

        <div className="space-y-6">
          {/* Daily timeline */}
          <div className="lifeos-card">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Clock size={14} className="text-cyan-400" />
              Optimal Daily Nutrition Timeline
            </h3>

            {[
              { time: '7:00 AM', label: 'Breakfast', emoji: '☀️', target: '40-50g protein + carbs', example: 'Oats 80g + 3 eggs + banana', color: '#f59e0b' },
              { time: '10:00 AM', label: 'Mid-Morning (Pre-workout if PM gym)', emoji: '🥤', target: '20g protein + 30g carbs', example: '4 dates + whey shake or 2 eggs', color: '#06b6d4' },
              { time: '1:00 PM', label: 'Lunch', emoji: '🍛', target: '50-60g protein + complex carbs', example: 'Rice 200g + chicken 200g + dal + salad', color: '#10b981' },
              { time: '4:00 PM', label: 'Pre-workout (if evening gym)', emoji: '⚡', target: '20-30g protein + 30g carbs', example: '2 eggs + banana OR dates + milk', color: '#f97316' },
              { time: '6-7 PM', label: 'Post-workout window', emoji: '💪', target: '40-50g protein + 50g carbs', example: 'Rice 200g + 3 eggs OR chicken + rice', color: '#ec4899' },
              { time: '8:00 PM', label: 'Dinner', emoji: '🌙', target: '40-50g protein + moderate carbs', example: '3 roti + paneer 150g + sabzi', color: '#8b5cf6' },
              { time: '10:30 PM', label: 'Before Bed (Casein)', emoji: '😴', target: '20g protein (slow-digesting)', example: 'Curd 200g or paneer 100g or milk', color: '#6366f1' },
            ].map((meal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-4 py-3 border-b border-[#1e1e36] last:border-0"
              >
                <div className="text-center w-16 flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: meal.color }}>{meal.time}</p>
                  <p className="text-lg">{meal.emoji}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{meal.label}</p>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-400">{meal.target}</span>
                  </div>
                  <p className="text-xs text-gray-500">Example: {meal.example}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pre-workout */}
          {timing?.preWorkout && (
            <div className="lifeos-card bg-orange-600/5 border-orange-600/20">
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell size={16} className="text-orange-400" />
                <h3 className="text-sm font-semibold text-orange-400">Pre-Workout Meal</h3>
                <span className="text-xs text-gray-500">— {timing.preWorkout.timing}</span>
              </div>
              <div className="flex gap-4 mb-3">
                <div><p className="text-xs text-gray-500">Target Carbs</p><p className="text-sm font-bold text-white">{timing.preWorkout.targetCarbs}g</p></div>
                <div><p className="text-xs text-gray-500">Target Protein</p><p className="text-sm font-bold text-white">{timing.preWorkout.targetProtein}g</p></div>
              </div>
              <div className="space-y-1">
                {timing.preWorkout.suggestions?.map((s: string, i: number) => (
                  <p key={i} className="text-xs text-gray-400">• {s}</p>
                ))}
              </div>
              <p className="text-xs text-orange-400 mt-2">Why: {timing.preWorkout.why}</p>
            </div>
          )}

          {/* Post-workout */}
          {timing?.postWorkout && (
            <div className="lifeos-card bg-pink-600/5 border-pink-600/20">
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell size={16} className="text-pink-400" />
                <h3 className="text-sm font-semibold text-pink-400">Post-Workout Meal</h3>
                <span className="text-xs text-gray-500">— {timing.postWorkout.timing}</span>
              </div>
              <div className="flex gap-4 mb-3">
                <div><p className="text-xs text-gray-500">Target Carbs</p><p className="text-sm font-bold text-white">{timing.postWorkout.targetCarbs}g</p></div>
                <div><p className="text-xs text-gray-500">Target Protein</p><p className="text-sm font-bold text-white">{timing.postWorkout.targetProtein}g</p></div>
              </div>
              <div className="space-y-1">
                {timing.postWorkout.suggestions?.map((s: string, i: number) => (
                  <p key={i} className="text-xs text-gray-400">• {s}</p>
                ))}
              </div>
              <p className="text-xs text-pink-400 mt-2">Why: {timing.postWorkout.why}</p>
            </div>
          )}

          {/* Casein before bed */}
          {timing?.casein && (
            <div className="lifeos-card bg-purple-600/5 border-purple-600/20">
              <div className="flex items-center gap-2 mb-3">
                <Moon size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-400">Before Bed (Casein)</h3>
                <span className="text-xs text-gray-500">— {timing.casein.timing}</span>
              </div>
              <div className="space-y-1 mb-3">
                {timing.casein.suggestions?.map((s: string, i: number) => (
                  <p key={i} className="text-xs text-gray-400">• {s}</p>
                ))}
              </div>
              <p className="text-xs text-purple-400">Why: {timing.casein.why}</p>
            </div>
          )}

          {/* Supplements */}
          {timing?.supplements && (
            <div className="lifeos-card">
              <div className="flex items-center gap-2 mb-3">
                <Coffee size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-gray-300">Supplements (Evidence-Based Only)</h3>
              </div>
              <div className="space-y-3">
                {timing.supplements.map((supp: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                    supp.priority === 'Essential' ? 'bg-emerald-600/10 border border-emerald-600/20' : 'bg-[#0d0d1a]'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{supp.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          supp.priority === 'Essential' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-600/20 text-gray-400'
                        }`}>{supp.priority}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Dose: {supp.dose} | When: {supp.timing}</p>
                      {supp.cost && <p className="text-xs text-gray-600">Cost: {supp.cost}</p>}
                    </div>
                    <p className="text-xs text-gray-500 max-w-[150px]">{supp.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
