'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sparkles,
  PlayCircle,
  Camera,
  Users,
  DollarSign,
} from 'lucide-react';

const TABS = [
  { href: '/marketing/instagram', label: 'Dashboard', icone: LayoutDashboard },
  { href: '/marketing/instagram/ig-roi', label: 'ROI por post', icone: DollarSign },
  { href: '/marketing/instagram/ai-insights', label: 'IA Insights', icone: Sparkles },
  { href: '/marketing/instagram/reels', label: 'Reels', icone: PlayCircle },
  { href: '/marketing/instagram/stories', label: 'Stories', icone: Camera },
  { href: '/marketing/instagram/demografia', label: 'Demografia', icone: Users },
];

export default function InstagramLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/marketing/instagram') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      <div className="sticky top-0 z-20 bg-[hsl(var(--background))] border-b">
        <nav className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icone: Icone }) => {
            const ativo = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  ativo
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                <Icone className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </>
  );
}
