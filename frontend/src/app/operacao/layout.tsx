'use client';

// Layout da área /operacao (Plano Operacional, Escala, Planejado × Realizado).
//
// Faltava este arquivo e por isso as telas subiram SEM sidebar e SEM header — dava pra
// abrir a página, mas não pra navegar pro resto do sistema. Toda área tem o seu; a de
// /operacao passou batido quando criei a seção.
//
// O gate espelha EXATAMENTE o guard por rota do middleware, usando a mesma fonte
// (`getRoutePermission`), como em /operacional. Assim layout e servidor nunca divergem:
// quem tem só `operacao_escala` não entra no Plano pela URL.
//
// A largura fica por conta do PageShell width="wide" (max-w-none) de cada página — as
// grades aqui são densas e precisam da tela inteira.

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { SimpleDashboardLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getRoutePermission } from '@/lib/route-permissions';

export default function OperacaoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/operacao/plano';

  // Mesma resolução do middleware (exato → prefixo). Fallback conservador: a seção inteira.
  const routeCfg = getRoutePermission(pathname);
  const requiredModules = routeCfg?.requiredModules ?? ['operacao'];

  return (
    <ProtectedRoute requiredModules={requiredModules}>
      <SimpleDashboardLayout>
        <div className="flex items-center gap-2 border-b border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            <strong>Módulo Operação em construção.</strong> Substituindo as planilhas de plano
            operacional e escala — o histórico de 2026 já está aqui. Feedback é bem-vindo!
          </span>
        </div>
        {children}
      </SimpleDashboardLayout>
    </ProtectedRoute>
  );
}
