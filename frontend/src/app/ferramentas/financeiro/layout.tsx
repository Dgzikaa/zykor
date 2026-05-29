'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Receipt, FileText, Wallet, CreditCard, TrendingDown,
  Calculator, Target, Tag, Building2, Activity,
} from 'lucide-react';

const TABS = [
  { href: '/ferramentas/financeiro/lancamentos', label: 'Lançamentos', icone: Receipt },
  { href: '/ferramentas/financeiro/dre', label: 'DRE', icone: FileText },
  { href: '/ferramentas/financeiro/fluxo-caixa', label: 'Fluxo Caixa 90d', icone: Wallet },
  { href: '/ferramentas/financeiro/conciliacao', label: 'Conciliação', icone: CreditCard },
  { href: '/ferramentas/financeiro/contas', label: 'Contas Pagar/Receber', icone: TrendingDown },
  { href: '/ferramentas/financeiro/cmv', label: 'CMV', icone: Calculator },
  { href: '/ferramentas/financeiro/orcamentacao', label: 'Orçamentação', icone: Target },
  { href: '/ferramentas/financeiro/categorias', label: 'Categorias', icone: Tag },
  { href: '/ferramentas/financeiro/centros-custo', label: 'Centros Custo', icone: Building2 },
  { href: '/ferramentas/financeiro/sync', label: 'Saúde Sync', icone: Activity },
];

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
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
                    ? 'border-emerald-600 text-emerald-600'
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
