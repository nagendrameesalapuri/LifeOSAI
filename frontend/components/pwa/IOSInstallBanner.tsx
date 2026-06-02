'use client';
import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      (navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed');

    if (isIOS && !isStandalone && !dismissed) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-[4.5rem] left-3 right-3 z-[200] animate-slide-up">
      <div className="bg-[#1a1a2e] border border-indigo-500/40 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20">
        <button
          onClick={() => { setShow(false); sessionStorage.setItem('pwa-banner-dismissed', '1'); }}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-300"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Add LIFEOS to Home Screen</p>
            <p className="text-xs text-gray-400 mt-1">
              Tap <Share size={11} className="inline text-indigo-400" /> then{' '}
              <span className="text-indigo-300 font-medium">"Add to Home Screen"</span> for the full
              app experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
