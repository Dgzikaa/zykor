'use client';

import { ReactNode } from 'react';
import { MinimalLayout } from './MinimalLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface CreateDashboardLayoutOptions {
  /** Módulo requerido para acesso (opcional) */
  requiredModule?: string;
  /** Role requerida para acesso (opcional) */
  requiredRole?: 'admin' | 'manager' | 'funcionario';
}

/**
 * Factory function para criar layouts de dashboard padronizados
 * 
 * Usa o MinimalLayout (estilo Notion) como padrão.
 * 
 * @example
 * // Em qualquer layout.tsx:
 * export { createDashboardLayout as default } from '@/components/layouts/createDashboardLayout';
 * 
 * @example
 * // Com permissões específicas:
 * import { createProtectedDashboardLayout } from '@/components/layouts/createDashboardLayout';
 * export default createProtectedDashboardLayout({ requiredRole: 'admin' });
 */

// Layout padrão simples (mais comum)
export function SimpleDashboardLayout({ children }: { children: ReactNode }) {
  return <MinimalLayout>{children}</MinimalLayout>;
}

// Função para criar layouts com proteção
export function createProtectedDashboardLayout(options: CreateDashboardLayoutOptions) {
  return function ProtectedDashboardLayout({ children }: { children: ReactNode }) {
    return (
      <ProtectedRoute 
        requiredModule={options.requiredModule}
        requiredRole={options.requiredRole}
      >
        <MinimalLayout>{children}</MinimalLayout>
      </ProtectedRoute>
    );
  };
}

// Export padrão para uso direto
export default SimpleDashboardLayout;

