'use client';

// Layout da área Analítico — gate por MÓDULO (não por role).
//
// ANTES: createProtectedDashboardLayout({ requiredRole: 'admin' }) — travava a área
// inteira em admin e barrava funcionário COM módulo analítico, contradizendo o
// route-permissions (área liberada por módulo). Mesmo bug do estrategico/layout.
// Agora exige QUALQUER módulo da área; o resolver único expande os generics
// (analitico/relatorios/dashboard/home). Checagem fina por página fica no middleware.
import { ReactNode } from 'react';
import { MinimalLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const MODULOS_ANALITICO = [
  'analitico_clientes',
  'analitico_eventos',
  'analitico_artistico',
  'analitico',
  'relatorios',
];

export default function AnaliticoLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredModules={MODULOS_ANALITICO}>
      <MinimalLayout>{children}</MinimalLayout>
    </ProtectedRoute>
  );
}
