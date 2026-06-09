'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sparkles, CheckCircle, Volume2, Loader2, BookOpen, History, Map, PenTool } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const mdAmber = {
  p: ({ children }: any) => <p className="text-sm text-gray-300 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="text-amber-300 font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="text-amber-400 italic">{children}</em>,
  ul: ({ children }: any) => <ul className="space-y-0.5 ml-1 mt-1">{children}</ul>,
  li: ({ children }: any) => (
    <li className="flex items-start gap-1.5 text-sm text-gray-300 leading-relaxed">
      <span className="text-amber-400 mt-0.5 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ children }: any) => <code className="text-[11px] bg-white/5 text-emerald-300 px-1 rounded font-mono">{children}</code>,
};

type Tab = 'lesson' | 'curriculum' | 'script' | 'history';

export default function KannadaPage() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('lesson');
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<any>(null);

  // Curriculum
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  // Script
  const [scriptData, setScriptData] = useState<any[]>([]);
  const [scriptLoading, setScriptLoading] = useState(false);

  useEffect(() => {
    getLesson();
    loadProgress();
  }, []);

  async function getLesson(day?: number) {
    // Session cache for today's default lesson only
    if (!day) {
      const hit = cache.get('kannada_lesson_today');
      if (hit && !hit.parseError) {
        setLesson(hit);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setLesson(null);
    setPracticeAnswers({});
    setCheckedAnswers({});
    try {
      const data = await api.getKannadaLesson(day);
      setLesson(data);
      if (!day && !data?.parseError) cache.set('kannada_lesson_today', data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadProgress() {
    const hit = cache.get('kannada_progress');
    if (hit) { setProgress(hit); return; }
    try {
      const p = await api.getKannadaProgress();
      setProgress(p);
      cache.set('kannada_progress', p, 5 * 60 * 1000);
    } catch {}
  }

  async function saveProgress() {
    if (!lesson?.words?.length) return;
    setSaving(true);
    try {
      const wordList = lesson.words.map((w: any) => w.kannada);
      await api.logKannada({ wordsLearned: wordList, confidenceScore: 7 });
      if (lesson?.dayNumber) await api.completeKannadaLesson(lesson.dayNumber);
      const p = await api.getKannadaProgress();
      setProgress(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function loadCurriculum() {
    if (curriculum.length > 0) return; // already loaded
    setCurriculumLoading(true);
    try {
      const data = await api.getKannadaCurriculum();
      setCurriculum(data || []);
    } catch {} finally { setCurriculumLoading(false); }
  }

  async function loadHistory() {
    if (history.length > 0) return; // already loaded
    setHistoryLoading(true);
    try {
      setHistory(await api.getKannadaLessonHistory());
    } catch {} finally { setHistoryLoading(false); }
  }

  async function loadScript() {
    if (scriptData.length > 0) return; // already loaded
    setScriptLoading(true);
    try {
      const data = await api.getKannadaScript();
      setScriptData(data || []);
    } catch {} finally { setScriptLoading(false); }
  }

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'kn-IN';
      utter.rate = 0.8;
      window.speechSynthesis.speak(utter);
    }
  }

  const LEVEL_COLORS: Record<string, string> = {
    'Heritage Activation': '#f97316',
    'Foundation': '#10b981',
    'Building': '#06b6d4',
    'Script': '#8b5cf6',
    'Practical': '#f59e0b',
    'Communication': '#ec4899',
    'Cultural': '#6366f1',
    'Mastery': '#f97316',
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Kannada Coach</h1>
            <p className="text-gray-400 text-sm mt-1">Heritage learner approach — you already know more than you think!</p>
          </div>
          {progress && (
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{progress.totalVocab}</p>
                <p className="text-xs text-gray-500">Words</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{progress.completedLessons}</p>
                <p className="text-xs text-gray-500">Lessons</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold gradient-text">{progress.kannadaScore}</p>
                <p className="text-xs text-gray-500">Score</p>
              </div>
            </div>
          )}
        </div>

        {/* Heritage learner notice */}
        <div className="bg-amber-600/10 border border-amber-600/20 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-300">
            🌟 <strong>You're a heritage learner</strong> — you grew up hearing Kannada! This course bridges Telugu (which you know)
            to Kannada, so you'll progress much faster than a complete beginner. Trust yourself!
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#12121e] p-1 rounded-xl border border-[#2a2a4a]">
          {[
            { id: 'lesson' as Tab, label: "Today's Lesson", icon: BookOpen },
            { id: 'curriculum' as Tab, label: '20-Day Plan', icon: Map },
            { id: 'script' as Tab, label: 'Kannada Script', icon: PenTool },
            { id: 'history' as Tab, label: 'My Lessons', icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => {
                setTab(id);
                if (id === 'curriculum' && !curriculum.length) loadCurriculum();
                if (id === 'history' && !history.length) loadHistory();
                if (id === 'script' && !scriptData.length) loadScript();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                tab === id ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* TODAY'S LESSON */}
        {tab === 'lesson' && (
          <div className="max-w-2xl space-y-4">
            {loading ? (
              <div className="lifeos-card text-center py-12">
                <Loader2 size={28} className="animate-spin text-amber-400 mx-auto mb-3" />
                <p className="text-gray-400">Preparing your lesson + adding words to vocab bank... 🌟</p>
              </div>
            ) : lesson?.parseError ? (
              <div className="lifeos-card text-center py-10">
                <p className="text-2xl mb-3">🇮🇳</p>
                <p className="text-white font-semibold mb-1">Lesson generation hiccup</p>
                <p className="text-gray-400 text-sm mb-4">
                  The AI had trouble formatting today's lesson. Click Refresh to try again — it usually works on the second attempt.
                </p>
                <button onClick={() => getLesson()} className="lifeos-btn px-6 py-2">
                  Refresh Lesson
                </button>
              </div>
            ) : lesson && (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Theme header */}
                  <div className="lifeos-card-glow">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h2 className="text-lg font-bold text-white">{lesson.theme}</h2>
                        {lesson.curriculum && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            backgroundColor: `${LEVEL_COLORS[lesson.curriculum] || '#6366f1'}22`,
                            color: LEVEL_COLORS[lesson.curriculum] || '#6366f1',
                          }}>
                            {lesson.curriculum}
                          </span>
                        )}
                      </div>
                      {lesson.dayNumber && (
                        <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">
                          Day {lesson.dayNumber} / 20
                        </span>
                      )}
                    </div>
                    {lesson.intro && (
                      <div className="text-sm text-gray-300 bg-[#1a1a2e] rounded-lg px-4 py-3 border-l-2 border-amber-400">
                        <ReactMarkdown components={mdAmber}>{lesson.intro}</ReactMarkdown>
                      </div>
                    )}
                    {lesson.teluguBridge && (
                      <div className="mt-3 bg-emerald-600/10 border border-emerald-600/20 rounded-lg px-4 py-2">
                        <p className="text-xs text-emerald-400 font-medium">Telugu → Kannada Bridge:</p>
                        <div className="text-sm text-white mt-1">
                          <ReactMarkdown components={{ ...mdAmber, p: ({ children }: any) => <p className="text-sm text-white leading-relaxed">{children}</p>, strong: ({ children }: any) => <strong className="text-emerald-300 font-semibold">{children}</strong> }}>{lesson.teluguBridge}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Words with TTS */}
                  {lesson.words?.length > 0 && (
                    <div className="lifeos-card">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-4">Today's Words</p>
                      <div className="space-y-3">
                        {lesson.words.map((word: any, i: number) => (
                          <motion.div key={i}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-start gap-4 bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e36]">
                            <div className="text-center min-w-[90px]">
                              <p className="text-2xl font-bold text-white mb-1">{word.kannada}</p>
                              <p className="text-[11px] text-cyan-400 font-mono">{word.pronunciation}</p>
                              {word.scriptBreakdown && (
                                <p className="text-[9px] text-gray-600 mt-1">{word.scriptBreakdown}</p>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-emerald-400 mb-1">{word.meaning}</p>
                              {word.teluguEquivalent && (
                                <p className="text-xs text-amber-400 mb-1">Telugu: {word.teluguEquivalent}</p>
                              )}
                              {word.when_to_use && (
                                <p className="text-xs text-gray-500">Use: {word.when_to_use}</p>
                              )}
                            </div>
                            <button
                              onClick={() => speak(word.kannada)}
                              className="text-gray-400 hover:text-amber-400 transition-colors p-2 rounded-lg hover:bg-amber-400/10"
                            >
                              <Volume2 size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentences */}
                  {lesson.sentences?.length > 0 && (
                    <div className="lifeos-card">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-4">Sentences</p>
                      <div className="space-y-4">
                        {lesson.sentences.map((s: any, i: number) => (
                          <div key={i} className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e36]">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xl font-bold text-white">{s.kannada}</p>
                              <button onClick={() => speak(s.kannada)} className="text-gray-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-400/10">
                                <Volume2 size={14} />
                              </button>
                            </div>
                            <p className="text-sm text-cyan-400 font-mono mb-2">{s.pronunciation}</p>
                            <p className="text-sm text-gray-300 mb-2">🌐 {s.meaning}</p>
                            {s.teluguCompare && <p className="text-xs text-amber-400 mb-1">Telugu: {s.teluguCompare}</p>}
                            {s.breakdown && <div className="text-xs text-gray-600 bg-[#12121e] rounded-lg px-3 py-2">🔍 {s.breakdown}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Script Lesson */}
                  {lesson.scriptLesson && (
                    <div className="lifeos-card bg-purple-600/5 border-purple-600/20">
                      <p className="text-xs text-purple-400 uppercase tracking-wide mb-3 font-medium">Today's Script Practice</p>
                      <div className="flex gap-4">
                        {lesson.scriptLesson.eachLetter?.map((l: any, i: number) => (
                          <div key={i} className="text-center bg-[#0a0a0f] rounded-xl p-3 flex-1">
                            <p className="text-3xl font-bold text-white mb-1">{l.letter}</p>
                            <p className="text-xs text-cyan-400">{l.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{l.sound}</p>
                            <button onClick={() => speak(l.letter)} className="mt-2 text-gray-500 hover:text-amber-400">
                              <Volume2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {lesson.scriptLesson.practiceWord && (
                        <p className="text-xs text-gray-400 mt-3">✍️ {lesson.scriptLesson.practiceWord}</p>
                      )}
                    </div>
                  )}

                  {/* Practice Quiz */}
                  {lesson.practice?.length > 0 && (
                    <div className="lifeos-card">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-4">Quick Quiz</p>
                      <div className="space-y-3">
                        {lesson.practice.map((q: any, i: number) => (
                          <div key={i} className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e36]">
                            <p className="text-sm text-white mb-3">Q{i + 1}: {q.question}</p>
                            <div className="flex gap-2">
                              <input
                                className="lifeos-input flex-1 text-sm"
                                placeholder="Your answer..."
                                value={practiceAnswers[i] || ''}
                                onChange={(e) => setPracticeAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                              />
                              <button onClick={() => setCheckedAnswers(p => ({ ...p, [i]: true }))} className="lifeos-btn text-xs px-3">Check</button>
                            </div>
                            {checkedAnswers[i] && (
                              <div className="mt-2 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-3 py-2">
                                ✅ {q.answer}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cultural Note */}
                  {lesson.culturalNote && (
                    <div className="lifeos-card bg-amber-600/5 border-amber-600/20">
                      <p className="text-xs text-amber-400 font-medium mb-2">🏛️ Cultural Connection</p>
                      <ReactMarkdown components={mdAmber}>{lesson.culturalNote}</ReactMarkdown>
                    </div>
                  )}

                  {/* Today's Challenge */}
                  {lesson.todayChallenge && (
                    <div className="lifeos-card bg-yellow-500/5 border-yellow-500/20">
                      <p className="text-xs text-yellow-400 font-bold uppercase tracking-wide mb-2">🎯 Today's Challenge</p>
                      <ReactMarkdown components={{ ...mdAmber, p: ({ children }: any) => <p className="text-sm text-white leading-relaxed">{children}</p>, strong: ({ children }: any) => <strong className="text-yellow-300 font-semibold">{children}</strong> }}>{lesson.todayChallenge}</ReactMarkdown>
                      <p className="text-xs text-gray-500 mt-2">Try this with your family or anyone around you!</p>
                    </div>
                  )}

                  {lesson.encouragement && (
                    <div className="lifeos-card bg-indigo-600/5 border-indigo-600/20">
                      <ReactMarkdown components={{ ...mdAmber, p: ({ children }: any) => <p className="text-sm text-indigo-300 leading-relaxed">{children}</p>, strong: ({ children }: any) => <strong className="text-indigo-200 font-semibold">{children}</strong>, em: ({ children }: any) => <em className="text-indigo-400 italic">{children}</em> }}>{lesson.encouragement}</ReactMarkdown>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button onClick={saveProgress} disabled={saving}
                      className={`lifeos-btn flex-1 flex items-center justify-center gap-2 py-3 ${saved ? 'bg-emerald-600' : ''}`}>
                      <CheckCircle size={15} />
                      {saved ? '✅ Saved!' : saving ? 'Saving...' : 'Complete Lesson'}
                    </button>
                    <button onClick={() => getLesson()} className="lifeos-btn-ghost px-6 py-3 text-sm">
                      Refresh →
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}

        {/* 20-DAY CURRICULUM */}
        {tab === 'curriculum' && (
          <div>
            {curriculumLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-amber-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {curriculum.map((item: any) => {
                  const isCompleted = history.some((h: any) => h.dayNumber === item.day);
                  const isToday = progress?.currentDay === item.day;
                  const color = LEVEL_COLORS[item.level] || '#6366f1';

                  return (
                    <button
                      key={item.day}
                      onClick={() => { setTab('lesson'); getLesson(item.day); }}
                      className={`text-left lifeos-card transition-all ${isToday ? 'border-amber-400/50' : 'hover:border-indigo-600/30'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold" style={{ color }}>Day {item.day}</span>
                        <div className="flex items-center gap-1">
                          {isCompleted && <CheckCircle size={12} className="text-emerald-400" />}
                          {isToday && <span className="text-xs text-amber-400">Today</span>}
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}22`, color }}>
                            {item.level}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{item.theme}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* KANNADA SCRIPT */}
        {tab === 'script' && (
          <div className="max-w-2xl space-y-6">
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-white mb-2">Learning Kannada Script</p>
              <p className="text-xs text-gray-400">
                Kannada has 49 letters (16 vowels + 34 consonants). Once you know the script,
                you can read signboards, menus, and messages on your own!
              </p>
            </div>

            {scriptLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-purple-400" />
              </div>
            ) : (
              scriptData.map((section: any, si: number) => (
                <div key={si} className="lifeos-card">
                  <p className="text-sm font-semibold text-purple-400 mb-4">{section.section}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {section.letters?.map((letter: any, li: number) => (
                      <div key={li} className="bg-[#0d0d1a] rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <p className="text-3xl font-bold text-white">{letter.letter}</p>
                          <button onClick={() => speak(letter.letter)} className="text-gray-500 hover:text-amber-400">
                            <Volume2 size={12} />
                          </button>
                        </div>
                        <p className="text-sm font-medium text-cyan-400 mb-1">{letter.name}</p>
                        <p className="text-xs text-gray-500 mb-2">{letter.sound}</p>
                        <p className="text-xs text-amber-400">{letter.example}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Lessons ({history.length})</p>
              {historyLoading && <div className="flex items-center gap-2 text-amber-400 py-4"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading...</span></div>}
              {history.map((item) => (
                <button key={item.id} onClick={() => setSelectedHistory(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedHistory?.id === item.id ? 'bg-amber-600/20 border-amber-600/40' : 'bg-[#12121e] border-[#2a2a4a] hover:border-amber-600/30'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-amber-400">Day {item.dayNumber}</span>
                    <span className="text-[10px] text-gray-600">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <p className="text-sm text-white truncate">{item.topic}</p>
                  {item.completed && <span className="text-[10px] text-emerald-400">✅ done</span>}
                </button>
              ))}
            </div>
            <div className="col-span-2">
              {!selectedHistory ? (
                <div className="lifeos-card text-center py-16">
                  <p className="text-3xl mb-3">🇮🇳</p>
                  <p className="text-gray-400 text-sm">Select a lesson to review</p>
                </div>
              ) : (() => {
                const l = selectedHistory.lessonData as any;
                return (
                  <div className="space-y-4">
                    <div className="lifeos-card">
                      <h2 className="text-lg font-bold text-white mb-2">{l?.theme}</h2>
                      {l?.intro && <p className="text-sm text-gray-300">{l.intro}</p>}
                    </div>
                    {l?.words?.length > 0 && (
                      <div className="lifeos-card">
                        <p className="text-xs text-gray-500 mb-3">Words</p>
                        {l.words.map((w: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 bg-[#0a0a0f] rounded-lg p-3 mb-2">
                            <div className="flex items-center gap-2 min-w-[80px]">
                              <p className="text-base font-bold text-white">{w.kannada}</p>
                              <button onClick={() => speak(w.kannada)} className="text-gray-500 hover:text-amber-400">
                                <Volume2 size={10} />
                              </button>
                            </div>
                            <p className="text-xs text-cyan-400">{w.pronunciation}</p>
                            <p className="text-sm text-emerald-400 ml-auto">{w.meaning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
