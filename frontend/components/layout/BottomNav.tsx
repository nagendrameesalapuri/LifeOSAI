'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import {
  LayoutDashboard, Dumbbell, MessageSquare, BookOpen,
  MoreHorizontal, X, Weight, Utensils, Moon, CheckSquare,
  Languages, Zap, BarChart3, FileText, Settings, LogOut,
  User, Sun,
} from 'lucide-react';

// Primary tabs always visible
const PRIMARY = [
  { href: '/dashboard',       icon: LayoutDashboard, label: 'Home' },
  { href: '/fitness/program', icon: Dumbbell,        label: 'Fitness' },
  { href: '/coach',           icon: MessageSquare,   label: 'Coach' },
  { href: '/english',         icon: BookOpen,        label: 'Learn' },
];

// Secondary items shown in the "More" sheet
const MORE_GROUPS = [
  {
    label: 'Fitness',
    items: [
      { href: '/fitness/workout', icon: Dumbbell,    label: 'Log Workout' },
      { href: '/fitness/weight',  icon: Weight,      label: 'Weight & Body' },
      { href: '/fitness/diet',    icon: Utensils,    label: 'Diet & Nutrition' },
      { href: '/sleep',           icon: Moon,        label: 'Sleep' },
      { href: '/habits',          icon: CheckSquare, label: 'Habits' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/kannada', icon: Zap,       label: 'Kannada Coach' },
      { href: '/career',  icon: BookOpen,  label: 'Career' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/analytics', icon: BarChart3, label: 'Analytics' },
      { href: '/reports',   icon: FileText,  label: 'Reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/profile', icon: User, label: 'My Profile' },
      { href: '/checkin', icon: Sun,  label: 'Check-in' },
    ],
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-center"
        style={{
          background: 'rgba(8,8,18,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {PRIMARY.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors
                ${active ? 'text-indigo-400' : 'text-gray-500 active:text-gray-300'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[10px] font-medium ${active ? 'text-indigo-400' : 'text-gray-600'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors
            ${open ? 'text-indigo-400' : 'text-gray-500 active:text-gray-300'}`}
        >
          <MoreHorizontal size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium text-gray-600">More</span>
        </button>
      </nav>

      {/* More sheet backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* More sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[110] md:hidden rounded-t-2xl
          transition-transform duration-300 ease-out
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(10,10,20,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 -16px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#2a2a4a] rounded-full" />
        </div>

        {/* User info + sign-out */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e36]">
          <div className="flex items-center gap-2">
            {session?.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div>
              <p className="text-sm font-medium text-white">{session?.user?.name || 'LIFEOS'}</p>
              <p className="text-xs text-gray-500">{session?.user?.email}</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)}>
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Nav groups */}
        <div className="overflow-y-auto max-h-[60vh] px-3 py-3 space-y-4">
          {MORE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider px-2 mb-1.5 font-medium">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.items.map(({ href, icon: Icon, label }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all
                        ${active
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                          : 'bg-[#12121e] text-gray-300 active:bg-[#1a1a2e]'
                        }`}
                    >
                      <Icon size={15} />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-[#1e1e36]">
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Settings size={15} />
            Settings
          </Link>
          <button
            onClick={() => { setOpen(false); signOut({ callbackUrl: '/auth/sign-in' }); }}
            className="flex items-center gap-2 text-sm text-gray-400 ml-auto"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
