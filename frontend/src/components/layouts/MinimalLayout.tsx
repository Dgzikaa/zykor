'use client';

import { ReactNode, useEffect, useState } from 'react';
import { MinimalHeader } from './MinimalHeader';
import { MinimalSidebar } from './MinimalSidebar';
import { BottomNavigation } from './BottomNavigation';
import AuthGuard from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface MinimalLayoutProps {
  children: ReactNode;
}

/**
 * MinimalLayout - Layout minimalista estilo Notion
 * 
 * Características:
 * - Fundo branco puro (sem cinza)
 * - Sidebar sem bordas pesadas
 * - Header clean com breadcrumb simples
 * - Sem containers/cards desnecessários
 * - Usa apenas HSL variables (sem hardcode)
 */
export function MinimalLayout({ children }: MinimalLayoutProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Loading skeleton
  if (!isClient) {
    return (
      <div className="min-h-screen bg-[hsl(var(--muted))] flex">
        <div className="hidden lg:block w-64 bg-[hsl(var(--muted))]" />
        <div className="flex-1 flex flex-col p-2">
          <div className="flex-1 flex flex-col bg-[hsl(var(--background))] rounded-lg shadow-sm border border-[hsl(var(--border))] overflow-hidden">
            <div className="h-16 bg-[hsl(var(--background))]" />
            <div className="flex-1 p-6 animate-pulse">
              <div className="space-y-4">
                <div className="h-8 bg-[hsl(var(--muted))] rounded w-1/3" />
                <div className="h-32 bg-[hsl(var(--muted))] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <div className="flex min-h-screen bg-[hsl(var(--muted))]">
          <MinimalSidebar />
          <div className="flex-1 flex flex-col overflow-hidden p-2">
            <div className="flex-1 flex flex-col overflow-hidden bg-[hsl(var(--background))] rounded-lg shadow-sm border border-[hsl(var(--border))]">
              <MinimalHeader />
              <main className="flex-1 overflow-y-auto">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </div>
          </div>
          <BottomNavigation />
        </div>
      </ErrorBoundary>
    </AuthGuard>
  );
}

export default MinimalLayout;

// Export também como SimpleDashboardLayout para compatibilidade
export { MinimalLayout as SimpleDashboardLayout };
