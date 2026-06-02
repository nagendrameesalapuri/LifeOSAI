'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { Ruler, TrendingUp, Activity } from 'lucide-react';

type WeightTab = 'weight' | 'measurements';

export default function WeightPage() {
  const api = useApi();
  const [tab, setTab] = useState<WeightTab>('weight');

  // Weight tracking
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Body measurements
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [measureForm, setMeasureForm] = useState({
    chestCm: '', waistCm: '', hipCm: '', leftArmCm: '',
    rightArmCm: '', leftLegCm: '', rightLegCm: '', bodyFatPct: '',
  });
  const [measureSaving, setMeasureSaving] = useState(false);
  const [measureSaved, setMeasureSaved] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [h, s, m] = await Promise.all([
      api.getWeightHistory().catch(() => []),
      api.getFitnessStats().catch(() => null),
      api.getMeasurements().catch(() => []),
    ]);
    setHistory(h);
    setStats(s);
    setMeasurements(m);
  }

  async function logWeight() {
    if (!weight) return;
    setSaving(true);
    try {
      await api.logWeight({ weightKg: parseFloat(weight), note });
      await loadAll();
      setSaved(true);
      setWeight('');
      setNote('');
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function logMeasurement() {
    setMeasureSaving(true);
    try {
      const data: any = {};
      Object.entries(measureForm).forEach(([k, v]) => {
        if (v) data[k] = parseFloat(v);
      });
      await api.logMeasurement(data);
      await loadAll();
      setMeasureForm({
        chestCm: '', waistCm: '', hipCm: '', leftArmCm: '',
        rightArmCm: '', leftLegCm: '', rightLegCm: '', bodyFatPct: '',
      });
      setMeasureSaved(true);
      setTimeout(() => setMeasureSaved(false), 2000);
    } catch {} finally { setMeasureSaving(false); }
  }

  const chartData = history.map((l: any) => ({
    date: format(new Date(l.loggedAt), 'MMM d'),
    actual: l.weightKg,
    avg7: l.movingAvg7,
  }));

  const current = history[0]?.weightKg || 62;
  const movingAvg = stats?.movingAvg7 || current;
  const startWeight = 62;
  const targetWeight = stats?.targetWeight || 70;
  const progressPct = Math.max(0, Math.min(100, ((current - startWeight) / (targetWeight - startWeight)) * 100));

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-white mb-1">Weight & Body Tracking</h1>
        <p className="text-gray-400 text-sm mb-4">{startWeight}kg → {targetWeight}kg lean muscle — track every metric that matters</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#12121e] p-1 rounded-xl border border-[#2a2a4a] w-fit">
          {[
            { id: 'weight' as WeightTab, label: 'Weight', icon: TrendingUp },
            { id: 'measurements' as WeightTab, label: 'Body Measurements', icon: Ruler },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'weight' && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">Current</p>
                <p className="text-2xl font-bold text-white">{current}kg</p>
              </div>
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">7-Day Avg</p>
                <p className="text-2xl font-bold gradient-text">{movingAvg}kg</p>
                <p className="text-[10px] text-gray-600">trend weight</p>
              </div>
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">To Goal</p>
                <p className="text-2xl font-bold text-emerald-400">{(targetWeight - current).toFixed(1)}kg</p>
              </div>
              {stats?.ffmi && (
                <div className="lifeos-card">
                  <p className="text-xs text-gray-500 mb-1">FFMI</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.ffmi}</p>
                  <p className="text-[10px] text-gray-600">{stats.ffmi < 20 ? 'Building' : stats.ffmi < 22 ? 'Good' : 'Excellent'}</p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="lifeos-card">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Start: {startWeight}kg</span>
                <span className="gradient-text font-bold">{current}kg now</span>
                <span className="text-gray-400">Goal: {targetWeight}kg</span>
              </div>
              <div className="h-3 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
                  style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">{progressPct.toFixed(0)}% to goal</p>
            </div>

            {/* Moving average explanation */}
            <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-xl p-3">
              <p className="text-xs text-indigo-300">
                <strong>Why 7-day average?</strong> Daily weight fluctuates 1-2kg from food, water, and sleep.
                The 7-day moving average shows your true fat/muscle trend, not daily noise.
                Use the average to make decisions, not today's single number.
              </p>
            </div>

            {/* Log form */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-3">Log Weight</p>
              <p className="text-xs text-gray-600 mb-3">Log first thing in the morning, after bathroom, before eating</p>
              <div className="flex gap-3">
                <input type="number" step="0.1" className="lifeos-input w-32" placeholder="63.5"
                  value={weight} onChange={(e) => setWeight(e.target.value)} />
                <input className="lifeos-input flex-1" placeholder="Note (optional, e.g. 'after cheat day')"
                  value={note} onChange={(e) => setNote(e.target.value)} />
                <button onClick={logWeight} disabled={saving || !weight}
                  className={`lifeos-btn px-6 ${saved ? 'bg-emerald-600' : ''}`}>
                  {saved ? '✅' : saving ? '...' : 'Log'}
                </button>
              </div>
            </div>

            {/* Deload recommendation */}
            {stats?.deloadRecommended && (
              <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-3">
                <p className="text-sm font-semibold text-amber-400">🔄 Deload Week Recommended</p>
                <p className="text-xs text-gray-400 mt-1">You've trained consistently for 4-6 weeks. Reduce volume by 40% this week — lighter weights, same exercises. This prevents overtraining and leads to bigger gains next cycle.</p>
              </div>
            )}

            {/* Chart */}
            {chartData.length > 1 && (
              <div className="lifeos-card">
                <p className="text-sm font-semibold text-gray-300 mb-4">Weight Trend</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#12121e', border: '1px solid #2a2a4a', borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 3, fill: '#6366f1' }} name="Daily" />
                    <Line type="monotone" dataKey="avg7" stroke="#06b6d4" strokeWidth={2.5} dot={false} name="7-day avg" strokeDasharray="0" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* History table */}
            {history.length > 0 && (
              <div className="lifeos-card">
                <p className="text-sm font-semibold text-gray-300 mb-3">Recent Logs</p>
                <div className="space-y-1">
                  {history.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-[#1e1e36] last:border-0">
                      <span className="text-xs text-gray-500">
                        {format(new Date(log.loggedAt), 'EEE, MMM d')}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-white">{log.weightKg}kg</span>
                        {log.movingAvg7 && log.movingAvg7 !== log.weightKg && (
                          <span className="text-xs text-cyan-400">avg: {log.movingAvg7}kg</span>
                        )}
                        {log.note && <span className="text-xs text-gray-600 truncate max-w-[120px]">{log.note}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'measurements' && (
          <div className="space-y-6">
            {/* FFMI explanation */}
            <div className="lifeos-card">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-amber-400" />
                <p className="text-sm font-semibold text-gray-300">FFMI — Fat-Free Mass Index</p>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                FFMI is a better measure of muscle development than BMI.
                Enter your body fat % below and I'll calculate your FFMI automatically.
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { range: '<18', label: 'Below average' },
                  { range: '18-20', label: 'Average' },
                  { range: '20-22', label: 'Good (gym visible)' },
                  { range: '22-24', label: 'Excellent' },
                  { range: '24-26', label: 'Superior' },
                  { range: '>26', label: 'Elite / genetic' },
                ].map(({ range, label }) => (
                  <div key={range} className="bg-[#0d0d1a] rounded-lg p-2">
                    <p className="text-xs font-bold text-white">{range}</p>
                    <p className="text-[10px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Log measurements */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-4">Log Body Measurements</p>
              <p className="text-xs text-gray-500 mb-4">Track monthly — more meaningful than weekly weight fluctuations</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'chestCm', label: 'Chest (cm)' },
                  { key: 'waistCm', label: 'Waist (cm)' },
                  { key: 'leftArmCm', label: 'Left Arm (cm)' },
                  { key: 'rightArmCm', label: 'Right Arm (cm)' },
                  { key: 'leftLegCm', label: 'Left Thigh (cm)' },
                  { key: 'rightLegCm', label: 'Right Thigh (cm)' },
                  { key: 'hipCm', label: 'Hip (cm)' },
                  { key: 'bodyFatPct', label: 'Body Fat %' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <input
                      type="number" step="0.1"
                      className="lifeos-input"
                      placeholder="e.g. 38"
                      value={(measureForm as any)[key]}
                      onChange={(e) => setMeasureForm(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={logMeasurement}
                disabled={measureSaving}
                className={`lifeos-btn w-full mt-4 py-3 ${measureSaved ? 'bg-emerald-600' : ''}`}
              >
                {measureSaved ? '✅ Measurements Saved!' : measureSaving ? 'Saving...' : 'Save Measurements'}
              </button>
            </div>

            {/* Measurement history */}
            {measurements.length > 0 && (
              <div className="lifeos-card">
                <p className="text-sm font-semibold text-gray-300 mb-4">Measurement History</p>
                <div className="space-y-4">
                  {measurements.slice(0, 5).map((m: any) => (
                    <div key={m.id} className="border border-[#1e1e36] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500">{format(new Date(m.loggedAt), 'MMMM d, yyyy')}</p>
                        {m.ffmi && (
                          <span className="text-xs font-bold text-amber-400">FFMI: {m.ffmi}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {m.chestCm && <div><p className="text-[10px] text-gray-600">Chest</p><p className="text-xs text-white">{m.chestCm}cm</p></div>}
                        {m.waistCm && <div><p className="text-[10px] text-gray-600">Waist</p><p className="text-xs text-white">{m.waistCm}cm</p></div>}
                        {m.leftArmCm && <div><p className="text-[10px] text-gray-600">Arm</p><p className="text-xs text-white">{m.leftArmCm}cm</p></div>}
                        {m.bodyFatPct && <div><p className="text-[10px] text-gray-600">Body Fat</p><p className="text-xs text-white">{m.bodyFatPct}%</p></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
