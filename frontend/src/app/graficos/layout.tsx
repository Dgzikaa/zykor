'use client';

// Layout da área /graficos — mesmo shell (sidebar + header + seletor de bar) das demais áreas.
// Sem este layout, a página caía no root layout e abria "solta". Guard por rota espelha o
// middleware (getRoutePermission), igual ao layout de /operacional.
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MinimalLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getRoutePermission } from '@/lib/route-permissions';

export default function GraficosLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/graficos';
  const routeCfg = getRoutePermission(pathname);
  const requiredModules = routeCfg?.requiredModules ?? ['gestao', 'home'];
  return (
    <ProtectedRoute requiredModules={requiredModules}>
      <MinimalLayout>{children}</MinimalLayout>
    </ProtectedRoute>
  );
}
