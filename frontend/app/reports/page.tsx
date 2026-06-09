'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { FileText, RefreshCw, TrendingUp, TrendingDown, Minus, Brain } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportsPage() {
  const api = useApi();
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [proactiveInsights, setProactiveInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    api.getReports().then(setReports).catch(() => {});
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const r = await api.generateWeeklyReport();
      const all = await api.getReports();
      setReports(all);
      if (all.length > 0) setSelected(all[0]);
    } catch {} finally { setGenerating(false); }
  }

  async function loadProactiveInsights() {
    setLoadingInsights(true);
    try {
      const data = await api.getProactiveInsights();
      setProactiveInsights(data);
    } catch {} finally { setLoadingInsights(false); }
  }

  function TrendIcon({ value }: { value: number }) {
    if (value > 0) return <TrendingUp size={12} className="text-emerald-400" />;
    if (value < 0) return <TrendingDown size={12} className="text-red-400" />;
    return <Minus size={12} className="text-gray-500" />;
  }

  const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="md:ml-56 flex-1 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Reports & Insights</h1>
            <p className="text-gray-400 text-sm">Weekly analysis + AI-detected patterns</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadProactiveInsights}
              disabled={loadingInsights}
              className="lifeos-btn-ghost flex items-center gap-2 text-sm"
            >
              <Brain size={14} className={loadingInsights ? 'animate-pulse' : ''} />
              {loadingInsights ? 'Analyzing...' : 'Pattern Analysis'}
            </button>
            <button onClick={generate} disabled={generating} className="lifeos-btn flex items-center gap-2">
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Proactive Insights Panel */}
        {proactiveInsights && (
          <div className="lifeos-card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain size={16} className="text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-300">AI Pattern Analysis</h3>
              {proactiveInsights.topPriority && (
                <span className="ml-auto text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  Top priority: {proactiveInsights.topPriority}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {proactiveInsights.insights?.slice(0, 4).map((insight: any, i: number) => (
                <div key={i} className="bg-[#0d0d1a] rounded-xl p-3 border border-[#1e1e36]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: (PRIORITY_COLORS as any)[insight.priority] || '#6366f1' }} />
                    <span className="text-xs font-medium uppercase text-gray-500">{insight.category}</span>
                  </div>
                  <p className="text-xs text-gray-300 mb-2">{insight.message}</p>
                  {insight.action && (
                    <p className="text-xs text-indigo-400">→ {insight.action}</p>
                  )}
                </div>
              ))}
            </div>
            {proactiveInsights.weekPattern && (
              <p className="text-xs text-gray-500 mt-3 italic">{proactiveInsights.weekPattern}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Reports list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Past Reports</p>
              <span className="text-xs text-gray-600">{reports.length} total</span>
            </div>

            {reports.length === 0 ? (
              <div className="lifeos-card text-center py-8">
                <FileText size={32} className="text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No reports yet</p>
                <p className="text-xs text-gray-600 mt-1">Generate your first report above</p>
              </div>
            ) : (
              reports.map((r) => {
                const rep = r.report as any;
                return (
                  <button key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left lifeos-card hover:border-indigo-500/30 transition-all ${
                      selected?.id === r.id ? 'border-indigo-600/50 bg-indigo-600/5' : ''
                    }`}>
                    <p className="text-sm font-medium text-gray-200">
                      Week of {format(new Date(r.weekStart), 'MMM d')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(r.createdAt), 'MMM d, yyyy')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rep?.fitness?.workoutsCompleted !== undefined && (
                        <span className="text-xs text-gray-600">💪 {rep.fitness.workoutsCompleted}</span>
                      )}
                      {rep?.career?.studySessions !== undefined && (
                        <span className="text-xs text-gray-600">📚 {rep.career.studySessions}</span>
                      )}
                      {rep?.sleep?.avgDuration > 0 && (
                        <span className="text-xs text-gray-600">😴 {rep.sleep.avgDuration}h</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Report detail */}
          <div className="col-span-2">
            {selected ? (
              <div className="space-y-4">
                <div className="lifeos-card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Week of {format(new Date(selected.weekStart), 'MMMM d')}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {format(new Date(selected.weekStart), 'MMM d')} – {format(new Date(selected.weekEnd), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Workouts', val: (selected.report as any)?.fitness?.workoutsCompleted || 0, emoji: '💪', vs: (selected.report as any)?.fitness?.prevWeekWorkouts },
                      { label: 'Study sessions', val: (selected.report as any)?.career?.studySessions || 0, emoji: '📚', vs: (selected.report as any)?.career?.prevWeekSessions },
                      { label: 'Avg sleep', val: `${(selected.report as any)?.sleep?.avgDuration || 0}h`, emoji: '😴', vs: null },
                      { label: 'Gym days', val: (selected.report as any)?.habits?.gymDays || 0, emoji: '🏋️', vs: null },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#0a0a0f] border border-[#1e1e36] rounded-lg p-3 text-center">
                        <p className="text-xl mb-1">{s.emoji}</p>
                        <div className="flex items-center justify-center gap-1">
                          <p className="text-lg font-bold text-white">{s.val}</p>
                          {s.vs !== undefined && s.vs !== null && (
                            <TrendIcon value={typeof s.val === 'number' ? (s.val as number) - s.vs : 0} />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                <div className="lifeos-card">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Complete AI Analysis</p>
                  <div className="bg-[#0a0a0f] border border-[#1e1e36] rounded-xl p-4 max-h-[500px] overflow-y-auto">
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.aiInsights}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lifeos-card h-64 flex flex-col items-center justify-center gap-3">
                <FileText size={32} className="text-gray-600" />
                <p className="text-sm text-gray-600 italic">Select a report or generate a new one</p>
                <button onClick={generate} disabled={generating} className="lifeos-btn text-sm">
                  {generating ? 'Generating...' : 'Generate This Week\'s Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
