'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { BookOpen, Mic, CheckCircle, Sparkles, Loader2, ChevronRight, History, Brain, BarChart3, ChevronDown, ChevronUp, Volume2 } from 'lucide-react';
import { LessonView } from '@/components/learning/LessonView';
import ReactMarkdown from 'react-markdown';

const mdIndigo = {
  p: ({ children }: any) => <p className="text-sm text-gray-300 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="text-indigo-200 font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="text-indigo-300 italic">{children}</em>,
  ul: ({ children }: any) => <ul className="space-y-0.5 ml-1 mt-1">{children}</ul>,
  li: ({ children }: any) => (
    <li className="flex items-start gap-1.5 text-sm text-gray-300 leading-relaxed">
      <span className="text-indigo-400 mt-0.5 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ children }: any) => <code className="text-[11px] bg-white/5 text-emerald-300 px-1 rounded font-mono">{children}</code>,
};

const GRAMMAR_TOPICS = [
  'When to use HAVE vs HAD vs HAS',
  'How to use WAS and WERE correctly',
  'Using A, AN, THE (articles)',
  'Present tense: AM / IS / ARE',
  'Past tense: simple past (went, ate, did)',
  'How to form questions in English',
  'Using WILL and WOULD for future',
  'Saying what you WANT or NEED',
  'How to use SINCE and FOR',
  'Describing things with adjectives',
  'Phrasal verbs for office',
  'How to say sorry politely',
  'Using SHOULD and MUST',
  'Contractions: I\'m, don\'t, can\'t',
  'Common Indian English mistakes',
];

const SPEAKING_SITUATIONS = [
  'Introducing myself at work',
  'Asking for help politely',
  'Talking about my weekend plans',
  'Saying I don\'t understand something',
  'Giving my opinion in a meeting',
  'Talking in a job interview',
  'Ordering food at a restaurant',
  'Explaining a technical problem',
];

type Tab = 'learn' | 'speak' | 'correct' | 'vocab' | 'patterns' | 'history';

export default function EnglishPage() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('learn');
  const [stats, setStats] = useState<any>(null);

  // Learn tab
  const [lesson, setLesson] = useState<any>(null);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Speak tab
  const [situation, setSituation] = useState('');
  const [speakResult, setSpeakResult] = useState<any>(null);
  const [speakLoading, setSpeakLoading] = useState(false);

  // Correct tab
  const [text, setText] = useState('');
  const [correctResult, setCorrectResult] = useState<any>(null);
  const [correctLoading, setCorrectLoading] = useState(false);

  // History tab
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  // Vocab / Spaced Repetition tab
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [allCards, setAllCards] = useState<any[]>([]);
  const [vocabStats, setVocabStats] = useState<any>(null);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  // Error Patterns tab
  const [patterns, setPatterns] = useState<any>(null);
  const [patternsLoading, setPatternsLoading] = useState(false);

  useEffect(() => {
    getLesson();
    loadStats();
  }, []);

  async function loadStats() {
    const cacheKey = 'english_stats';
    const hit = cache.get(cacheKey);
    if (hit) { setStats(hit); return; }
    try {
      const s = await api.getEnglishStats();
      setStats(s);
      cache.set(cacheKey, s, 5 * 60 * 1000); // 5-min cache
    } catch {}
  }

  async function getLesson(topic?: string) {
    // For today's default lesson, check session cache first
    if (!topic) {
      const hit = cache.get('english_lesson_today');
      if (hit) { setLesson(hit); setLessonLoading(false); return; }
    }
    setLessonLoading(true);
    setLesson(null);
    setCompleted(false);
    try {
      const data = await api.getEnglishLesson(topic);
      setLesson(data);
      if (!topic) cache.set('english_lesson_today', data); // cache until midnight
    } catch (e) { console.error(e); }
    finally { setLessonLoading(false); }
  }

  async function handleComplete() {
    if (!lesson?.dayNumber) return;
    setCompleting(true);
    try {
      await api.completeEnglishLesson(lesson.dayNumber);
      setCompleted(true);
    } catch {} finally { setCompleting(false); }
  }

  async function practiceSpeaking() {
    if (!situation.trim()) return;
    setSpeakLoading(true);
    setSpeakResult(null);
    try {
      const data = await api.practiceEnglishSpeaking(situation);
      setSpeakResult(data);
    } catch {} finally { setSpeakLoading(false); }
  }

  async function correctEnglish() {
    if (!text.trim()) return;
    setCorrectLoading(true);
    setCorrectResult(null);
    try {
      const data = await api.correctEnglish(text);
      setCorrectResult(data);
      await loadStats();
    } catch {} finally { setCorrectLoading(false); }
  }

  async function loadHistory() {
    if (history.length > 0) return; // already loaded this session
    setHistoryLoading(true);
    try {
      const data = await api.getEnglishLessonHistory();
      setHistory(data || []);
    } catch {} finally { setHistoryLoading(false); }
  }

  async function loadVocab() {
    if (allCards.length > 0) return; // already loaded this session
    setVocabLoading(true);
    try {
      const [due, all, vs] = await Promise.all([
        api.getDueVocabulary(),
        api.getAllVocabulary(),
        api.getVocabularyStats(),
      ]);
      setDueCards(due || []);
      setAllCards(all || []);
      setVocabStats(vs);
      setCurrentCardIdx(0);
      setCardFlipped(false);
      setReviewDone(false);
    } catch {} finally { setVocabLoading(false); }
  }

  async function loadPatterns() {
    if (patterns !== null) return; // already loaded this session
    setPatternsLoading(true);
    try {
      const data = await api.getErrorPatterns();
      setPatterns(data);
    } catch {} finally { setPatternsLoading(false); }
  }

  async function reviewCard(quality: number) {
    const card = dueCards[currentCardIdx];
    if (!card) return;
    try {
      await api.reviewVocabularyCard(card.id, quality);
    } catch {}

    if (currentCardIdx < dueCards.length - 1) {
      setCurrentCardIdx(currentCardIdx + 1);
      setCardFlipped(false);
    } else {
      setReviewDone(true);
      setReviewMode(false);
      await loadVocab();
    }
  }

  function speak(text: string) {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-IN';
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    }
  }

  const TABS = [
    { id: 'learn' as Tab, label: 'Learn', icon: BookOpen },
    { id: 'speak' as Tab, label: 'Speak', icon: Mic },
    { id: 'correct' as Tab, label: 'Correct', icon: CheckCircle },
    { id: 'vocab' as Tab, label: 'Vocabulary', icon: Brain },
    { id: 'patterns' as Tab, label: 'My Mistakes', icon: BarChart3 },
    { id: 'history' as Tab, label: 'History', icon: History },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">English Coach</h1>
            <p className="text-gray-400 text-sm mt-1">Grammar → Confidence → Fluency</p>
          </div>
          {stats && (
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{stats.grammarScore}</p>
                <p className="text-xs text-gray-500">Score</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{stats.totalCorrections}</p>
                <p className="text-xs text-gray-500">Fixes</p>
              </div>
              {stats.weekOverWeek !== undefined && (
                <div className="text-center">
                  <p className={`text-xl font-bold ${stats.weekOverWeek >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.weekOverWeek >= 0 ? '+' : ''}{stats.weekOverWeek}
                  </p>
                  <p className="text-xs text-gray-500">vs last wk</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#12121e] p-1 rounded-xl border border-[#2a2a4a]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => {
                setTab(id);
                if (id === 'history' && !history.length) loadHistory();
                if (id === 'vocab') loadVocab();
                if (id === 'patterns') loadPatterns();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                tab === id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* LEARN TAB */}
        {tab === 'learn' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="lifeos-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-300">Today's Lesson</p>
                    {lesson?.dayNumber && <p className="text-xs text-indigo-400">Day {lesson.dayNumber} of 30</p>}
                  </div>
                  <button onClick={() => getLesson()} disabled={lessonLoading} className="lifeos-btn text-xs">
                    <Sparkles size={12} className="mr-1.5" />
                    {lessonLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                {lessonLoading && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                    <p className="text-sm text-gray-500">Loading lesson + adding words to your vocab bank...</p>
                  </div>
                )}
              </div>

              {lesson && !lessonLoading && (
                <LessonView
                  lesson={lesson}
                  showCompleteButton={true}
                  onComplete={handleComplete}
                  completing={completing}
                  completed={completed}
                  onSpeak={speak}
                />
              )}

              {/* Review words due today */}
              {lesson?.reviewWords?.length > 0 && (
                <div className="lifeos-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={14} className="text-amber-400" />
                    <p className="text-sm font-semibold text-gray-300">Review: Due Today ({lesson.reviewWords.length} words)</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lesson.reviewWords.map((card: any) => (
                      <div key={card.id} className="bg-[#0d0d1a] rounded-lg px-3 py-2 text-xs">
                        <p className="text-white font-medium">{card.word}</p>
                        <p className="text-gray-500 mt-0.5">{card.meaning}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setTab('vocab')} className="text-xs text-indigo-400 mt-3 hover:text-indigo-300">
                    Review all due words →
                  </button>
                </div>
              )}
            </div>

            {/* Topic picker */}
            <div className="lifeos-card h-fit">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Pick a Topic</p>
              <div className="space-y-1">
                {GRAMMAR_TOPICS.map((topic) => (
                  <button key={topic} onClick={() => getLesson(topic)}
                    className="w-full text-left text-xs text-gray-400 hover:text-white hover:bg-[#1a1a2e] px-3 py-2.5 rounded-lg transition-all flex items-center gap-2">
                    <ChevronRight size={12} className="text-indigo-400 flex-shrink-0" />
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SPEAK TAB */}
        {tab === 'speak' && (
          <div className="max-w-2xl space-y-4">
            {/* Confidence note */}
            <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-xl p-3">
              <p className="text-xs text-indigo-300">
                💡 <strong>Remember:</strong> Indians speaking English with an Indian accent is beautiful and normal.
                The goal is <strong>clarity and grammar</strong>, not accent. You already speak better than you think!
              </p>
            </div>

            <div className="lifeos-card-glow">
              <p className="text-sm font-semibold text-white mb-1">What do you want to say?</p>
              <p className="text-gray-500 text-xs mb-4">Describe the situation in Telugu, Hindi, or broken English — I'll show you how</p>
              <textarea
                className="lifeos-input resize-none min-h-[80px] mb-3 text-sm"
                placeholder="Example: I want to tell my manager that I finished the work but I don't know how to say it..."
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
              />
              <button onClick={practiceSpeaking} disabled={speakLoading || !situation.trim()} className="lifeos-btn flex items-center gap-2">
                {speakLoading ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                {speakLoading ? 'Thinking...' : 'Show Me How to Say It'}
              </button>
            </div>

            <div className="lifeos-card">
              <p className="text-xs text-gray-500 mb-2">Common situations:</p>
              <div className="flex flex-wrap gap-2">
                {SPEAKING_SITUATIONS.map((s) => (
                  <button key={s} onClick={() => setSituation(s)}
                    className="text-xs bg-[#1a1a2e] hover:bg-[#2a2a4a] border border-[#2a2a4a] text-gray-400 hover:text-gray-200 rounded-full px-3 py-1.5 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {speakResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="lifeos-card">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">3 Ways to Say It</p>
                    <div className="space-y-3">
                      {speakResult.threeWays?.map((w: any, i: number) => (
                        <div key={i} className={`p-3 rounded-lg border ${
                          i === 0 ? 'bg-blue-500/5 border-blue-500/20' :
                          i === 1 ? 'bg-indigo-500/5 border-indigo-500/20' :
                          'bg-purple-500/5 border-purple-500/20'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase ${
                              i === 0 ? 'text-blue-400' : i === 1 ? 'text-indigo-400' : 'text-purple-400'
                            }`}>{w.level}</span>
                            <button onClick={() => speak(w.sentence)} className="text-gray-600 hover:text-gray-300">
                              <Volume2 size={12} />
                            </button>
                          </div>
                          <p className="text-sm text-white mt-1 font-medium">"{w.sentence}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {speakResult.usefulPhrases?.length > 0 && (
                    <div className="lifeos-card">
                      <p className="text-xs text-gray-500 mb-2">Useful Phrases</p>
                      <div className="space-y-1">
                        {speakResult.usefulPhrases.map((p: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                            <span className="text-indigo-400">→</span> {p}
                            <button onClick={() => speak(p)} className="text-gray-600 hover:text-gray-300 ml-auto">
                              <Volume2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {speakResult.confidenceTip && (
                    <div className="lifeos-card bg-emerald-600/5 border-emerald-600/20">
                      <p className="text-xs text-emerald-400 font-medium mb-1">💪 Confidence Tip</p>
                      <p className="text-sm text-white">{speakResult.confidenceTip}</p>
                    </div>
                  )}

                  {speakResult.normalizeMessage && (
                    <div className="lifeos-card bg-amber-600/5 border-amber-600/20">
                      <p className="text-sm text-amber-200">{speakResult.normalizeMessage}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* CORRECT TAB */}
        {tab === 'correct' && (
          <div className="max-w-2xl space-y-4">
            <div className="lifeos-card">
              <p className="text-sm font-semibold text-gray-300 mb-1">Type anything in English</p>
              <p className="text-xs text-gray-600 mb-3">I'll fix it AND teach you why — your mistakes are saved for pattern analysis</p>
              <textarea
                className="lifeos-input resize-none min-h-[100px] mb-3"
                placeholder="'I am going to gym yesterday and I have eaten rice'"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button onClick={correctEnglish} disabled={correctLoading || !text.trim()} className="lifeos-btn flex items-center gap-2">
                <Sparkles size={14} />
                {correctLoading ? 'Checking...' : 'Fix My English'}
              </button>
            </div>

            <AnimatePresence>
              {correctResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {/* Score */}
                  <div className="lifeos-card flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Grammar Score</p>
                      <p className="text-3xl font-bold text-white">{correctResult.grammarScore}
                        <span className="text-sm text-gray-500">/100</span>
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                        <div className="h-2 rounded-full"
                          style={{
                            width: `${correctResult.grammarScore}%`,
                            backgroundColor: correctResult.grammarScore >= 80 ? '#10b981' : correctResult.grammarScore >= 60 ? '#f59e0b' : '#ef4444',
                          }} />
                      </div>
                    </div>
                    <span className="text-2xl">{correctResult.grammarScore >= 90 ? '🎉' : correctResult.grammarScore >= 70 ? '👍' : '💪'}</span>
                  </div>

                  {/* Corrected */}
                  <div className="lifeos-card">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">Correct Version</p>
                      <button onClick={() => speak(correctResult.correctedText)} className="text-gray-500 hover:text-gray-300">
                        <Volume2 size={14} />
                      </button>
                    </div>
                    <p className="text-base text-emerald-400 font-medium">"{correctResult.correctedText}"</p>
                    {correctResult.betterVersion && correctResult.betterVersion !== correctResult.correctedText && (
                      <div className="mt-2 pt-2 border-t border-[#1e1e36]">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">More natural:</p>
                          <button onClick={() => speak(correctResult.betterVersion)} className="text-gray-500 hover:text-gray-300">
                            <Volume2 size={12} />
                          </button>
                        </div>
                        <p className="text-sm text-indigo-300 mt-1">"{correctResult.betterVersion}"</p>
                      </div>
                    )}
                  </div>

                  {/* Mistakes with teaching */}
                  {correctResult.mistakes?.length > 0 && (
                    <div className="lifeos-card">
                      <p className="text-xs text-gray-500 mb-3">Corrections ({correctResult.mistakes.length}) — saved to your pattern tracker</p>
                      <div className="space-y-3">
                        {correctResult.mistakes.map((m: any, i: number) => (
                          <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e36]">
                            <div className="flex gap-2 flex-wrap mb-2">
                              <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-0.5 line-through">{m.original}</span>
                              <span className="text-gray-600 text-xs">→</span>
                              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5 font-medium">{m.corrected}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-1">{m.explanation}</p>
                            {m.rule && <p className="text-xs text-indigo-400 bg-indigo-500/5 rounded px-2 py-1">Rule: {m.rule}</p>}
                            {m.memoryTrick && <p className="text-xs text-amber-400 mt-1">💡 {m.memoryTrick}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {correctResult.confidenceTip && (
                    <div className="lifeos-card bg-indigo-600/5 border-indigo-600/20">
                      <p className="text-xs text-indigo-400 mb-2">💪 Confidence</p>
                      <ReactMarkdown components={{ ...mdIndigo, p: ({ children }: any) => <p className="text-sm text-white leading-relaxed">{children}</p> }}>{correctResult.confidenceTip}</ReactMarkdown>
                    </div>
                  )}

                  {correctResult.encouragement && (
                    <div className="lifeos-card">
                      <ReactMarkdown components={mdIndigo}>{correctResult.encouragement}</ReactMarkdown>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* VOCABULARY / SPACED REPETITION TAB */}
        {tab === 'vocab' && (
          <div className="space-y-6">
            {/* Stats */}
            {vocabStats && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Words', value: vocabStats.total, color: '#6366f1' },
                  { label: 'Due Today', value: vocabStats.dueToday, color: '#f59e0b' },
                  { label: 'Mastered', value: vocabStats.mastered, color: '#10b981' },
                  { label: 'Learning', value: vocabStats.learning, color: '#06b6d4' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="lifeos-card">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <div className="h-1 rounded-full mt-2" style={{ backgroundColor: color }} />
                  </div>
                ))}
              </div>
            )}

            {vocabLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : reviewMode && dueCards.length > 0 ? (
              /* FLASHCARD REVIEW MODE */
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-400">Card {currentCardIdx + 1} of {dueCards.length}</p>
                  <button onClick={() => setReviewMode(false)} className="text-xs text-gray-500 hover:text-gray-300">Exit review</button>
                </div>

                {!reviewDone ? (
                  <div>
                    <motion.div
                      key={currentCardIdx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="lifeos-card-glow cursor-pointer min-h-[200px] flex flex-col items-center justify-center text-center p-8"
                      onClick={() => setCardFlipped(!cardFlipped)}
                    >
                      {!cardFlipped ? (
                        <div>
                          <p className="text-2xl font-bold text-white mb-2">{dueCards[currentCardIdx]?.word}</p>
                          {dueCards[currentCardIdx]?.pronunciation && (
                            <p className="text-sm text-gray-400 mb-4">/{dueCards[currentCardIdx].pronunciation}/</p>
                          )}
                          <p className="text-xs text-gray-600">Click to reveal meaning</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); speak(dueCards[currentCardIdx]?.word); }}
                            className="mt-3 text-gray-500 hover:text-gray-300"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg text-emerald-400 font-medium mb-2">{dueCards[currentCardIdx]?.meaning}</p>
                          {dueCards[currentCardIdx]?.example && (
                            <p className="text-sm text-gray-400 italic">"{dueCards[currentCardIdx].example}"</p>
                          )}
                        </div>
                      )}
                    </motion.div>

                    {cardFlipped && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-3 gap-3 mt-4"
                      >
                        <button onClick={() => reviewCard(1)} className="bg-red-600/20 border border-red-600/30 text-red-400 rounded-xl py-3 text-sm font-medium hover:bg-red-600/30">
                          ❌ Forgot
                        </button>
                        <button onClick={() => reviewCard(3)} className="bg-amber-600/20 border border-amber-600/30 text-amber-400 rounded-xl py-3 text-sm font-medium hover:bg-amber-600/30">
                          🤔 Hard
                        </button>
                        <button onClick={() => reviewCard(5)} className="bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 rounded-xl py-3 text-sm font-medium hover:bg-emerald-600/30">
                          ✅ Easy
                        </button>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="lifeos-card text-center py-8">
                    <p className="text-3xl mb-3">🎉</p>
                    <p className="text-lg font-bold text-white">Review complete!</p>
                    <p className="text-sm text-gray-400 mt-2">All due cards reviewed. Come back tomorrow for more!</p>
                    <button onClick={() => setReviewMode(false)} className="lifeos-btn mt-4 text-sm">Back to Word Bank</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Start Review Button */}
                {dueCards.length > 0 && (
                  <div className="lifeos-card-glow flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{dueCards.length} words due for review!</p>
                      <p className="text-xs text-gray-400 mt-0.5">Spaced repetition keeps words in long-term memory</p>
                    </div>
                    <button onClick={() => { setReviewMode(true); setCurrentCardIdx(0); setCardFlipped(false); }}
                      className="lifeos-btn text-sm">
                      <Brain size={14} className="mr-2" />
                      Start Review
                    </button>
                  </div>
                )}

                {/* All words */}
                <div className="lifeos-card">
                  <p className="text-sm font-semibold text-gray-300 mb-4">Your Word Bank ({allCards.length} words)</p>
                  {allCards.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 text-sm">No words yet. Complete English lessons to build your bank!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                      {allCards.map((card: any) => (
                        <div key={card.id} className="bg-[#0d0d1a] rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-white">{card.word}</p>
                              <button onClick={() => speak(card.word)} className="text-gray-600 hover:text-gray-400">
                                <Volume2 size={10} />
                              </button>
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              card.intervalDays >= 21 ? 'bg-emerald-600/20 text-emerald-400' :
                              card.reviewCount === 0 ? 'bg-gray-600/20 text-gray-400' :
                              'bg-amber-600/20 text-amber-400'
                            }`}>
                              {card.intervalDays >= 21 ? '✓ Mastered' : card.reviewCount === 0 ? 'New' : `${card.intervalDays}d`}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{card.meaning}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ERROR PATTERNS TAB */}
        {tab === 'patterns' && (
          <div className="max-w-2xl space-y-4">
            {patternsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : !patterns ? (
              <div className="lifeos-card text-center py-8">
                <p className="text-gray-600 text-sm">No patterns yet. Use "Fix My English" a few times to see your mistake patterns.</p>
              </div>
            ) : (
              <>
                {/* Analysis */}
                {patterns.analysis && (
                  <div className="lifeos-card-glow">
                    <p className="text-sm font-semibold text-white mb-4">AI Analysis of Your Mistakes</p>
                    {patterns.analysis.topMistakes?.map((m: any, i: number) => (
                      <div key={i} className="mb-4 last:mb-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-white">{i + 1}. {m.type}</p>
                          <span className="text-xs text-red-400">{m.count} times</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-1">{m.pattern}</p>
                        <p className="text-xs text-emerald-400">Fix: {m.fix}</p>
                      </div>
                    ))}

                    {patterns.analysis.nextFocusArea && (
                      <div className="mt-4 bg-indigo-600/10 border border-indigo-600/20 rounded-xl p-3">
                        <p className="text-xs text-indigo-300 font-medium mb-1">This week's focus:</p>
                        <ReactMarkdown components={{ ...mdIndigo, p: ({ children }: any) => <p className="text-sm text-white leading-relaxed">{children}</p> }}>{patterns.analysis.nextFocusArea}</ReactMarkdown>
                      </div>
                    )}

                    {patterns.analysis.weeklyChallenge && (
                      <div className="mt-3 bg-amber-600/10 border border-amber-600/20 rounded-xl p-3">
                        <p className="text-xs text-amber-400 font-medium mb-1">Weekly Challenge:</p>
                        <ReactMarkdown components={{ ...mdIndigo, p: ({ children }: any) => <p className="text-sm text-white leading-relaxed">{children}</p>, strong: ({ children }: any) => <strong className="text-amber-300 font-semibold">{children}</strong> }}>{patterns.analysis.weeklyChallenge}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}

                {/* Pattern list */}
                <div className="lifeos-card">
                  <p className="text-sm font-semibold text-gray-300 mb-4">All Patterns</p>
                  {patterns.patterns?.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-4">No patterns yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {patterns.patterns?.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold ${
                            p.severity === 'high' ? 'bg-red-600/20 text-red-400' :
                            p.severity === 'medium' ? 'bg-amber-600/20 text-amber-400' :
                            'bg-gray-600/20 text-gray-400'
                          }`}>
                            {p.count}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{p.errorType.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-gray-500">
                              Last seen: {new Date(p.lastSeen).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Lessons ({history.length})</p>
              {historyLoading && <div className="flex items-center gap-2 text-indigo-400 py-4"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading...</span></div>}
              {!historyLoading && history.length === 0 && <p className="text-sm text-gray-600 italic">No lessons yet.</p>}
              {history.map((item) => (
                <button key={item.id}
                  onClick={() => setSelectedHistory(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedHistory?.id === item.id ? 'bg-indigo-600/20 border-indigo-600/40' : 'bg-[#12121e] border-[#2a2a4a] hover:border-indigo-600/30'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-indigo-400">Day {item.dayNumber}</span>
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
                  <p className="text-3xl mb-3">📚</p>
                  <p className="text-gray-400 text-sm">Select a lesson to review</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">{new Date(selectedHistory.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    {selectedHistory.completed && <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-1">✅ Completed</span>}
                  </div>
                  <LessonView lesson={selectedHistory.lessonData} completed={selectedHistory.completed} onSpeak={speak} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
