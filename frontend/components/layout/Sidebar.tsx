'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard, Dumbbell, Moon, CheckSquare, MessageSquare,
  Languages, BookOpen, BarChart3, FileText, Utensils, Zap, LogOut,
  Weight, Calendar, Brain, Settings, Sun, User,
} from 'lucide-react';
import { BottomNav } from './BottomNav';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/checkin', icon: Sun, label: 'Morning Check-in' },
      { href: '/coach', icon: MessageSquare, label: 'AI Coach' },
      { href: '/analytics', icon: BarChart3, label: 'Analytics' },
      { href: '/reports', icon: FileText, label: 'Reports' },
      { href: '/profile', icon: User, label: 'My Profile' },
    ],
  },
  {
    label: 'Fitness',
    items: [
      { href: '/fitness/program', icon: Calendar, label: 'My Program', badge: 'New' },
      { href: '/fitness/workout', icon: Dumbbell, label: 'Log Workout' },
      { href: '/fitness/weight', icon: Weight, label: 'Weight & Body' },
      { href: '/fitness/diet', icon: Utensils, label: 'Diet & Nutrition' },
      { href: '/sleep', icon: Moon, label: 'Sleep' },
      { href: '/habits', icon: CheckSquare, label: 'Habits' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/english', icon: Languages, label: 'English Coach' },
      { href: '/kannada', icon: Zap, label: 'Kannada Coach' },
      { href: '/career', icon: BookOpen, label: 'Career' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <>
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 bg-[#0d0d1a] border-r border-[#1e1e36] flex-col z-50">
      <div className="p-4 border-b border-[#1e1e36]">
        <h1 className="text-lg font-bold gradient-text">LIFEOS AI</h1>
        <p className="text-xs text-gray-500 mt-0.5">Life Operating System</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider px-3 mb-1 font-medium">{group.label}</p>
            {group.items.map(({ href, icon: Icon, label, badge }: any) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all
                    ${active
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e]'
                    }`}
                >
                  <Icon size={15} />
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[#1e1e36]">
        {session?.user && (
          <div className="flex items-center gap-2 mb-2">
            {session.user.image && (
              <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{session.user.name}</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Link href="/profile" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <User size={11} />
            Profile
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto"
          >
            <LogOut size={11} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
    <BottomNav />
    </>
  );
}
