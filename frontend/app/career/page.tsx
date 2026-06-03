'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '@/lib/hooks/useApi';
import { cache } from '@/lib/cache';
import { Sidebar } from '@/components/layout/Sidebar';
import { CheckCircle2, Circle, Clock, BookOpen } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 border-emerald-600/40 bg-emerald-600/10',
  'in-progress': 'text-indigo-400 border-indigo-600/40 bg-indigo-600/10',
  'not-started': 'text-gray-500 border-[#2a2a4a] bg-[#12121e]',
};

export default function CareerPage() {
  const api = useApi();
  const [roadmap, setRoadmap] = useState<any>(null);
  const [logForm, setLogForm] = useState({ topic: '', durationMin: 30, notes: '' });
  const [saving, setSaving] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => { loadRoadmap(); }, []);

  async function loadRoadmap() {
    const hit = cache.get('career_roadmap');
    if (hit) setRoadmap(hit);
    try {
      const data = await api.getCareerRoadmap();
      setRoadmap(data);
      cache.set('career_roadmap', data, 5 * 60 * 1000);
    } catch {}
  }

  async function logStudy() {
    if (!logForm.topic || !logForm.durationMin) return;
    setSaving(true);
    try {
      await api.logStudy(logForm);
      loadRoadmap();
      setLogForm({ topic: '', durationMin: 30, notes: '' });
    } catch {} finally { setSaving(false); }
  }

  async function askCareerCoach() {
    if (!chatMsg.trim()) return;
    setChatLoading(true);
    try {
      const data = await api.careerChat(chatMsg);
      setChatReply(data.response || data);
      setChatMsg('');
    } catch {} finally { setChatLoading(false); }
  }

  const TOPICS = ['Docker', 'Linux', 'AWS', 'Terraform', 'Kubernetes', 'Jenkins', 'Python', 'LangChain', 'AI Agents', 'MCP Servers'];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Career Roadmap</h1>
        <p className="text-gray-400 text-sm mb-6">QA → Cloud / DevOps / AI Engineering</p>

        <div className="grid grid-cols-2 gap-6">
          {/* Roadmap */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-300">Progress</p>
              {roadmap && (
                <span className="text-xs text-indigo-400">{roadmap.careerScore}% complete · {roadmap.totalHours}hrs total</span>
              )}
            </div>
            <div className="space-y-2">
              {(roadmap?.roadmap || TOPICS.map((t, i) => ({ topic: t, order: i + 1, completion: 0, status: 'not-started', hoursStudied: 0, estimatedHours: 20 }))).map((item: any, i: number) => (
                <motion.div
                  key={item.topic}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${STATUS_COLORS[item.status]}`}
                >
                  <span className="text-xs font-mono text-gray-600 w-5 text-center">{item.order}</span>
                  {item.status === 'completed'
                    ? <CheckCircle2 size={16} className="text-emerald-400" />
                    : item.status === 'in-progress'
                    ? <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                    : <Circle size={16} className="text-gray-600" />}
                  <span className="flex-1 text-sm font-medium">{item.topic}</span>
                  <div className="text-right">
                    <p className="text-xs">{item.completion}%</p>
                    <p className="text-[10px] text-gray-600">{item.hoursStudied}/{item.estimatedHours}h</p>
                  </div>
                  <div className="w-16 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${item.completion}%`,
                      background: item.status === 'completed' ? '#10b981' : '#6366f1',
                    }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Log + Chat */}
          <div className="space-y-4">
            {/* Log study */}
            <div className="lifeos-card">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-indigo-400" />
                <p className="text-sm font-semibold text-gray-300">Log Study Session</p>
              </div>
              <select
                className="lifeos-input mb-2"
                value={logForm.topic}
                onChange={(e) => setLogForm((p) => ({ ...p, topic: e.target.value }))}
              >
                <option value="">Select topic...</option>
                {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  className="lifeos-input w-24"
                  placeholder="Mins"
                  value={logForm.durationMin}
                  onChange={(e) => setLogForm((p) => ({ ...p, durationMin: parseInt(e.target.value) || 0 }))}
                />
                <input
                  className="lifeos-input flex-1"
                  placeholder="Notes (optional)"
                  value={logForm.notes}
                  onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <button onClick={logStudy} disabled={saving || !logForm.topic} className="lifeos-btn w-full">
                {saving ? 'Saving...' : 'Log Session'}
              </button>
            </div>

            {/* Career coach chat */}
            <div className="lifeos-card">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-cyan-400" />
                <p className="text-sm font-semibold text-gray-300">Career Coach</p>
              </div>
              {chatReply && (
                <div className="bg-[#0a0a0f] border border-[#1e1e36] rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{chatReply}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="lifeos-input flex-1"
                  placeholder="Ask about Docker, AWS, career transition..."
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askCareerCoach()}
                />
                <button onClick={askCareerCoach} disabled={chatLoading} className="lifeos-btn px-3">
                  {chatLoading ? '...' : '→'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
