'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Award, ChefHat, Layers, Trophy, Flame, Compass,
  ShieldAlert, Wallet, FileText,
} from 'lucide-react';

const TABS = [
  { href: '/ferramentas/analises/quality', label: 'Quality Score', icone: Award },
  { href: '/ferramentas/analises/cardapio', label: 'Engenharia Cardápio', icone: ChefHat },
  { href: '/ferramentas/analises/combos', label: 'Combos', icone: Layers },
  { href: '/ferramentas/analises/garcons', label: 'Garçons', icone: Trophy },
  { href: '/ferramentas/analises/heatmap', label: 'Mapa de Calor', icone: Flame },
  { href: '/ferramentas/analises/previsao', label: 'Previsão', icone: Compass },
  { href: '/ferramentas/analises/integridade', label: 'Integridade', icone: ShieldAlert },
  { href: '/ferramentas/analises/fluxo-caixa', label: 'Fluxo Caixa 90d', icone: Wallet },
  { href: '/ferramentas/analises/conciliacao', label: 'Conciliação', icone: Wallet },
  { href: '/ferramentas/analises/relatorio-ia', label: 'Relatório IA', icone: FileText },
];

export default function AnalisesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <div className="sticky top-0 z-20 bg-[hsl(var(--background))] border-b">
        <nav className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icone: Icone }) => {
            const ativo = isActive(href);
            return (
              <Link
                key={href} href={href}
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
