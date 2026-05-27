'use client';

import { ReactNode } from 'react';
import { DarkHeader } from './DarkHeader';
import { ModernSidebarOptimized } from './ModernSidebarOptimized';
import { BottomNavigation } from './BottomNavigation';
import AuthGuard from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DarkSidebarLayoutProps {
  children: ReactNode;
}

/**
 * DarkSidebarLayout - Layout principal com sidebar, header e navegação
 *
 * Renderiza diretamente sem o skeleton SSR→client duplo que existia antes
 * (custava LCP +200ms por causar paint do skeleton, depois re-paint do real).
 * Os children sao 'use client' e cuidam do proprio hydration.
 */
export function DarkSidebarLayout({ children }: DarkSidebarLayoutProps) {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          <DarkHeader />
          <div className="flex flex-1">
            <ModernSidebarOptimized />
            <main className="flex-1 transition-all duration-200 ease-in-out overflow-y-auto">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>
          <BottomNavigation />
        </div>
      </ErrorBoundary>
    </AuthGuard>
  );
}

export default DarkSidebarLayout;
