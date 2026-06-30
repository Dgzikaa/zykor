'use client';

// Layout para operacional com proteção de módulo.
//
// Regra geral: TODO /operacional/* exige o módulo `operacoes`.
// Exceção: /operacional/producoes também é liberado pelo módulo dedicado
// `operacional_producoes` — o perfil de cozinha/kiosk (tablets) recebe SÓ esse
// token, então acessa a tela de Controle de Produção (e salva), mas NÃO entra
// nas demais telas de /operacional/* (que continuam exigindo `operacoes`).
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MinimalLayout } from '@/components/layouts';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function OperacionalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isProducoes = pathname?.startsWith('/operacional/producoes') ?? false;

  return (
    <ProtectedRoute
      requiredModules={
        isProducoes ? ['operacoes', 'operacional_producoes'] : ['operacoes']
      }
    >
      <MinimalLayout>{children}</MinimalLayout>
    </ProtectedRoute>
  );
}
