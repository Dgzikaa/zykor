import type { ReactNode } from 'react';

type Width = 'wide' | 'comfortable' | 'narrow';

// Tiers de largura — a largura segue o TIPO de conteúdo:
//  - 'wide'        → aproveita a tela toda (tabelas/dashboards densos: plano, desvios, CMV…)
//  - 'comfortable' → max-w-7xl centralizado (forms, leitura) [default]
//  - 'narrow'      → max-w-3xl (forms curtos)
const WIDTHS: Record<Width, string> = {
  wide: 'max-w-none',
  comfortable: 'max-w-7xl',
  narrow: 'max-w-3xl',
};

/**
 * Shell padrão de página: fundo + padding + container de largura por tier.
 * Substitui o par `<div min-h-screen…><div max-w-7xl mx-auto space-y-4>` repetido nas páginas.
 */
export function PageShell({ width = 'comfortable', className = '', children }: {
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className={`mx-auto space-y-4 ${WIDTHS[width]} ${className}`}>
        {children}
      </div>
    </div>
  );
}
