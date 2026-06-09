'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  TrendingUp, Zap, RefreshCw, ChevronDown, ChevronUp,
  Target, ArrowRight, Flame, Droplets, Dumbbell, Apple,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
function getDateLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}
function pct(val: number, max: number) {
  return Math.min(100, max > 0 ? Math.round((val / max) * 100) : 0);
}

/* ── Calorie donut ─────────────────────────────────────────────────── */
function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(1, eaten / Math.max(target, 1));
  const remaining = Math.max(0, target - eaten);
  const over = eaten > target;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
          {/* track */}
          <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          {/* fill */}
          <circle
            cx="72" cy="72" r={r} fill="none"
            stroke={over ? '#f87171' : 'url(#calGrad)'}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          <defs>
            <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        {/* center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white leading-none">{remaining > 0 ? remaining : 0}</span>
          <span className="text-[10px] text-gray-400 mt-0.5">kcal left</span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs">
        <div className="text-center">
          <p className="text-gray-400">Eaten</p>
          <p className="font-bold text-white">{eaten}</p>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="text-center">
          <p className="text-gray-400">Target</p>
          <p className="font-bold text-white">{target}</p>
        </div>
        {over && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <p className="text-red-400 text-[10px]">Over by</p>
              <p className="font-bold text-red-400">{eaten - target}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Macro bar ─────────────────────────────────────────────────────── */
function MacroBar({
  label, icon, eaten, target, color, unit = 'g',
}: {
  label: string; icon: React.ReactNode; eaten: number; target: number; color: string; unit?: string;
}) {
  const p = pct(eaten, target);
  return (
    <div className="macro-bar">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium text-gray-300">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-white">{Math.round(eaten)}</span>
          <span className="text-xs text-gray-500">/{target}{unit}</span>
        </div>
      </div>
      <div className="progress-track">
        <motion.div
          className="progress-fill"
          style={{ backgroundColor: color, width: `${p}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">{p}%</span>
        <span className="text-[10px]" style={{ color }}>
          {target - eaten > 0 ? `${Math.round(target - eaten)}${unit} left` : '✓ Done'}
        </span>
      </div>
    </div>
  );
}

/* ── Water tracker ──────────────────────────────────────────────────── */
function WaterTracker({ litres, target = 4 }: { litres: number; target?: number }) {
  const p = pct(litres, target);
  const drops = 8;
  const filled = Math.round((litres / target) * drops);
  return (
    <div className="macro-bar">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Droplets size={13} className="text-blue-400" />
          <span className="text-xs font-medium text-gray-300">Water</span>
        </div>
        <span className="text-sm font-bold text-white">{litres.toFixed(1)}<span className="text-xs text-gray-500">/{target}L</span></span>
      </div>
      <div className="flex gap-1 mb-1">
        {Array.from({ length: drops }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2 rounded-full transition-all duration-500"
            style={{ backgroundColor: i < filled ? '#3b82f6' : 'rgba(255,255,255,0.06)' }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-gray-600">{p}%</span>
        <span className="text-[10px] text-blue-400">
          {target - litres > 0 ? `${(target - litres).toFixed(1)}L left` : '✓ Hydrated'}
        </span>
      </div>
    </div>
  );
}

/* ── Score card ─────────────────────────────────────────────────────── */
const ALL_SCORE_CARDS = [
  { key: 'fitness',    label: 'Fitness',    icon: '💪', sub: 'Gym + nutrition',    color: '#f97316', always: true },
  { key: 'sleep',      label: 'Sleep',      icon: '😴', sub: 'Duration + quality',  color: '#8b5cf6', always: true },
  { key: 'discipline', label: 'Discipline', icon: '🎯', sub: 'Habit consistency',   color: '#06b6d4', always: true },
  { key: 'career',     label: 'Career',     icon: '🚀', sub: 'Study progress',      color: '#10b981', always: true },
  { key: 'english',    label: 'English',    icon: '🗣️', sub: 'Grammar + fluency',   color: '#f59e0b', always: false },
  { key: 'kannada',    label: 'Kannada',    icon: '🇮🇳', sub: 'Vocabulary growth',   color: '#ec4899', always: false },
];

/* ══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const api = useApi();
  const [dashboard, setDashboard] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [insights, setInsights] = useState<string>('');
  const [plan, setPlan] = useState<string>('');
  const [nutrition, setNutrition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [expandedScore, setExpandedScore] = useState<string | null>(null);
  const [correlations, setCorrelations] = useState<any>(null);
  const [checkinDone, setCheckinDone] = useState(false);
  const [adaptedPlan, setAdaptedPlan] = useState<{ plan: string; weakAreas: string[]; thisOverall: number; lastOverall: number; seen: boolean } | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const DASHBOARD_TTL = 5 * 60 * 1000; // 5 min

    setLoading(true);
    try {
      const cachedDash = cache.get('dashboard_data');
      const cachedDiet = cache.get('dashboard_diet');

      const [dash, diet] = cachedDash && cachedDiet
        ? [cachedDash, cachedDiet]
        : await Promise.all([
            api.getDashboard().catch(() => null),
            api.getTodayDiet().catch(() => null),
          ]);

      if (!cachedDash && dash) cache.set('dashboard_data', dash, DASHBOARD_TTL);
      if (!cachedDiet && diet) cache.set('dashboard_diet', diet, DASHBOARD_TTL);

      setDashboard(dash);
      setNutrition(diet);
    } catch (e) {
      console.error(e);
    }

    // Non-blocking: insights / breakdown / correlations (also cached)
    const cachedInsights = cache.get('dashboard_insights');
    if (cachedInsights) {
      setInsights(cachedInsights);
    } else {
      api.getInsights().then((ins) => {
        const text = ins?.insights || ins || '';
        setInsights(text);
        if (text) cache.set('dashboard_insights', text, DASHBOARD_TTL);
      }).catch(() => {});
    }

    const cachedBreakdown = cache.get('dashboard_breakdown');
    if (cachedBreakdown) {
      setBreakdown(cachedBreakdown);
    } else {
      api.getScoreBreakdown().then((bd) => {
        setBreakdown(bd);
        if (bd) cache.set('dashboard_breakdown', bd, DASHBOARD_TTL);
      }).catch(() => {});
    }

    const cachedCorr = cache.get('dashboard_correlations');
    if (cachedCorr) {
      setCorrelations(cachedCorr);
    } else {
      api.getCorrelationInsights().then((c) => {
        setCorrelations(c);
        if (c) cache.set('dashboard_correlations', c, DASHBOARD_TTL);
      }).catch(() => {});
    }

    api.getMorningCheckin().then((d) => setCheckinDone(!!d?.todayCheckin)).catch(() => {});

    // Auto-load today's plan (default TTL = midnight)
    const cachedPlan = cache.get('dashboard_plan');
    if (cachedPlan) {
      setPlan(cachedPlan);
    } else {
      setPlanLoading(true);
      api.getDailyPlan().then((data) => {
        const text = data?.plan || '';
        setPlan(text);
        if (text) cache.set('dashboard_plan', text);
      }).catch(() => {}).finally(() => setPlanLoading(false));
    }

    // Check weekly progress — generates an adapted plan if scores haven't improved
    api.checkWeeklyProgress().then((result: any) => {
      if (result?.status === 'stagnant' && result?.adaptedPlan && !result?.seen) {
        setAdaptedPlan({
          plan: result.adaptedPlan,
          weakAreas: result.weakAreas || [],
          thisOverall: result.thisOverall,
          lastOverall: result.lastOverall,
          seen: false,
        });
      }
    }).catch(() => {});

    setLoading(false);
  }

  async function loadDailyPlan() {
    setPlanLoading(true);
    try {
      const data = await api.getDailyPlan();
      const text = data?.plan || '';
      setPlan(text);
      if (text) cache.set('dashboard_plan', text);
    } catch (e) { console.error(e); }
    finally { setPlanLoading(false); }
  }

  const scores = dashboard?.scores || {};
  const languageGoals: string[] = dashboard?.user?.languageGoals || [];
  const SCORE_CARDS = ALL_SCORE_CARDS.filter(
    (c) => c.always || languageGoals.includes(c.key)
  );

  // Nutrition values
  const log = nutrition?.log;
  const calTarget = nutrition?.targets?.calories || dashboard?.user?.dailyCalorieTarget || 2800;
  const protTarget = nutrition?.targets?.protein  || dashboard?.user?.dailyProteinTarget || 140;
  // Derived: remaining kcal after protein → split 55% carbs / 45% fat
  const remainKcal = Math.max(0, calTarget - protTarget * 4);
  const carbTarget = Math.round((remainKcal * 0.55) / 4);
  const fatTarget  = Math.round((remainKcal * 0.45) / 9);

  const eaten    = log?.totalCalories  || 0;
  const protein  = log?.totalProteinG  || 0;
  const carbs    = log?.totalCarbsG    || 0;
  const fat      = log?.totalFatsG     || 0;
  const water    = log?.waterLitres    || 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="ml-56 flex-1 p-4 md:p-6 space-y-4">

        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Good {getGreeting()}, {dashboard?.user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{getDateLabel()}</p>
          </div>
          <button onClick={() => {
            cache.delete('dashboard_data');
            cache.delete('dashboard_diet');
            cache.delete('dashboard_insights');
            cache.delete('dashboard_breakdown');
            cache.delete('dashboard_correlations');
            loadDashboard();
          }} className="lifeos-btn-ghost flex items-center gap-1.5 text-xs py-2">
            <RefreshCw size={13} />
            Refresh
          </button>
        </motion.div>

        {/* Weight goal progress bar — uses real starting weight from first weight log */}
        {!loading && dashboard?.user?.weightKg && dashboard?.user?.targetWeightKg && (() => {
          const current = dashboard.user.weightKg;
          const target = dashboard.user.targetWeightKg;
          // Use oldest weight log as start; fall back to current weight (0% for new users)
          const start = dashboard.user.startingWeightKg ?? current;
          const totalDiff = Math.abs(target - start);
          const progressMade = Math.abs(current - start);
          // 0% if no progress (new user or start === current), 100% if at/past goal
          const pct = totalDiff === 0 ? 0 : Math.min(100, Math.round((progressMade / totalDiff) * 100));
          const diff = Math.abs(target - current).toFixed(1);
          const isGaining = target > start;
          // For bulking: milestone when current reaches target. For cutting: when current drops to target.
          const milestone = isGaining ? current >= target : current <= target;
          return (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`lifeos-card py-3 px-4 ${milestone ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚖️</span>
                  <span className="text-xs font-medium text-gray-300">Weight Journey</span>
                  {milestone && <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">🎉 Goal Reached!</span>}
                </div>
                <span className="text-xs text-gray-500">
                  {milestone ? `${target}kg achieved!` : `${diff}kg to go`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 w-10 text-right">{start}kg</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${milestone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-600 w-10">{target}kg</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-indigo-400">{current}kg now</span>
                <span className="text-[10px] text-gray-600">{pct}% complete</span>
                <span className="text-[10px] text-gray-500">🎯 {target}kg target</span>
              </div>
            </motion.div>
          );
        })()}

        {/* Morning check-in banner */}
        {!loading && !checkinDone && (
          <motion.a
            href="/checkin"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 hover:bg-amber-500/15 transition-colors"
          >
            <span className="text-xl">🌅</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">Morning Check-in — 60 seconds</p>
              <p className="text-xs text-gray-500">Rate yesterday, set today's intentions, see your streaks</p>
            </div>
            <ArrowRight size={14} className="text-amber-400" />
          </motion.a>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="h-56 skeleton" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton" />)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-28 skeleton" />)}
            </div>
          </div>
        ) : (
          <>
            {/* ── TODAY'S NUTRITION ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="premium-card"
            >
              {/* card header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                    <Flame size={14} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Today's Nutrition</p>
                    <p className="text-[10px] text-gray-500">
                      {log ? 'Last logged meal' : 'Nothing logged yet — start tracking!'}
                    </p>
                  </div>
                </div>
                <a href="/fitness/diet" className="text-[10px] text-indigo-400 font-medium hover:text-indigo-300 transition-colors">
                  Log meal →
                </a>
              </div>

              {/* calorie ring + macros */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* ring */}
                <div className="flex-shrink-0">
                  <CalorieRing eaten={eaten} target={calTarget} />
                </div>

                {/* macros */}
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <MacroBar
                    label="Protein" icon={<Dumbbell size={12} className="text-orange-400" />}
                    eaten={protein} target={protTarget} color="#f97316"
                  />
                  <MacroBar
                    label="Carbs" icon={<Apple size={12} className="text-cyan-400" />}
                    eaten={carbs} target={carbTarget} color="#22d3ee"
                  />
                  <MacroBar
                    label="Fat" icon={<span className="text-amber-400 text-[11px] leading-none">🧈</span>}
                    eaten={fat} target={fatTarget} color="#f59e0b"
                  />
                  <WaterTracker litres={water} target={4} />
                </div>
              </div>

              {/* calorie split pill row */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {[
                  { label: 'Protein kcal', val: Math.round(protein * 4), color: '#f97316' },
                  { label: 'Carb kcal',    val: Math.round(carbs * 4),   color: '#22d3ee' },
                  { label: 'Fat kcal',     val: Math.round(fat * 9),     color: '#f59e0b' },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-1.5 bg-white/[0.04] rounded-full px-3 py-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-[10px] text-gray-400">{m.label}</span>
                    <span className="text-[10px] font-semibold text-white">{m.val}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── LIFE SCORE ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lifeos-card-glow"
            >
              <div className="flex items-center gap-5">
                {/* ring */}
                <div className="relative flex-shrink-0 w-16 h-16">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke="url(#lifeGrad)" strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={2 * Math.PI * 26 * (1 - (scores.overall || 0) / 100)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1.5s ease' }}
                    />
                    <defs>
                      <linearGradient id="lifeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {scores.overall || 0}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold gradient-text leading-tight">Overall Life Score</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {scores.overall >= 80 ? 'Outstanding! Keep it up.' :
                     scores.overall >= 60 ? 'Good progress. Push harder.' :
                     scores.overall >= 40 ? 'Building momentum. Stay consistent.' :
                     scores.overall > 0 ? 'Just getting started. Every habit adds up.' :
                     'Log your first workout, sleep, or study session to see your score.'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-600">
                      ⚖️ {dashboard?.user?.weightKg || '--'}kg → {dashboard?.user?.targetWeightKg || '--'}kg
                    </span>
                    {dashboard?.user?.tdeeKcal && (
                      <span className="text-[10px] text-gray-600">🔥 TDEE {dashboard.user.tdeeKcal} kcal</span>
                    )}
                  </div>
                  {breakdown?.focusArea && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                      <Target size={9} />
                      <span>Focus: <strong>{breakdown.focusArea}</strong> — {breakdown.focusReason}</span>
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-black text-white">{scores.overall || 0}</p>
                  <p className="text-[10px] text-gray-500">/ 100</p>
                </div>
              </div>
            </motion.div>

            {/* ── SCORE GRID ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SCORE_CARDS.map(({ key, label, icon, sub, color }, i) => {
                const bd = breakdown?.breakdown?.[key];
                const isExpanded = expandedScore === key;
                const val = scores[key] || 0;

                const isEmpty = val === 0;
                const emptyCtaMap: Record<string, { text: string; href: string }> = {
                  fitness: { text: 'Log first workout', href: '/fitness/workout' },
                  sleep: { text: 'Log last night\'s sleep', href: '/sleep' },
                  discipline: { text: 'Start habit check-in', href: '/habits' },
                  career: { text: 'Log a study session', href: '/career' },
                  english: { text: 'Correct a sentence', href: '/english' },
                  kannada: { text: 'Take a lesson', href: '/kannada' },
                };
                const cta = emptyCtaMap[key];

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.04 }}
                    className="lifeos-card cursor-pointer hover:border-white/10 transition-all"
                    style={isExpanded ? { borderColor: `${color}40` } : {}}
                    onClick={() => !isEmpty && setExpandedScore(isExpanded ? null : key)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-white leading-tight">{label}</p>
                          <p className="text-[10px] text-gray-600 leading-tight">{sub}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {isEmpty ? (
                          <span className="text-xs text-gray-600">No data</span>
                        ) : (
                          <>
                            <span className="text-xl font-black text-white">{val}</span>
                            {bd && (isExpanded
                              ? <ChevronUp size={11} className="text-gray-500 ml-0.5" />
                              : <ChevronDown size={11} className="text-gray-500 ml-0.5" />)}
                          </>
                        )}
                      </div>
                    </div>

                    {/* bar or empty CTA */}
                    {isEmpty && cta ? (
                      <a
                        href={cta.href}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-center text-xs text-indigo-400 bg-indigo-500/5 border border-indigo-500/20 rounded-lg py-2 hover:bg-indigo-500/10 transition-colors mt-1"
                      >
                        {cta.text} →
                      </a>
                    ) : (
                      <>
                        <div className="progress-track">
                          <motion.div
                            className="progress-fill"
                            style={{ backgroundColor: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${val}%` }}
                            transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
                          />
                        </div>

                        <AnimatePresence>
                          {isExpanded && bd && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 space-y-2 border-t border-white/[0.05] pt-3"
                            >
                              <p className="text-[11px] text-gray-400 leading-relaxed">{bd.whyThisScore}</p>
                              {bd.dataPoints?.map((dp: string, idx: number) => (
                                <p key={idx} className="text-[10px] text-gray-600 flex items-start gap-1">
                                  <span className="text-gray-700 mt-0.5">•</span>{dp}
                                </p>
                              ))}
                              <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-2">
                                <p className="text-[10px] text-emerald-400 font-semibold mb-0.5">+10 points:</p>
                                <p className="text-[10px] text-gray-300">{bd.toRaiseBy10}</p>
                              </div>
                              <p className="text-[10px] text-indigo-400 flex items-center gap-1">
                                <ArrowRight size={9} />
                                <strong>Quick win:</strong>&nbsp;{bd.quickWin}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {!expandedScore && (
              <p className="text-[10px] text-gray-700 text-center">
                Tap any score card to see WHY and HOW to raise it
              </p>
            )}

            {/* ── AI INSIGHTS ──────────────────────────────────── */}
            {insights && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="lifeos-card border-indigo-500/15"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                    <Zap size={12} className="text-indigo-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">AI Insights</p>
                </div>
                <div className="plan-markdown">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => <h2 className="text-xs font-bold text-indigo-300 mt-3 mb-1 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-semibold text-gray-300 mt-2 mb-0.5">{children}</h3>,
                      p: ({ children }) => <p className="text-xs text-gray-400 leading-relaxed mb-1.5">{children}</p>,
                      strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                      ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
                      li: ({ children }) => <li className="text-xs text-gray-400 flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5 shrink-0">▸</span><span>{children}</span></li>,
                      hr: () => <hr className="border-white/8 my-2" />,
                    }}
                  >{insights}</ReactMarkdown>
                </div>
              </motion.div>
            )}

            {/* ── CORRELATION INSIGHTS ─────────────────────────── */}
            {correlations?.insights?.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="lifeos-card border-cyan-500/15"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                    <TrendingUp size={12} className="text-cyan-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Pattern Insights</p>
                </div>
                <div className="space-y-2">
                  {correlations.insights.map((insight: any, i: number) => (
                    <div key={i} className={`rounded-xl p-3 ${
                      insight.impact === 'high' ? 'bg-orange-500/5 border border-orange-500/15' :
                      insight.impact === 'medium' ? 'bg-amber-500/5 border border-amber-500/15' :
                      'bg-emerald-500/5 border border-emerald-500/15'
                    }`}>
                      <p className="text-xs font-semibold text-white mb-1">{insight.title}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{insight.message}</p>
                      <p className="text-[10px] text-indigo-400 mt-1">→ {insight.recommendation}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── ADAPTED PLAN BANNER (shown when weekly progress is stagnant) ── */}
            {adaptedPlan && !adaptedPlan.seen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="lifeos-card border-amber-500/30 bg-amber-500/5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-base">
                      🔄
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-300">Your Plan Has Been Updated</p>
                      <p className="text-[10px] text-gray-500">
                        Score: {adaptedPlan.lastOverall}→{adaptedPlan.thisOverall} this week
                        {adaptedPlan.weakAreas.length > 0 && ` · Weak: ${adaptedPlan.weakAreas.join(', ')}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setAdaptedPlan((prev) => prev ? { ...prev, seen: true } : null);
                      try { await api.dismissPlanUpdate(); } catch {}
                    }}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-white/5"
                  >
                    Got it ✓
                  </button>
                </div>
                <div className="plan-markdown">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => <h2 className="text-xs font-bold text-amber-300 mt-3 mb-1 first:mt-0">{children}</h2>,
                      p: ({ children }) => <p className="text-xs text-gray-300 leading-relaxed mb-1.5">{children}</p>,
                      strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                      ul: ({ children }) => <ul className="space-y-0.5 mb-2 ml-1">{children}</ul>,
                      li: ({ children }) => <li className="text-xs text-gray-300 flex items-start gap-1.5"><span className="text-amber-400 mt-0.5 shrink-0">▸</span><span>{children}</span></li>,
                      hr: () => <hr className="border-white/8 my-2" />,
                    }}
                  >{adaptedPlan.plan}</ReactMarkdown>
                </div>
              </motion.div>
            )}

            {/* ── DAILY PLAN ──────────────────────────────────── */}
            <div className="lifeos-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                    <TrendingUp size={12} className="text-cyan-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Today's Plan</p>
                </div>
                <button
                  onClick={() => {
                    cache.delete('dashboard_plan');
                    loadDailyPlan();
                  }}
                  disabled={planLoading}
                  className="lifeos-btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={planLoading ? 'animate-spin' : ''} />
                  {planLoading ? 'Generating…' : 'Refresh'}
                </button>
              </div>
              {planLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-500">Generating your personalised plan…</p>
                </div>
              ) : plan ? (
                <div className="plan-markdown">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-base font-black text-white mt-4 mb-2 first:mt-0 flex items-center gap-2">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-sm font-bold text-cyan-400 mt-5 mb-2 first:mt-0 flex items-center gap-2 border-b border-cyan-500/20 pb-1">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-xs font-semibold text-indigo-300 mt-3 mb-1">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-xs text-gray-300 leading-relaxed mb-2">{children}</p>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-white font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-gray-400 italic">{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-1 mb-3 ml-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="space-y-1 mb-3 ml-1 list-decimal list-inside">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-xs text-gray-300 leading-relaxed flex items-start gap-1.5">
                          <span className="text-cyan-500 mt-0.5 shrink-0">▸</span>
                          <span>{children}</span>
                        </li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-amber-500/60 pl-3 my-2 bg-amber-500/5 rounded-r py-1 text-xs text-amber-200/80 italic">{children}</blockquote>
                      ),
                      code: ({ children }) => (
                        <code className="text-[11px] bg-white/5 text-emerald-300 px-1.5 py-0.5 rounded font-mono">{children}</code>
                      ),
                      hr: () => (
                        <hr className="border-white/8 my-3" />
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3 rounded-lg border border-white/8">
                          <table className="w-full text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-white/5">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="text-left text-[11px] font-semibold text-gray-300 px-3 py-2 border-b border-white/8">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="text-[11px] text-gray-400 px-3 py-1.5 border-b border-white/5 last:border-0">{children}</td>
                      ),
                      tr: ({ children }) => (
                        <tr className="hover:bg-white/3 transition-colors">{children}</tr>
                      ),
                    }}
                  >
                    {plan}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">
                  Your plan will appear here automatically each morning.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
