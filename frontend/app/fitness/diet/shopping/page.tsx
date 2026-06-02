'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { Sidebar } from '@/components/layout/Sidebar';
import { ShoppingCart, Loader2, CheckSquare, RefreshCw } from 'lucide-react';

export default function ShoppingListPage() {
  const api = useApi();
  const [list, setList] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.getShoppingList().then(setList).catch(console.error).finally(() => setLoading(false));
  }, []);

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-56 flex-1 p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Weekly Shopping List</h1>
            <p className="text-gray-400 text-sm">Everything you need for lean bulking this week</p>
          </div>
          <button onClick={() => { setLoading(true); api.getShoppingList().then(setList).finally(() => setLoading(false)); }}
            className="lifeos-btn-ghost flex items-center gap-2 text-xs">
            <RefreshCw size={13} />
            Regenerate
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="lifeos-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-gray-300">This Week's Groceries</h3>
                </div>
                {list?.estimatedCostRs && (
                  <span className="text-sm font-bold text-emerald-400">~₹{list.estimatedCostRs}/week</span>
                )}
              </div>

              <div className="space-y-2">
                {(list?.weekly || []).map((item: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      checked.has(i)
                        ? 'border-emerald-600/30 bg-emerald-600/10'
                        : 'border-[#1e1e36] bg-[#0d0d1a] hover:border-indigo-600/30'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      checked.has(i) ? 'bg-emerald-600 border-emerald-600' : 'border-gray-600'
                    }`}>
                      {checked.has(i) && <CheckSquare size={12} className="text-white" />}
                    </div>
                    <span className={`text-sm ${checked.has(i) ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                      {item}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-[#1e1e36]">
                <p className="text-xs text-gray-500">
                  {checked.size} of {(list?.weekly || []).length} items checked · {(list?.weekly || []).length - checked.size} remaining
                </p>
              </div>
            </div>

            {/* Tips */}
            <div className="lifeos-card">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Smart Shopping Tips</h3>
              <div className="space-y-2">
                {[
                  'Buy chicken in bulk (500g+) — cheaper per kg and lasts the week',
                  'Eggs are your best protein per rupee — buy at least 12',
                  'Cook rice and dal in advance — saves time during the week',
                  'Curd is your bedtime protein (casein) — 200g before sleep',
                  'Oats for breakfast = cheap, high protein, keeps you full',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5">•</span>
                    {tip}
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
