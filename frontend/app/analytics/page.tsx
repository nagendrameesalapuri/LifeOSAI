'use client';
import { useEffect, useState, useMemo } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, subDays } from 'date-fns';

type TimeRange = '7D' | '30D' | '3M' | 'All';

const TIME_RANGES: { label: TimeRange; days: number | null }[] = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '3M', days: 90 },
  { label: 'All', days: null },
];

function filterByDays<T extends { date?: string; loggedAt?: string }>(items: T[], days: number | null): T[] {
  if (!days) return items;
  const cutoff = subDays(new Date(), days);
  return items.filter((item) => {
    const d = new Date(item.loggedAt || item.date || 0);
    return d >= cutoff;
  });
}

export default function AnalyticsPage() {
  const api = useApi();
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');

  useEffect(() => {
    const hit = cache.get('analytics_trends');
    if (hit) { setTrends(hit); setLoading(false); }
    api.getTrends().then((data) => {
      setTrends(data);
      setError(false);
      cache.set('analytics_trends', data, 5 * 60 * 1000);
    }).catch(() => setError(!hit)).finally(() => setLoading(false));
  }, []);

  const activeDays = TIME_RANGES.find((t) => t.label === timeRange)?.days ?? null;

  const weightData = useMemo(() => filterByDays(trends?.weightLogs || [], activeDays).map((l: any) => ({
    date: format(new Date(l.loggedAt), 'MMM d'),
    weight: l.weightKg,
    avg: l.movingAvg7,
  })), [trends, activeDays]);

  const sleepData = useMemo(() => filterByDays(trends?.sleepLogs || [], activeDays).map((l: any) => ({
    date: format(new Date(l.loggedAt), 'MMM d'),
    hours: Math.round(l.durationHours * 10) / 10,
  })), [trends, activeDays]);

  const habitData = useMemo(() => filterByDays(trends?.habitLogs || [], activeDays).map((l: any) => {
    const done = [l.gym, l.sleep, l.study, l.english, l.kannada].filter(Boolean).length;
    return {
      date: format(new Date(l.date), 'MMM d'),
      score: Math.round((done / 5) * 100),
    };
  }), [trends, activeDays]);

  const studyData = useMemo(() => filterByDays(trends?.studyLogs || [], activeDays).map((l: any) => ({
    date: format(new Date(l.loggedAt), 'MMM d'),
    mins: l.durationMin,
    topic: l.topic,
  })), [trends, activeDays]);

  const lifeScoreData = useMemo(() => filterByDays(trends?.lifeScores || [], activeDays).map((s: any) => ({
    date: format(new Date(s.date), 'MMM d'),
    overall: s.overall,
    fitness: s.fitness,
    sleep: s.sleep,
    discipline: s.discipline,
    career: s.career,
  })), [trends, activeDays]);

  const dietData = useMemo(() => filterByDays(trends?.dietLogs || [], activeDays).map((d: any) => ({
    date: format(new Date(d.loggedAt), 'MMM d'),
    protein: Math.round(d.totalProteinG),
    calories: d.totalCalories,
  })), [trends, activeDays]);

  const tooltipStyle = {
    backgroundColor: '#12121e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '12px',
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="md:ml-56 flex-1 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Your transformation data visualized</p>
          </div>
          {/* Time range tabs */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {TIME_RANGES.map((t) => (
              <button
                key={t.label}
                onClick={() => setTimeRange(t.label)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeRange === t.label
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => <div key={i} className="h-64 skeleton rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="lifeos-card text-center py-12">
            <p className="text-gray-400 mb-3">Could not load analytics data.</p>
            <button onClick={() => { setError(false); setLoading(true); api.getTrends().then(d => { setTrends(d); cache.set('analytics_trends', d, 5*60*1000); }).catch(() => setError(true)).finally(() => setLoading(false)); }} className="text-indigo-400 hover:text-indigo-300 text-sm underline">Retry</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Weight Trend */}
            <div className="lifeos-card col-span-2">
              <p className="text-sm font-semibold text-gray-300 mb-4">
                Weight Progress · <span className="text-indigo-400">{timeRange}</span>
              </p>
              {weightData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2}
                      dot={{ fill: '#6366f1', r: 3 }} name="Weight (kg)" />
                    {weightData.some((d: any) => d.avg) && (
                      <Line type="monotone" dataKey="avg" stroke="#22d3ee" strokeWidth={1.5}
                        dot={false} strokeDasharray="4 2" name="7-day avg" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Log your weight to see progress" />}
            </div>

            {/* Sleep Trend */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-4">
                Sleep Duration · <span className="text-cyan-400">{timeRange}</span>
              </p>
              {sleepData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sleepData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 10]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="hours" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Log sleep to see trends" />}
            </div>

            {/* Habit Score */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-4">
                Daily Habit Score · <span className="text-emerald-400">{timeRange}</span>
              </p>
              {habitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={habitData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} name="Score" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Complete daily check-ins to see score trend" />}
            </div>

            {/* Protein / Calories Trend */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-4">
                Nutrition · <span className="text-orange-400">{timeRange}</span>
              </p>
              {dietData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dietData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                    <Bar yAxisId="left" dataKey="protein" fill="#f97316" radius={[2, 2, 0, 0]} name="Protein (g)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Log meals to see nutrition trends" />}
            </div>

            {/* Study Sessions */}
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-4">
                Study Sessions · <span className="text-violet-400">{timeRange}</span>
              </p>
              {studyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={studyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="mins" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Minutes" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Log study sessions to see progress" />}
            </div>

            {/* Life Score */}
            <div className="lifeos-card col-span-2">
              <p className="text-sm font-semibold text-gray-300 mb-4">
                Life Score Breakdown · <span className="text-indigo-400">{timeRange}</span>
              </p>
              {lifeScoreData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={lifeScoreData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e36" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                    <Line type="monotone" dataKey="overall" stroke="#6366f1" strokeWidth={2} dot={false} name="Overall" />
                    <Line type="monotone" dataKey="fitness" stroke="#f97316" strokeWidth={1.5} dot={false} name="Fitness" />
                    <Line type="monotone" dataKey="sleep" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Sleep" />
                    <Line type="monotone" dataKey="discipline" stroke="#10b981" strokeWidth={1.5} dot={false} name="Discipline" />
                    <Line type="monotone" dataKey="career" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Career" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Visit dashboard daily to build life score history" />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="h-40 flex items-center justify-center">
      <p className="text-sm text-gray-600 italic">{msg}</p>
    </div>
  );
}
