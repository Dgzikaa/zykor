'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/contexts/PageTitleContext';

const CRM_TABS = [
  { label: 'Visão Geral', href: '/ferramentas/crm' },
  { label: 'Umbler Talk', href: '/ferramentas/crm/umbler' },
  { label: 'Segmentação RFM', href: '/ferramentas/crm/inteligente' },
  { label: 'Predição de Churn', href: '/ferramentas/crm/churn-prediction' },
  { label: 'LTV e Engajamento', href: '/ferramentas/crm/ltv-engajamento' },
  { label: 'Padrões de Comportamento', href: '/ferramentas/crm/padroes-comportamento' },
];

export default function FerramentasCRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('CRM');
  }, [setPageTitle]);

  return (
    <div className="space-y-3">
      <div className="container mx-auto px-2 py-1 max-w-[98vw]">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {CRM_TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'text-xs sm:text-sm px-3 py-1.5 rounded-md border transition-all whitespace-nowrap font-medium',
                    isActive
                      ? 'bg-muted text-foreground border-border shadow-none'
                      : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800'
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

