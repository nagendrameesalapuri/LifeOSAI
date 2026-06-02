'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { CheckCircle2, Circle, Flame, Droplets, Sun, Trophy } from 'lucide-react';
import Link from 'next/link';

const HABITS = [
  { key: 'gym',     label: 'Gym / Workout',      emoji: '💪', points: 25 },
  { key: 'sleep',   label: 'Good Sleep (7+ hrs)', emoji: '😴', points: 20 },
  { key: 'study',   label: 'Study Session',       emoji: '📚', points: 20 },
  { key: 'english', label: 'English Practice',    emoji: '🗣️', points: 15 },
  { key: 'kannada', label: 'Kannada Practice',    emoji: '🇮🇳', points: 10 },
];

export default function HabitsPage() {
  const api = useApi();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [water, setWater] = useState(0);
  const [scores, setScores] = useState<any>(null);
  const [streaks, setStreaks] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [scoreData, streakData] = await Promise.all([
        api.getHabitScores(),
        api.getStreaks().catch(() => null),
      ]);
      setScores(scoreData);
      setStreaks(streakData);
    } catch {}
  }

  async function saveCheckin() {
    setSaving(true);
    try {
      await api.habitCheckin({ ...checked, waterLitres: water });
      setSaved(true);
      loadData();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  const todayPoints = HABITS.reduce((sum, h) => sum + (checked[h.key] ? h.points : 0), 0);
  const maxPoints = HABITS.reduce((sum, h) => sum + h.points, 0);

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-white">Daily Habits</h1>
          <Link href="/checkin" className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 hover:bg-amber-500/20 transition-colors">
            <Sun size={12} />
            Morning Check-in
          </Link>
        </div>
        <p className="text-gray-400 text-sm mb-4">Check off what you've done today</p>

        {/* Streak showcase */}
        {streaks && (
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[
              { label: 'Gym', key: 'gym', emoji: '💪' },
              { label: 'Sleep', key: 'sleep', emoji: '😴' },
              { label: 'Study', key: 'study', emoji: '📚' },
              { label: 'English', key: 'english', emoji: '🗣️' },
              { label: 'Kannada', key: 'kannada', emoji: '🇮🇳' },
            ].map((s) => (
              <div key={s.key} className={`text-center py-2 px-1 rounded-xl ${(streaks[s.key] || 0) >= 3 ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-white/5 border border-white/5'}`}>
                <p className="text-base">{s.emoji}</p>
                <p className={`text-lg font-bold ${(streaks[s.key] || 0) >= 3 ? 'text-orange-400' : 'text-gray-400'}`}>
                  {streaks[s.key] || 0}
                </p>
                <p className="text-[9px] text-gray-600">{s.label}</p>
              </div>
            ))}
          </div>
        )}
        {streaks?.overall >= 7 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" />
            <span className="text-sm text-amber-300 font-medium">{streaks.overall}-day momentum streak — don't break it today!</span>
          </div>
        )}

        {/* Today's score preview */}
        <div className="lifeos-card-glow mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Today's Points</p>
            <p className="text-3xl font-bold text-white mt-1">{todayPoints}<span className="text-sm text-gray-500">/{maxPoints}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <Flame size={24} className={todayPoints > 50 ? 'text-orange-400' : 'text-gray-600'} />
            {scores?.streaks?.gym > 0 && (
              <span className="text-xs text-orange-400">{scores.streaks.gym}d gym streak</span>
            )}
          </div>
        </div>

        {/* Habit checklist */}
        <div className="space-y-3 mb-6">
          {HABITS.map((habit, i) => (
            <motion.button
              key={habit.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setChecked((p) => ({ ...p, [habit.key]: !p[habit.key] }))}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                ${checked[habit.key]
                  ? 'bg-indigo-600/10 border-indigo-600/40'
                  : 'bg-[#12121e] border-[#2a2a4a] hover:border-[#3a3a5a]'}`}
            >
              {checked[habit.key]
                ? <CheckCircle2 size={22} className="text-indigo-400 flex-shrink-0" />
                : <Circle size={22} className="text-gray-600 flex-shrink-0" />}
              <span className="text-xl">{habit.emoji}</span>
              <div className="flex-1">
                <p className={`font-medium ${checked[habit.key] ? 'text-indigo-300' : 'text-gray-300'}`}>
                  {habit.label}
                </p>
                <p className="text-xs text-gray-500">+{habit.points} points</p>
              </div>
              {scores?.streaks?.[habit.key] > 0 && (
                <span className="text-xs text-orange-400 flex items-center gap-1">
                  <Flame size={12} /> {scores.streaks[habit.key]}d
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Water intake */}
        <div className="lifeos-card mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplets size={16} className="text-cyan-400" />
              <span className="text-sm font-medium text-gray-300">Water Intake</span>
            </div>
            <span className={`text-sm font-bold ${water >= 2.5 ? 'text-cyan-400' : 'text-gray-400'}`}>
              {water}L / 3L
            </span>
          </div>
          <div className="flex gap-2">
            {[0.5, 1, 1.5, 2, 2.5, 3].map((l) => (
              <button
                key={l}
                onClick={() => setWater(l)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                  ${water >= l ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' : 'bg-[#1a1a2e] border border-[#2a2a4a] text-gray-500'}`}
              >
                {l}L
              </button>
            ))}
          </div>
        </div>

        {/* Weekly completion */}
        {scores?.weeklyCompletion && (
          <div className="lifeos-card mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">This Week</p>
            <div className="space-y-2">
              {Object.entries(scores.weeklyCompletion).map(([key, pct]: [string, any]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 capitalize">{key}</span>
                  <div className="flex-1 h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 80 ? '#10b981' : pct >= 50 ? '#6366f1' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={saveCheckin}
          disabled={saving}
          className={`lifeos-btn w-full py-3 text-base font-semibold ${saved ? 'bg-emerald-600' : ''}`}
        >
          {saved ? '✅ Saved!' : saving ? 'Saving...' : 'Save Today\'s Check-in'}
        </button>
      </main>
    </div>
  );
}
