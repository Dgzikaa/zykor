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
 * Layout para área Estratégica - requer role admin
 * 
 * Este layout tem lógica específica de permissões que não pode ser simplificada
 * para o padrão genérico, pois precisa mostrar mensagem de acesso restrito.
 */
export default function EstrategicoLayout({ children }: EstrategicoLayoutProps) {
  const router = useRouter();
  const { isRole, loading } = usePermissions();

  const isAdmin = isRole('admin');

  // Redirecionar se não for admin (após carregamento)
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/home');
    }
  }, [isAdmin, router, loading]);

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
  if (!isAdmin) {
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
                    Esta seção é exclusiva para administradores. Você não possui
                    as permissões necessárias para acessar a área Estratégica.
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
