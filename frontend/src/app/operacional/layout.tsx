'use client';

// Layout da área /operacional.
//
// A área hospeda DUAS famílias de permissão: as telas operacionais propriamente ditas
// (módulo `operacoes`) e as telas de CMV (`producao - cmv_*`), além do perfil de
// cozinha/kiosk (`operacional_producoes`, só Controle de Produção).
//
// Em vez de manter uma lista própria (que diverge do servidor), o gate da ÁREA espelha
// EXATAMENTE o guard por rota do middleware, usando a MESMA fonte (`getRoutePermission`
// de route-permissions). Consequência: layout e middleware nunca divergem —
//   • perfis de produção (só controle_de_producao/operacional_producoes) ficam restritos
//     a /operacional/producoes e NADA além do módulo marcado;
//   • usuários de CMV acessam exatamente as telas dos módulos que possuem;
//   • defense-in-depth: a checagem por rota vale no cliente E no servidor.
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MinimalLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getRoutePermission } from '@/lib/route-permissions';

export default function OperacionalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/operacional';

  // Mesma resolução do middleware (exato → prefixo). Fallback conservador: `operacoes`.
  const routeCfg = getRoutePermission(pathname);
  const requiredModules = routeCfg?.requiredModules ?? ['operacoes'];

  return (
    <ProtectedRoute requiredModules={requiredModules}>
      <MinimalLayout>{children}</MinimalLayout>
    </ProtectedRoute>
  );
}
