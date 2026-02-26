'use client';

import { ReactNode } from 'react';
import { DarkHeader } from './DarkHeader';
import { ModernSidebarOptimized } from './ModernSidebarOptimized';
import { BottomNavigation } from './BottomNavigation';
import AuthGuard from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * DashboardLayout - Layout principal para todas as rotas autenticadas
 * 
 * Este componente:
 * - Aplica o AuthGuard para proteção de rotas
 * - Renderiza Header, Sidebar e BottomNav
 * - Gerencia o estado de loading inicial
 * 
 * Usado automaticamente pelo route group (dashboard)/layout.tsx
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <DarkHeader />
          <div className="flex flex-1">
            <ModernSidebarOptimized />
            <main className="flex-1 transition-all duration-300 ease-in-out overflow-y-auto">
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

export default DashboardLayout;

