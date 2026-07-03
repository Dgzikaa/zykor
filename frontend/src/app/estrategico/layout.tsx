'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { MinimalLayout } from '@/components/layouts/MinimalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

interface EstrategicoLayoutProps {
  children: React.ReactNode;
}

/**
 * Módulos da área Estratégica (subitens do menu lateral). Ter QUALQUER um libera
 * a área — a checagem FINA por página fica no middleware (route-permissions). O
 * resolver único expande os generics da categoria (estrategico/gestao/dashboard/home),
 * então quem tem o hub genérico também passa.
 */
const MODULOS_ESTRATEGICO = [
  'estrategico_visao_geral',
  'estrategico_desempenho',
  'estrategico_planejamento',
  'estrategico_orcamentacao',
  'estrategico_metas',
  'estrategico_analytics',
];

/**
 * Layout para área Estratégica.
 *
 * ANTES gateava por `role === 'admin'`, o que expulsava (router.push('/home'))
 * qualquer funcionário COM módulo estratégico — contradizendo o route-permissions
 * (área liberada por módulo). Agora gateia por MÓDULO, alinhado ao guard do server.
 * Mantém a lógica específica para exibir mensagem de acesso restrito.
 */
export default function EstrategicoLayout({ children }: EstrategicoLayoutProps) {
  const router = useRouter();
  const { hasAnyPermission, loading } = usePermissions();

  const podeAcessar = hasAnyPermission(MODULOS_ESTRATEGICO);

  // Redirecionar se não tiver nenhum módulo da área (após carregamento)
  useEffect(() => {
    if (!loading && !podeAcessar) {
      router.push('/home');
    }
  }, [podeAcessar, router, loading]);

  // Loading state
  if (loading) {
    return (
      <MinimalLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--primary))] mx-auto mb-4" />
            <p className="text-[hsl(var(--muted-foreground))]">
              Carregando permissões...
            </p>
          </div>
        </div>
      </MinimalLayout>
    );
  }

  // Acesso negado
  if (!podeAcessar) {
    return (
      <MinimalLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <Alert className="border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--destructive))]" />
                <AlertDescription className="text-[hsl(var(--destructive))]">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5" />
                    <span className="font-semibold">Acesso Restrito</span>
                  </div>
                  <p>
                    Você não possui as permissões necessárias para acessar a
                    área Estratégica.
                  </p>
                  <p className="mt-2 text-sm">
                    Entre em contato com o administrador do sistema se você
                    acredita que deveria ter acesso a esta área.
                  </p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </MinimalLayout>
    );
  }

  // Layout normal
  return <MinimalLayout>{children}</MinimalLayout>;
}
