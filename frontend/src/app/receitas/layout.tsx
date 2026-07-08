'use client';

// Layout da área Receitas — mesmo shell (sidebar + header + seletor de bar) das demais áreas.
// Sem este layout, a página caía no root layout e abria "solta". Gate por MÓDULO (generics da
// área, expandidos pelo resolver único: receitas/relatorios/analitico/gestao/home).
import { ReactNode } from 'react';
import { MinimalLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const MODULOS_RECEITAS = [
  'receitas_dashboard_de_receitas',
  'receitas',
  'relatorios',
  'analitico',
  'gestao',
];

export default function ReceitasLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredModules={MODULOS_RECEITAS}>
      <MinimalLayout>{children}</MinimalLayout>
    </ProtectedRoute>
  );
}
