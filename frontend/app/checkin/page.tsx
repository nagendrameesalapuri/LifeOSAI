'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  Sun, Zap, Heart, Target, CheckCircle2, ArrowRight,
  Flame, Trophy, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const MOOD_EMOJIS = ['😔', '😕', '😐', '🙂', '😄'];
const ENERGY_EMOJIS = ['🪫', '😴', '⚡', '🔥', '🚀'];
const RATING_EMOJIS = ['💀', '😤', '😐', '💪', '🔥'];

export default function MorningCheckinPage() {
  const api = useApi();
  const [step, setStep] = useState(0); // 0=loading, 1=already done, 2=checkin form, 3=done
  const [aiMessage, setAiMessage] = useState<any>(null);
  const [streaks, setStreaks] = useState<any>(null);
  const [todayCheckin, setTodayCheckin] = useState<any>(null);

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [yesterdayRating, setYesterdayRating] = useState(3);
  const [goals, setGoals] = useState(['', '', '']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCheckin();
  }, []);

  async function loadCheckin() {
    try {
      const data = await api.getMorningCheckin();
      setAiMessage(data?.aiMessage);
      setStreaks(data?.streaks);
      if (data?.todayCheckin) {
        setTodayCheckin(data.todayCheckin);
        setStep(1); // already checked in today
      } else {
        setStep(2); // show form
      }
    } catch {
      setStep(2);
    }
  }

  async function submit() {
    setSaving(true);
    try {
      const filledGoals = goals.filter((g) => g.trim().length > 0);
      await api.saveMorningCheckin({
        mood,
        energy,
        yesterdayRating,
        todayGoals: filledGoals,
      });
      setStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function updateGoal(i: number, val: string) {
    const updated = [...goals];
    updated[i] = val;
    setGoals(updated);
  }

  if (step === 0) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f]">
        <Sidebar />
        <main className="ml-56 flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Sun className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Morning Check-in</h1>
            <p className="text-gray-400 text-sm">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* AI Message */}
        <AnimatePresence>
          {aiMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mb-6"
            >
              <p className="text-sm text-indigo-300 font-medium mb-2">{aiMessage.greeting}</p>
              {aiMessage.yesterdaySummary && (
                <div className="flex gap-4 mb-3">
                  {aiMessage.yesterdaySummary.wins?.map((win: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-gray-300">{win}</span>
                    </div>
                  ))}
                </div>
              )}
              {aiMessage.insight && (
                <p className="text-xs text-gray-400 border-t border-white/5 pt-2 mt-2">{aiMessage.insight}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streaks bar */}
        {streaks && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Gym', value: streaks.gym, icon: '💪', color: 'text-orange-400' },
              { label: 'Sleep', value: streaks.sleep, icon: '😴', color: 'text-blue-400' },
              { label: 'Study', value: streaks.study, icon: '📚', color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xl">{s.icon}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label} streak</p>
              </div>
            ))}
          </div>
        )}

        {/* Already checked in */}
        {step === 1 && todayCheckin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Already checked in today!</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-2xl">{MOOD_EMOJIS[todayCheckin.mood - 1] || '😐'}</p>
                  <p className="text-xs text-gray-400 mt-1">Mood</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl">{ENERGY_EMOJIS[todayCheckin.energy - 1] || '⚡'}</p>
                  <p className="text-xs text-gray-400 mt-1">Energy</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl">{RATING_EMOJIS[todayCheckin.yesterdayRating - 1] || '😐'}</p>
                  <p className="text-xs text-gray-400 mt-1">Yesterday</p>
                </div>
              </div>
              {todayCheckin.todayGoals?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Today's intentions</p>
                  <div className="space-y-1">
                    {todayCheckin.todayGoals.map((goal: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <Target className="w-3.5 h-3.5 text-indigo-400" />
                        {goal}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium text-center transition-colors">
                Go to Dashboard
              </Link>
              <Link href="/habits" className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl py-3 text-sm font-medium text-center transition-colors">
                Log Habits
              </Link>
            </div>
          </motion.div>
        )}

        {/* Check-in form */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Yesterday rating */}
            <div className="bg-white/5 rounded-2xl p-5">
              <p className="text-sm font-medium text-gray-300 mb-4">How was yesterday overall?</p>
              <div className="flex justify-between gap-2">
                {RATING_EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => setYesterdayRating(i + 1)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                      yesterdayRating === i + 1 ? 'bg-indigo-600/30 ring-1 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-[10px] text-gray-500">{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-400" /> Current mood
                </p>
                <span className="text-2xl">{MOOD_EMOJIS[mood - 1]}</span>
              </div>
              <input
                type="range" min={1} max={5} value={mood}
                onChange={(e) => setMood(+e.target.value)}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Low</span><span>High</span>
              </div>
            </div>

            {/* Energy */}
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" /> Energy level
                </p>
                <span className="text-2xl">{ENERGY_EMOJIS[energy - 1]}</span>
              </div>
              <input
                type="range" min={1} max={5} value={energy}
                onChange={(e) => setEnergy(+e.target.value)}
                className="w-full accent-yellow-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Drained</span><span>Fired up</span>
              </div>
            </div>

            {/* Today's top 3 intentions */}
            <div className="bg-white/5 rounded-2xl p-5">
              <p className="text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" /> Today's top 3 intentions
              </p>
              <p className="text-xs text-gray-500 mb-4">What 3 things would make today a win?</p>
              <div className="space-y-3">
                {goals.map((goal, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-indigo-400 font-bold w-5 text-center">{i + 1}.</span>
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => updateGoal(i, e.target.value)}
                      placeholder={[
                        'e.g., Hit 140g protein today',
                        'e.g., Study Docker for 30 mins',
                        'e.g., Sleep before 10:30pm',
                      ][i]}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* AI priorities if available */}
            {aiMessage?.todayPriorities && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs text-amber-400 font-medium uppercase tracking-wide mb-2">AI suggests for today</p>
                <div className="space-y-1">
                  {aiMessage.todayPriorities.map((p: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-4 font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Start My Day'}
            </button>
          </motion.div>
        )}

        {/* Done state */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🌅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Day started!</h2>
            <p className="text-gray-400 mb-8">You've set your intentions. Now go execute.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 text-sm font-medium transition-colors">
                Dashboard
              </Link>
              <Link href="/habits" className="bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl px-6 py-3 text-sm font-medium transition-colors">
                Log Habits
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
