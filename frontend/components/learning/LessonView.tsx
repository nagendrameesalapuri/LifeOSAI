'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const mdComponents = {
  p: ({ children }: any) => <p className="text-sm leading-relaxed mb-1 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="text-indigo-300 italic">{children}</em>,
  ul: ({ children }: any) => <ul className="space-y-0.5 ml-1">{children}</ul>,
  li: ({ children }: any) => (
    <li className="flex items-start gap-1.5 text-sm leading-relaxed">
      <span className="text-indigo-400 mt-0.5 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ children }: any) => <code className="text-[11px] bg-white/5 text-emerald-300 px-1 rounded font-mono">{children}</code>,
  table: ({ children }: any) => <div className="overflow-x-auto my-2 rounded-lg border border-indigo-500/20"><table className="w-full text-xs">{children}</table></div>,
  thead: ({ children }: any) => <thead className="bg-indigo-500/10">{children}</thead>,
  th: ({ children }: any) => <th className="text-left text-[11px] font-semibold text-indigo-300 px-3 py-2 border-b border-indigo-500/20">{children}</th>,
  td: ({ children }: any) => <td className="text-[11px] text-gray-400 px-3 py-1.5 border-b border-white/5">{children}</td>,
  tr: ({ children }: any) => <tr className="hover:bg-white/3 transition-colors">{children}</tr>,
};

interface LessonViewProps {
  lesson: any;
  showCompleteButton?: boolean;
  onComplete?: () => void;
  completing?: boolean;
  completed?: boolean;
  onSpeak?: (text: string) => void;
}

export function LessonView({ lesson, showCompleteButton, onComplete, completing, completed, onSpeak }: LessonViewProps) {
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  if (!lesson) return null;

  return (
    <div className="space-y-4">
      {/* Topic header */}
      <div className="lifeos-card-glow">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">📚</span>
          <h2 className="text-lg font-bold text-white">{lesson.topic}</h2>
          {completed && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 ml-auto">
              ✅ Completed
            </span>
          )}
        </div>
        <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-lg p-3 mb-3">
          <p className="text-xs text-indigo-400 font-medium mb-1">Simple Rule:</p>
          <div className="text-sm text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...mdComponents, p: ({ children }: any) => <p className="text-sm text-white leading-relaxed">{children}</p>, em: ({ children }: any) => <em className="text-indigo-300 italic">{children}</em> }}>{lesson.simpleRule}</ReactMarkdown>
          </div>
        </div>
        {lesson.whyItMatters && (
          <div className="text-xs text-gray-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...mdComponents, p: ({ children }: any) => <p className="text-xs text-gray-400 leading-relaxed">💡 {children}</p> }}>{lesson.whyItMatters}</ReactMarkdown>
          </div>
        )}
        {lesson.memoryTrick && (
          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-xs text-yellow-400 font-medium">🧠 Memory Trick:</p>
            <div className="text-sm text-yellow-200 mt-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...mdComponents, p: ({ children }: any) => <p className="text-sm text-yellow-200 leading-relaxed">{children}</p>, strong: ({ children }: any) => <strong className="text-yellow-100 font-semibold">{children}</strong> }}>{lesson.memoryTrick}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Examples */}
      {lesson.examples?.length > 0 && (
        <div className="lifeos-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Examples</p>
          <div className="space-y-3">
            {lesson.examples.map((ex: any, i: number) => (
              <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e36]">
                <div className="flex items-start gap-2 mb-1">
                  <XCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-300 line-through">{ex.wrong}</span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-emerald-300 font-medium">{ex.right}</span>
                </div>
                <p className="text-xs text-gray-500 ml-5">💡 {ex.tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vocabulary Words */}
      {lesson.vocabulary?.length > 0 && (
        <div className="lifeos-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Today's New Words 📖</p>
          <p className="text-xs text-gray-600 mb-4">Click a card to see the example</p>
          <div className="grid grid-cols-1 gap-3">
            {lesson.vocabulary.map((v: any, i: number) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => setFlippedCards(p => ({ ...p, [i]: !p[i] }))}
                className="cursor-pointer bg-[#0a0a0f] rounded-xl border border-[#1e1e36] hover:border-indigo-600/40 transition-all overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{v.word}</span>
                      <span className="text-xs text-cyan-400 font-mono">/{v.pronunciation}/</span>
                      {onSpeak && (
                        <button onClick={(e) => { e.stopPropagation(); onSpeak(v.word); }}
                          className="text-gray-500 hover:text-gray-300">
                          <Volume2 size={11} />
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">{flippedCards[i] ? '▲' : '▼'}</span>
                  </div>
                  <p className="text-sm text-emerald-400">{v.meaning}</p>
                </div>
                <AnimatePresence>
                  {flippedCards[i] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[#1e1e36] px-3 py-3 bg-[#12121e]">
                      <p className="text-sm text-gray-300 mb-1 italic">"{v.example}"</p>
                      {v.indianContext && (
                        <p className="text-xs text-yellow-400">🇮🇳 {v.indianContext}</p>
                      )}
                      {v.useSentence && (
                        <p className="text-xs text-indigo-400 mt-1">📝 {v.useSentence}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Practice */}
      {lesson.practice?.length > 0 && (
        <div className="lifeos-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Practice — Fill in the blank</p>
          <div className="space-y-4">
            {lesson.practice.map((p: any, i: number) => (
              <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e36]">
                <p className="text-sm text-white mb-2">{p.fill}</p>
                <div className="flex gap-2 items-center">
                  <input
                    className="lifeos-input flex-1 text-sm"
                    placeholder="Your answer..."
                    value={practiceAnswers[i] || ''}
                    onChange={(e) => setPracticeAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  />
                  <button
                    onClick={() => setCheckedAnswers(prev => ({ ...prev, [i]: true }))}
                    className="lifeos-btn text-xs px-3">Check</button>
                </div>
                {checkedAnswers[i] && (
                  <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
                    practiceAnswers[i]?.toLowerCase().trim() === p.answer?.toLowerCase()
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {practiceAnswers[i]?.toLowerCase().trim() === p.answer?.toLowerCase()
                      ? '✅ Correct! Great job!'
                      : `❌ Answer: "${p.answer}" — ${p.hint}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speaking Challenge */}
      {(lesson.speakingChallenge || lesson.speakingTip) && (
        <div className="lifeos-card border-cyan-600/20 bg-cyan-600/5">
          <p className="text-xs text-cyan-400 font-medium mb-2">🎯 Speaking Challenge</p>
          <div className="text-base text-white font-medium mb-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...mdComponents, p: ({ children }: any) => <p className="text-base text-white font-medium leading-relaxed">"{children}"</p>, strong: ({ children }: any) => <strong className="text-cyan-300 font-bold">{children}</strong> }}>{lesson.speakingChallenge || lesson.speakingTip}</ReactMarkdown>
          </div>
          <p className="text-xs text-gray-500">Say this sentence out loud 5 times. Confidence comes from practice! 💪</p>
        </div>
      )}

      {/* Complete button */}
      {showCompleteButton && !completed && (
        <button
          onClick={onComplete}
          disabled={completing}
          className="lifeos-btn w-full py-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500">
          <CheckCircle size={16} />
          {completing ? 'Saving...' : 'Mark Lesson Complete ✅'}
        </button>
      )}
    </div>
  );
}
