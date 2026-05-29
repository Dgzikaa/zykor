'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Crown, Megaphone, AlertTriangle } from 'lucide-react';

const TABS = [
  { href: '/analitico/clientes', label: 'Visão Geral', icone: Users },
  { href: '/analitico/clientes/clube', label: 'Clube Ordi', icone: Crown },
  { href: '/analitico/clientes/em-queda', label: 'Em queda', icone: AlertTriangle },
  { href: '/analitico/clientes/campanhas', label: 'Campanhas Clube', icone: Megaphone },
];

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/analitico/clientes') return pathname === href;
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
