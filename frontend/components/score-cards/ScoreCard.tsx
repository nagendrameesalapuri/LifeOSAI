'use client';
import { motion } from 'framer-motion';

interface ScoreCardProps {
  label: string;
  score: number;
  icon: string;
  color: string;
  sub?: string;
  delay?: number;
}

function getScoreColor(score: number) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#6366f1';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Average';
  if (score > 0) return 'Needs work';
  return 'Not started';
}

export function ScoreCard({ label, score, icon, color, sub, delay = 0 }: ScoreCardProps) {
  const scoreColor = getScoreColor(score);
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="lifeos-card hover:border-indigo-500/30 transition-all cursor-default"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
        <span className="text-lg">{icon}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12">
          <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#1e1e36" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke={scoreColor} strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
            {score}
          </span>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{score}<span className="text-sm text-gray-500">/100</span></p>
          <p className="text-xs" style={{ color: scoreColor }}>{getScoreLabel(score)}</p>
        </div>
      </div>
    </motion.div>
  );
}
