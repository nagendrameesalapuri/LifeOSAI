'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { Dumbbell, Play, CheckCircle, ChevronRight, Zap, Calendar, TrendingUp, RefreshCw, X, Timer, Check, Plus, Minus } from 'lucide-react';

const SPLIT_COLORS: Record<string, string> = {
  Push: '#f97316',
  Pull: '#8b5cf6',
  Legs: '#06b6d4',
  Upper: '#10b981',
  Lower: '#ec4899',
  'Full Body': '#f59e0b',
};

export default function MyProgramPage() {
  const api = useApi();
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);

  useEffect(() => {
    loadProgram();
  }, []);

  async function loadProgram() {
    setLoading(true);
    try {
      const data = await api.getActiveProgram().catch(() => null);
      setProgram(data);
      if (data?.currentWeek) setSelectedWeek(data.currentWeek);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateProgram() {
    setGenerating(true);
    try {
      const data = await api.generateProgram();
      setProgram(data?.program || data);
      await loadProgram();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  const weekSessions = program?.sessions?.filter((s: any) => s.weekNumber === selectedWeek) || [];

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f]">
        <Sidebar />
        <main className="ml-56 flex-1 p-6 flex items-center justify-center">
          <div className="text-gray-400">Loading your program...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <AnimatePresence>
        {activeSession && (
          <ActiveSessionModal
            session={activeSession}
            onClose={() => setActiveSession(null)}
            onComplete={async (log) => {
              await api.completeSession(activeSession.id, log).catch(() => {});
              setActiveSession(null);
              await loadProgram();
            }}
          />
        )}
      </AnimatePresence>
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Program</h1>
            <p className="text-gray-400 text-sm mt-1">12-week structured workout program with progressive overload</p>
          </div>
          {program && (
            <button onClick={loadProgram} className="lifeos-btn-ghost flex items-center gap-2 text-xs">
              <RefreshCw size={14} />
              Refresh
            </button>
          )}
        </div>

        {!program ? (
          /* No program — generate one */
          <div className="lifeos-card text-center py-12">
            <Dumbbell size={48} className="text-indigo-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No Active Program</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Generate a personalized 12-week Push/Pull/Legs or Upper/Lower program.
              AI will create it based on your goals, equipment, and experience level.
            </p>
            <div className="bg-[#0d0d1a] rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
              <p className="text-xs text-gray-500 mb-3">Your program will include:</p>
              {[
                'Progressive overload built in week by week',
                'Sets, reps, and target weights for each exercise',
                'Form cues and equipment alternatives',
                'Week 12 deload for recovery',
                'Pre/post workout nutrition timing',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300">{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={generateProgram}
              disabled={generating}
              className="lifeos-btn px-8 py-3"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating 12-week program...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap size={16} />
                  Generate My Program
                </span>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Program Overview */}
            <div className="grid grid-cols-4 gap-4">
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">Program</p>
                <p className="text-sm font-bold text-white">{program.name}</p>
              </div>
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">Current Week</p>
                <p className="text-2xl font-bold gradient-text">{program.currentWeek}</p>
                <p className="text-xs text-gray-600">of {program.weekDuration}</p>
              </div>
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">This Week Progress</p>
                <p className="text-2xl font-bold text-white">{program.completedSessions}</p>
                <p className="text-xs text-gray-600">/ {program.totalWeekSessions} sessions</p>
              </div>
              <div className="lifeos-card">
                <p className="text-xs text-gray-500 mb-1">Program Progress</p>
                <p className="text-2xl font-bold text-emerald-400">{program.weekProgress}%</p>
                <div className="h-1 bg-[#1e1e36] rounded-full mt-2">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${program.weekProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Week Selector */}
            <div className="lifeos-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-400" />
                  Week by Week Plan
                </h3>
                <div className="flex gap-1">
                  {Array.from({ length: program.weekDuration || 12 }, (_, i) => i + 1).map((w) => (
                    <button
                      key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                        selectedWeek === w
                          ? 'bg-indigo-600 text-white'
                          : w === program.currentWeek
                          ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-600'
                          : 'bg-[#1e1e36] text-gray-500 hover:bg-[#2a2a4a]'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {selectedWeek === 12 && (
                <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-3 mb-4">
                  <p className="text-xs text-amber-400 font-medium">Week 12 — Deload Week</p>
                  <p className="text-xs text-gray-400 mt-1">Reduce volume by 40%. Use ~60% of your normal weights. Your muscles need this recovery before the next cycle.</p>
                </div>
              )}

              {/* Sessions for selected week */}
              <div className="space-y-3">
                {weekSessions.length > 0 ? weekSessions.map((session: any) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isCurrentWeek={selectedWeek === program.currentWeek}
                    onComplete={() => {
                      setActiveSession(session);
                    }}
                  />
                )) : (
                  <p className="text-sm text-gray-600 text-center py-4">No sessions for this week yet.</p>
                )}
              </div>
            </div>

            {/* Progressive Overload Note */}
            <div className="lifeos-card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-gray-300">Progressive Overload Guide</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Weeks 1-4', title: 'Foundation', desc: 'Learn the movements. Focus on form. Moderate weights.', color: '#06b6d4' },
                  { label: 'Weeks 5-8', title: 'Build', desc: 'Add 2.5kg per week on compound lifts. Hit target reps first.', color: '#10b981' },
                  { label: 'Weeks 9-11', title: 'Peak', desc: 'Push intensity. Lower reps, higher weight. Max overload.', color: '#f97316' },
                ].map((phase) => (
                  <div key={phase.label} className="bg-[#0d0d1a] rounded-xl p-3">
                    <p className="text-xs font-medium" style={{ color: phase.color }}>{phase.label}</p>
                    <p className="text-sm font-bold text-white mt-1">{phase.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{phase.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ActiveSessionModal({ session, onClose, onComplete }: {
  session: any;
  onClose: () => void;
  onComplete: (log: any) => Promise<void>;
}) {
  const exercises = (session.exercises as any[]) || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(exercises.map(() => false));
  const [actualWeights, setActualWeights] = useState<number[]>(
    exercises.map((ex: any) => ex.targetWeightKg || ex.week1TargetKg || 0)
  );
  const [actualReps, setActualReps] = useState<number[]>(
    exercises.map((ex: any) => {
      const r = ex.repsRange || ex.reps || '8';
      return parseInt(String(r).split('-')[0]) || 8;
    })
  );
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function startRest(seconds: number) {
    setRestTimer(seconds);
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timerRef.current!);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function markDone(idx: number) {
    const updated = [...completed];
    updated[idx] = true;
    setCompleted(updated);
    startRest(90);
    if (idx < exercises.length - 1) setCurrentIdx(idx + 1);
  }

  async function finishSession() {
    setSaving(true);
    const log = exercises.map((ex: any, i: number) => ({
      name: ex.name,
      sets: ex.sets,
      reps: actualReps[i],
      weightKg: actualWeights[i],
      completed: completed[i],
    }));
    await onComplete(log);
    setSaving(false);
  }

  const allDone = completed.every(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="bg-[#0d0d1a] border border-[#1e1e36] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e36]">
          <div>
            <h2 className="text-lg font-bold text-white">{session.dayLabel}</h2>
            <p className="text-xs text-gray-500">{exercises.length} exercises · {completed.filter(Boolean).length} done</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Rest timer */}
        {restTimer != null && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex items-center gap-3">
            <Timer size={16} className="text-amber-400 animate-pulse" />
            <span className="text-amber-400 font-mono font-bold text-lg">{restTimer}s</span>
            <span className="text-xs text-gray-400">rest — breathe, hydrate</span>
            <button onClick={() => { clearInterval(timerRef.current!); setRestTimer(null); }} className="ml-auto text-xs text-gray-500">
              skip
            </button>
          </div>
        )}

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {exercises.map((ex: any, i: number) => (
            <div
              key={i}
              className={`rounded-xl border p-4 transition-all ${
                completed[i]
                  ? 'border-emerald-500/30 bg-emerald-500/5 opacity-60'
                  : i === currentIdx
                  ? 'border-indigo-500/50 bg-indigo-500/5'
                  : 'border-[#1e1e36] bg-[#0a0a0f]'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {completed[i]
                    ? <Check size={16} className="text-emerald-400" />
                    : <div className={`w-4 h-4 rounded-full border-2 ${i === currentIdx ? 'border-indigo-400' : 'border-gray-600'}`} />
                  }
                  <div>
                    <p className="text-sm font-semibold text-white">{ex.name}</p>
                    <p className="text-xs text-gray-500">{ex.sets} sets</p>
                  </div>
                </div>
                {ex.progressionNote && (
                  <span className="text-xs text-emerald-400">{ex.progressionNote}</span>
                )}
              </div>

              {/* Weight & reps controls */}
              {!completed[i] && i === currentIdx && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Weight (kg)</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { const u = [...actualWeights]; u[i] = Math.max(0, u[i] - 2.5); setActualWeights(u); }} className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white">
                        <Minus size={12} />
                      </button>
                      <span className="flex-1 text-center font-bold text-white">{actualWeights[i]}</span>
                      <button onClick={() => { const u = [...actualWeights]; u[i] = u[i] + 2.5; setActualWeights(u); }} className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reps</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { const u = [...actualReps]; u[i] = Math.max(1, u[i] - 1); setActualReps(u); }} className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white">
                        <Minus size={12} />
                      </button>
                      <span className="flex-1 text-center font-bold text-white">{actualReps[i]}</span>
                      <button onClick={() => { const u = [...actualReps]; u[i] = u[i] + 1; setActualReps(u); }} className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {ex.formCue && i === currentIdx && !completed[i] && (
                <p className="text-xs text-indigo-300 italic mb-2">💡 {ex.formCue}</p>
              )}

              {i === currentIdx && !completed[i] && (
                <button
                  onClick={() => markDone(i)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Check size={14} />
                  Set Done — Rest {90}s
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e1e36]">
          <button
            onClick={finishSession}
            disabled={!allDone || saving}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            {allDone ? 'Complete Session' : `${completed.filter(Boolean).length}/${exercises.length} exercises done`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SessionCard({ session, isCurrentWeek, onComplete }: any) {
  const [expanded, setExpanded] = useState(false);
  const color = SPLIT_COLORS[session.splitType] || '#6366f1';
  const exercises = (session.exercises as any[]) || [];

  return (
    <div className="border border-[#1e1e36] rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#0d0d1a] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: color }} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">{session.dayLabel}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}22`, color }}>
                {session.splitType}
              </span>
            </div>
            <p className="text-xs text-gray-500">{exercises.length} exercises</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.completed && (
            <CheckCircle size={16} className="text-emerald-400" />
          )}
          {expanded ? (
            <ChevronRight size={14} className="text-gray-500 rotate-90" />
          ) : (
            <ChevronRight size={14} className="text-gray-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#1e1e36] p-3 space-y-2">
          {exercises.map((ex: any, i: number) => (
            <div key={i} className="bg-[#0d0d1a] rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{ex.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ex.sets} sets × {ex.repsRange || ex.reps} reps
                    {ex.week1TargetKg ? ` @ ${ex.week1TargetKg}kg` : ''}
                  </p>
                </div>
                {ex.progressionPerWeek && (
                  <span className="text-xs text-emerald-400">+{ex.progressionPerWeek}kg/week</span>
                )}
              </div>
              {ex.formCue && (
                <p className="text-xs text-indigo-300 mt-1 italic">💡 {ex.formCue}</p>
              )}
              {ex.alternatives?.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">Alt: {ex.alternatives[0]}</p>
              )}
            </div>
          ))}

          {isCurrentWeek && !session.completed && (
            <button
              onClick={onComplete}
              className="w-full lifeos-btn text-sm py-2 mt-2 flex items-center justify-center gap-2"
            >
              <Play size={14} />
              Start This Session
            </button>
          )}
        </div>
      )}
    </div>
  );
}
