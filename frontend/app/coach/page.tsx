'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { Send, Bot, User, X, MessageCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'What should I eat today based on my goals?',
  'Generate my workout plan for today',
  'How am I doing this week?',
  'What should I study next in my career path?',
  'Give me a language lesson',
  'Correct my English: I am going gym yesterday',
];

export default function CoachPage() {
  const api = useApi();
  const [profile, setProfile] = useState<any>(null);
  const [showTelegramBanner, setShowTelegramBanner] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hey! I'm your LIFEOS AI Coach.\n\nI know your goals, workout history, sleep patterns, and progress. I learn from every session you log.\n\nAsk me anything or use a quick prompt below. I'll give you specific, data-driven answers — not generic advice.`,
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date() };
    // Build history excluding the initial welcome message
    const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Add empty assistant message to stream into
    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const token = await api.getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${apiUrl}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            fullText += parsed.text || '';
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...assistantMsg, content: fullText };
              return updated;
            });
          } catch (parseErr: any) {
            // Re-throw server-sent errors so the outer catch can show them to the user.
            // Ignore JSON parse errors from partial/malformed SSE frames.
            if (parseErr.message && !parseErr.message.startsWith('JSON')) throw parseErr;
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...assistantMsg, content: `Sorry, something went wrong: ${e.message}` };
        return updated;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh' }}>
      <Sidebar />

      {/* Main chat column — fills remaining height, never overflows */}
      <main
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ marginLeft: 'var(--sidebar-offset, 0)' }}
      >

        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            background: 'rgba(8,8,18,0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-indigo-400" />
          </div>

          {/* title — min-w-0 allows the text to shrink/truncate instead of overflowing */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">LIFEOS AI Coach</p>
            <p className="text-[11px] text-gray-500 truncate">
              Knows your history · Always honest · Never gives up on you
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-gray-500">Online</span>
          </div>
        </div>

        {/* ── Telegram Banner ─────────────────────────────────── */}
        <AnimatePresence>
          {showTelegramBanner && !profile?.telegramChatId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-cyan-500/10 border-b border-cyan-500/20"
            >
              <MessageCircle size={14} className="text-cyan-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cyan-300 font-medium">Log from anywhere — get the LIFEOS Telegram Bot</p>
                <p className="text-[10px] text-gray-500">Check in, log meals, and chat with your AI coach from Telegram</p>
              </div>
              <a
                href="/onboarding"
                className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-1 hover:bg-cyan-500/20 transition-colors flex-shrink-0"
              >
                Setup
              </a>
              <button onClick={() => setShowTelegramBanner(false)} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Messages — flex-1 + min-h-0 enables inner scroll ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                  ${msg.role === 'assistant'
                    ? 'bg-indigo-600/20 border border-indigo-500/30'
                    : 'bg-gray-700/60'}`}
                >
                  {msg.role === 'assistant'
                    ? <Bot size={14} className="text-indigo-400" />
                    : <User size={14} className="text-gray-300" />}
                </div>

                {/* Bubble — max-w-[80%] + overflow-wrap prevents horizontal overflow */}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words
                    ${msg.role === 'assistant'
                      ? 'bg-[#12121e] border border-white/[0.07] text-gray-200'
                      : 'bg-indigo-600 text-white'}`}
                  style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${msg.role === 'assistant' ? 'text-gray-600' : 'text-indigo-200'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming cursor on last assistant message */}
          {loading && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-indigo-400" />
              </div>
              <div className="bg-[#12121e] border border-white/[0.07] rounded-2xl px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Quick prompts ───────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-3 pt-2 pb-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="flex-shrink-0 text-[11px] text-gray-400 hover:text-white rounded-full px-3 py-1.5 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ── Input bar ───────────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-3 pt-2 pb-3 md:pb-3"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(8,8,18,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="lifeos-input flex-1 min-w-0"
              placeholder="Ask anything — fitness, career, English, Kannada..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="lifeos-btn flex-shrink-0 px-3 py-2"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
