'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  User, Edit3, Save, X, CheckCircle, Dumbbell, Moon, BookOpen,
  Target, Zap, Globe, Languages, Briefcase, Heart, TrendingUp,
  Calendar, Award, BarChart3, Flame, MessageCircle, Loader2,
} from 'lucide-react';

/* ── Label maps ─────────────────────────────────────────────────── */
const GOAL_LABELS: Record<string, string> = {
  lean_bulk: 'Build Muscle (Lean Bulk)',
  cut: 'Lose Fat (Cut)',
  maintain: 'Maintain & Recomp',
};
const GOAL_EMOJIS: Record<string, string> = { lean_bulk: '💪', cut: '🔥', maintain: '⚖️' };
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Mostly sitting',
  light: 'Light activity (1-3x/week)',
  moderate: 'Moderately active (3-5x/week)',
  active: 'Very active (6+/week)',
  very_active: 'Athlete level',
};
const GYM_LABELS: Record<string, string> = {
  commercial: 'Commercial Gym',
  home: 'Home Gym',
  none: 'No Equipment',
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner (< 1 year)',
  intermediate: 'Intermediate (1-3 years)',
  advanced: 'Advanced (3+ years)',
};
const CAREER_LABELS: Record<string, string> = {
  devops: 'DevOps / Cloud Engineering',
  data_engineering: 'Data Engineering',
  frontend: 'Frontend Engineering',
  backend: 'Backend Engineering',
  ai_ml: 'AI / ML Engineering',
  custom: 'Custom goal',
};
const LANG_LABELS: Record<string, string> = {
  english: 'English',
  kannada: 'Kannada',
  hindi: 'Hindi',
  telugu: 'Telugu',
};

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color = '#6366f1' }: any) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}>
          <span className="text-sm" style={{ color }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400 leading-tight">{label}</p>
          {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────── */
function Section({ title, icon: Icon, color, children }: any) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ── Row ─────────────────────────────────────────────────────────── */
function Row({ label, value, editing, editNode }: {
  label: string; value: React.ReactNode; editing?: boolean; editNode?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0 mt-0.5">{label}</span>
      <div className="flex-1 text-right">
        {editing && editNode ? editNode : (
          <span className="text-sm text-white font-medium">{value || <span className="text-gray-600 italic">not set</span>}</span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const api = useApi();
  const { data: session } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<any>({});

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [p, s] = await Promise.all([
      api.getProfile().catch(() => null),
      api.getUserStats().catch(() => null),
    ]);
    setProfile(p);
    setStats(s);
    if (p) setDraft({ ...p });
    setLoading(false);
  }

  function set(key: string, value: any) {
    setDraft((prev: any) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateProfile(draft);
      setProfile({ ...profile, ...draft });
      setEditing(false);
      // Re-calc TDEE after body stat change
      await api.getTDEE().catch(() => {});
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  function cancelEdit() {
    setDraft({ ...profile });
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0f]">
        <Sidebar />
        <main className="ml-56 flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </main>
      </div>
    );
  }

  const bmi = profile?.weightKg && profile?.heightCm
    ? Math.round((profile.weightKg / ((profile.heightCm / 100) ** 2)) * 10) / 10
    : null;

  const langGoals: string[] = profile?.languageGoals || [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-4xl">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                  <User size={28} className="text-indigo-400" />
                </div>
              )}
              {profile?.onboardingComplete && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={12} className="text-white" />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">{profile?.name || 'Your Profile'}</h1>
              <p className="text-gray-400 text-sm">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {stats?.daysSinceJoin != null && (
                  <span className="text-xs text-gray-600">
                    Member for {stats.daysSinceJoin} days
                  </span>
                )}
                {profile?.onboardingComplete && (
                  <span className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    Setup complete
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edit / Save buttons */}
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={cancelEdit} className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 transition-colors">
                  <X size={13} /> Cancel
                </button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl px-4 py-2 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 transition-colors">
                <Edit3 size={13} /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard icon="💪" label="Workouts logged" value={stats.workoutCount} color="#f97316" />
            <StatCard icon="📚" label="Study hours" value={`${stats.totalStudyHours}h`} sub={`${stats.studyTopicsCount} topics`} color="#10b981" />
            <StatCard icon="🗣️" label="English corrections" value={stats.englishCorrections} color="#6366f1" />
            <StatCard icon="🏆" label="Life score" value={stats.currentLifeScore || '—'} sub="current" color="#f59e0b" />
            <StatCard icon="😴" label="Sleep logs" value={stats.sleepLogCount} color="#8b5cf6" />
            <StatCard icon="🥗" label="Diet logs" value={stats.dietLogCount} color="#22d3ee" />
            <StatCard icon="🔥" label="Gym streak" value={`${stats.gymStreak}d`} color="#ef4444" />
            <StatCard icon="☀️" label="Morning check-ins" value={stats.morningCheckinCount} color="#f59e0b" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">

          {/* ── Body & Fitness ──────────────────────────────────────── */}
          <Section title="Body & Fitness" icon={Dumbbell} color="#f97316">
            <div className="space-y-1">
              <Row label="Current Weight"
                value={`${profile?.weightKg}kg`}
                editing={editing}
                editNode={<input type="number" step="0.1" className="lifeos-input text-right w-28 text-sm" value={draft.weightKg || ''} onChange={e => set('weightKg', parseFloat(e.target.value))} />}
              />
              <Row label="Target Weight"
                value={`${profile?.targetWeightKg}kg`}
                editing={editing}
                editNode={<input type="number" step="0.1" className="lifeos-input text-right w-28 text-sm" value={draft.targetWeightKg || ''} onChange={e => set('targetWeightKg', parseFloat(e.target.value))} />}
              />
              <Row label="Height"
                value={profile?.heightCm ? `${profile.heightCm}cm` : null}
                editing={editing}
                editNode={<input type="number" className="lifeos-input text-right w-28 text-sm" value={draft.heightCm || ''} onChange={e => set('heightCm', parseFloat(e.target.value))} />}
              />
              <Row label="Age"
                value={profile?.age ? `${profile.age} years` : null}
                editing={editing}
                editNode={<input type="number" className="lifeos-input text-right w-28 text-sm" value={draft.age || ''} onChange={e => set('age', parseInt(e.target.value))} />}
              />
              {bmi && <Row label="BMI" value={`${bmi} — ${bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese'}`} />}
              <Row label="Primary Goal"
                value={`${GOAL_EMOJIS[profile?.primaryGoal] || ''} ${GOAL_LABELS[profile?.primaryGoal] || profile?.primaryGoal}`}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm" value={draft.primaryGoal || 'lean_bulk'} onChange={e => set('primaryGoal', e.target.value)}>
                    {Object.entries(GOAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                }
              />
              <Row label="Fitness Level"
                value={LEVEL_LABELS[profile?.fitnessLevel] || profile?.fitnessLevel}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm" value={draft.fitnessLevel || 'intermediate'} onChange={e => set('fitnessLevel', e.target.value)}>
                    {Object.entries(LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                }
              />
              <Row label="Activity Level"
                value={ACTIVITY_LABELS[profile?.activityLevel] || profile?.activityLevel}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm" value={draft.activityLevel || 'moderate'} onChange={e => set('activityLevel', e.target.value)}>
                    {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                }
              />
              <Row label="Gym Access"
                value={GYM_LABELS[profile?.gymAccess] || profile?.gymAccess}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm" value={draft.gymAccess || 'commercial'} onChange={e => set('gymAccess', e.target.value)}>
                    {Object.entries(GYM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                }
              />
              <Row label="Gym Days / Week"
                value={`${profile?.gymDaysPerWeek} days`}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm w-24" value={draft.gymDaysPerWeek || 4} onChange={e => set('gymDaysPerWeek', parseInt(e.target.value))}>
                    {[3, 4, 5, 6].map(d => <option key={d} value={d}>{d} days</option>)}
                  </select>
                }
              />
            </div>
          </Section>

          {/* ── Nutrition ────────────────────────────────────────────── */}
          <Section title="Nutrition Targets" icon={Flame} color="#22d3ee">
            <div className="space-y-1 mb-4">
              <Row label="TDEE" value={profile?.tdeeKcal ? `${profile.tdeeKcal} kcal/day` : null} />
              <Row label="Calorie Target"
                value={profile?.dailyCalorieTarget ? `${profile.dailyCalorieTarget} kcal/day` : null}
                editing={editing}
                editNode={<input type="number" className="lifeos-input text-right w-32 text-sm" value={draft.dailyCalorieTarget || ''} onChange={e => set('dailyCalorieTarget', parseInt(e.target.value))} />}
              />
              <Row label="Protein Target"
                value={profile?.dailyProteinTarget ? `${profile.dailyProteinTarget}g/day` : null}
                editing={editing}
                editNode={<input type="number" step="0.5" className="lifeos-input text-right w-28 text-sm" value={draft.dailyProteinTarget || ''} onChange={e => set('dailyProteinTarget', parseFloat(e.target.value))} />}
              />
            </div>
            {profile?.weightKg && profile?.targetWeightKg && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                <p className="text-xs text-indigo-400 font-medium mb-1">Weight journey</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{profile.weightKg}kg</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, ((profile.weightKg - 50) / (profile.targetWeightKg - 50)) * 100))}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-indigo-400">{profile.targetWeightKg}kg</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {profile.targetWeightKg > profile.weightKg
                    ? `${(profile.targetWeightKg - profile.weightKg).toFixed(1)}kg to gain`
                    : `${(profile.weightKg - profile.targetWeightKg).toFixed(1)}kg to lose`}
                </p>
              </div>
            )}
          </Section>

          {/* ── Career ─────────────────────────────────────────────── */}
          <Section title="Career & Goals" icon={Briefcase} color="#10b981">
            <div className="space-y-1">
              <Row label="Profession"
                value={profile?.profession}
                editing={editing}
                editNode={<input type="text" className="lifeos-input text-right text-sm" value={draft.profession || ''} onChange={e => set('profession', e.target.value)} placeholder="Job title" />}
              />
              <Row label="Career Goal"
                value={CAREER_LABELS[profile?.careerGoal] || profile?.careerGoal}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm" value={draft.careerGoal || 'devops'} onChange={e => set('careerGoal', e.target.value)}>
                    {Object.entries(CAREER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                }
              />
              {(profile?.careerGoal === 'custom' || draft.careerGoal === 'custom') && (
                <Row label="Custom Goal"
                  value={profile?.careerGoalCustom}
                  editing={editing}
                  editNode={<input type="text" className="lifeos-input text-right text-sm" value={draft.careerGoalCustom || ''} onChange={e => set('careerGoalCustom', e.target.value)} placeholder="Describe your goal" />}
                />
              )}
              {stats?.studyTopics?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/5">
                  <p className="text-xs text-gray-500 mb-2">Topics studied</p>
                  <div className="flex flex-wrap gap-1">
                    {stats.studyTopics.map((t: string) => (
                      <span key={t} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* ── Language Learning ───────────────────────────────────── */}
          <Section title="Language Learning" icon={Languages} color="#8b5cf6">
            <div className="space-y-1 mb-3">
              <Row label="Native Language"
                value={profile?.nativeLanguage}
                editing={editing}
                editNode={
                  <select className="lifeos-input text-sm w-36" value={draft.nativeLanguage || 'telugu'} onChange={e => set('nativeLanguage', e.target.value)}>
                    {['telugu', 'kannada', 'tamil', 'hindi', 'malayalam', 'marathi', 'bengali', 'other'].map(l => (
                      <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                  </select>
                }
              />
              <Row label="Learning"
                value={langGoals.length > 0 ? langGoals.map(l => LANG_LABELS[l] || l).join(', ') : 'None'}
                editing={editing}
                editNode={
                  <div className="flex flex-wrap gap-2 justify-end">
                    {['english', 'kannada', 'hindi', 'telugu'].map(lang => {
                      const checked = (draft.languageGoals || []).includes(lang);
                      return (
                        <button
                          key={lang}
                          onClick={() => {
                            const current: string[] = draft.languageGoals || [];
                            set('languageGoals', checked ? current.filter(l => l !== lang) : [...current, lang]);
                          }}
                          className={`text-xs rounded-full px-3 py-1 border transition-all ${
                            checked ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                          }`}
                        >
                          {LANG_LABELS[lang]}
                        </button>
                      );
                    })}
                  </div>
                }
              />
              {stats?.kannadaVocab > 0 && <Row label="Kannada vocab" value={`${stats.kannadaVocab} words`} />}
              {stats?.englishCorrections > 0 && <Row label="English corrections" value={stats.englishCorrections} />}
            </div>
          </Section>

          {/* ── Motivation ────────────────────────────────────────────── */}
          <Section title="My Why" icon={Heart} color="#ec4899">
            {editing ? (
              <textarea
                className="lifeos-input w-full resize-none text-sm min-h-[100px]"
                placeholder="Why are you here? What do you want to change in 90 days?"
                value={draft.motivationNote || ''}
                onChange={e => set('motivationNote', e.target.value)}
              />
            ) : profile?.motivationNote ? (
              <p className="text-sm text-gray-300 leading-relaxed bg-pink-500/5 border border-pink-500/10 rounded-xl p-4 italic">
                "{profile.motivationNote}"
              </p>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600 italic mb-3">No motivation note set yet.</p>
                <button onClick={() => setEditing(true)} className="text-xs text-pink-400 hover:text-pink-300">
                  Add your "why" →
                </button>
              </div>
            )}
          </Section>

          {/* ── What LIFEOS knows about you ──────────────────────────── */}
          <Section title="What LIFEOS AI knows about you" icon={Zap} color="#f59e0b">
            <div className="space-y-2 text-xs">
              {[
                profile?.weightKg && `Your current weight is ${profile.weightKg}kg — targeting ${profile.targetWeightKg}kg`,
                profile?.tdeeKcal && `Your TDEE is ${profile.tdeeKcal} kcal/day based on your body stats and activity`,
                profile?.dailyProteinTarget && `You need ${profile.dailyProteinTarget}g protein daily for your goal`,
                profile?.primaryGoal && `Your goal is ${GOAL_LABELS[profile.primaryGoal] || profile.primaryGoal}`,
                profile?.gymDaysPerWeek && `You train ${profile.gymDaysPerWeek} days/week at a ${GYM_LABELS[profile.gymAccess] || profile.gymAccess?.toLowerCase()}`,
                profile?.fitnessLevel && `You're at ${LEVEL_LABELS[profile.fitnessLevel] || profile.fitnessLevel} level`,
                profile?.profession && `You work as ${profile.profession}`,
                profile?.careerGoal && profile.careerGoal !== 'custom' && `Transitioning to ${CAREER_LABELS[profile.careerGoal]}`,
                profile?.careerGoal === 'custom' && profile?.careerGoalCustom && `Career goal: ${profile.careerGoalCustom}`,
                langGoals.includes('english') && "You're building English confidence",
                langGoals.includes('kannada') && "You're learning Kannada as a heritage learner",
                profile?.nativeLanguage && langGoals.length > 0 && `Lessons bridge from your native ${profile.nativeLanguage}`,
                stats?.gymStreak > 0 && `You're on a ${stats.gymStreak}-day gym streak 🔥`,
                stats?.totalStudyHours > 0 && `You've studied ${stats.totalStudyHours} hours across ${stats.studyTopicsCount} topics`,
              ].filter(Boolean).map((fact, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-gray-300">{fact}</span>
                </div>
              ))}
              {profile?.onboardingComplete === false && (
                <a href="/onboarding" className="block mt-3 text-indigo-400 hover:text-indigo-300">
                  Complete your setup to unlock personalized AI → /onboarding
                </a>
              )}
            </div>
          </Section>

        </div>

        {/* ── Telegram integration ─────────────────────────────────── */}
        <div className={`mt-4 rounded-2xl p-5 border ${
          profile?.telegramChatId
            ? 'bg-cyan-500/5 border-cyan-500/20'
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <MessageCircle size={16} className={profile?.telegramChatId ? 'text-cyan-400' : 'text-gray-500'} />
            <h3 className="text-sm font-semibold text-white">Telegram Bot</h3>
            {profile?.telegramChatId && (
              <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full px-2 py-0.5">
                Connected
              </span>
            )}
          </div>
          {profile?.telegramChatId ? (
            <p className="text-xs text-gray-400">
              Your Telegram is linked. You can log meals, check in, and chat with LIFEOS AI directly from Telegram.
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Connect Telegram to log from anywhere — no need to open the app.</p>
              <a href="/onboarding" className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-1.5 hover:bg-cyan-500/15 transition-colors flex-shrink-0 ml-4">
                Setup →
              </a>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
