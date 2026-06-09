'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { Moon, Sun } from 'lucide-react';

export default function SleepPage() {
  const api = useApi();
  const [form, setForm] = useState({ bedtime: '23:00', wakeupTime: '07:00', qualityScore: 7, notes: '' });
  const [score, setScore] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const hit = cache.get('sleep_score');
    if (hit) setScore(hit);
    api.getSleepScore().then((data) => {
      setScore(data);
      cache.set('sleep_score', data, 5 * 60 * 1000);
    }).catch(() => {});
  }, []);

  async function logSleep() {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Wakeup is next day when bedtime hour > wakeup hour (cross-midnight)
      const [bH] = form.bedtime.split(':').map(Number);
      const [wH] = form.wakeupTime.split(':').map(Number);
      const wakeDate = bH > wH
        ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
        : today;
      cache.delete('sleep_score');
      cache.delete('dashboard_data');
      cache.delete('analytics_trends');
      await api.logSleep({
        bedtime: `${today}T${form.bedtime}:00`,
        wakeupTime: `${wakeDate}T${form.wakeupTime}:00`,
        qualityScore: form.qualityScore,
        notes: form.notes,
      });
      setSaved(true);
      const newScore = await api.getSleepScore();
      setScore(newScore);
      if (newScore) cache.set('sleep_score', newScore, 5 * 60 * 1000);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  const [bH, bM] = form.bedtime.split(':').map(Number);
  const [wH, wM] = form.wakeupTime.split(':').map(Number);
  let duration = ((wH * 60 + wM) - (bH * 60 + bM)) / 60;
  if (duration < 0) duration += 24;
  const durationDisplay = duration.toFixed(1);

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="md:ml-56 flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-lg">
        <h1 className="text-2xl font-bold text-white mb-1">Sleep Tracker</h1>
        <p className="text-gray-400 text-sm mb-6">Track your sleep for better recovery and discipline score</p>

        {/* Current scores */}
        {score && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Sleep Score', value: score.sleepScore, unit: '' },
              { label: 'Avg Duration', value: score.avgDuration, unit: 'hrs' },
              { label: 'Recovery', value: score.recoveryScore, unit: '' },
            ].map((s) => (
              <div key={s.label} className="lifeos-card text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{s.value}<span className="text-xs text-gray-500">{s.unit}</span></p>
              </div>
            ))}
          </div>
        )}

        <div className="lifeos-card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5 flex items-center gap-1">
                <Moon size={12} /> Bedtime
              </label>
              <input type="time" className="lifeos-input"
                value={form.bedtime} onChange={(e) => setForm((p) => ({ ...p, bedtime: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5 flex items-center gap-1">
                <Sun size={12} /> Wake up
              </label>
              <input type="time" className="lifeos-input"
                value={form.wakeupTime} onChange={(e) => setForm((p) => ({ ...p, wakeupTime: e.target.value }))} />
            </div>
          </div>

          <div className="bg-[#0a0a0f] border border-[#1e1e36] rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Duration</p>
            <p className={`text-2xl font-bold mt-1 ${parseFloat(durationDisplay) >= 7 ? 'text-emerald-400' : parseFloat(durationDisplay) >= 6 ? 'text-yellow-400' : 'text-red-400'}`}>
              {durationDisplay} hrs
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {parseFloat(durationDisplay) >= 7.5 ? '✅ Optimal' : parseFloat(durationDisplay) >= 7 ? '👍 Good' : '⚠️ Too short'}
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Sleep Quality: {form.qualityScore}/10</label>
            <input type="range" min="1" max="10" className="w-full accent-indigo-500"
              value={form.qualityScore} onChange={(e) => setForm((p) => ({ ...p, qualityScore: parseInt(e.target.value) }))} />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Poor</span><span>Excellent</span>
            </div>
          </div>

          <input className="lifeos-input" placeholder="Notes (optional)"
            value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

          <button onClick={logSleep} disabled={saving}
            className={`lifeos-btn w-full py-3 ${saved ? 'bg-emerald-600' : ''}`}>
            {saved ? '✅ Sleep Logged!' : saving ? 'Saving...' : 'Log Sleep'}
          </button>
        </div>
      </main>
    </div>
  );
}
