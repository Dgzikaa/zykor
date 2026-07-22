'use client';

// Comunicação vira o hub de mídia: "Visão geral" (KPIs) + abas do Instagram
// (Reels, Stories, Demografia) reaproveitando as páginas existentes. As abas são
// por rota, dentro do shell da área Receitas.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Images, Camera, Users, CalendarDays, Megaphone, Instagram } from 'lucide-react';
import { ComunicacaoPeriodoProvider } from './PeriodoContext';

const TABS = [
  { href: '/receitas/comunicacao', label: 'Instagram', icone: Instagram },
  { href: '/receitas/comunicacao/organico', label: 'Orgânico', icone: LayoutDashboard },
  { href: '/receitas/comunicacao/anuncios', label: 'Mídia', icone: Megaphone },
  { href: '/receitas/comunicacao/calendario', label: 'Calendário', icone: CalendarDays },
  { href: '/receitas/comunicacao/feed', label: 'Feed', icone: Images },
  { href: '/receitas/comunicacao/stories', label: 'Stories', icone: Camera },
  { href: '/receitas/comunicacao/demografia', label: 'Demografia', icone: Users },
];

export default function ComunicacaoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/receitas/comunicacao' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <ComunicacaoPeriodoProvider>
      <div className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <nav className="mx-auto flex items-center gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map(({ href, label, icone: Icone }) => {
            const ativo = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  ativo
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }`}
              >
                <Icone className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </ComunicacaoPeriodoProvider>
  );
}
