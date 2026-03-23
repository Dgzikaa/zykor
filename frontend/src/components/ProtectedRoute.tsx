'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield, ArrowLeft, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: string;
  requiredRole?: 'admin' | 'manager' | 'funcionario';
  requiredModules?: string[];
  fallbackUrl?: string;
  errorMessage?: string;
  showInlineError?: boolean; // Nova prop para controlar se mostra erro inline ou redireciona
}

export function ProtectedRoute({
  children,
  requiredModule,
  requiredRole,
  requiredModules = [],
  fallbackUrl = '/home',
  errorMessage = 'acesso_negado',
  showInlineError = true, // Por padrão mostra erro inline
}: ProtectedRouteProps) {
  const { user, hasPermission, hasAnyPermission, isRole, loading } =
    usePermissions();
  const router = useRouter();
  const [accessDenied, setAccessDenied] = useState(false);
  const [denialReason, setDenialReason] = useState<{
    type: 'role' | 'module' | 'modules';
    required: string;
    current?: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && user) {
      // Verificar role específico
      if (requiredRole && !isRole(requiredRole)) {
        setAccessDenied(true);
        setDenialReason({
          type: 'role',
          required: requiredRole,
          current: user.role,
        });

        if (!showInlineError) {
          router.push(
            `${fallbackUrl}?error=${errorMessage}&required_role=${requiredRole}`
          );
        }
        return;
      }

      // Verificar módulo específico
      if (requiredModule && !hasPermission(requiredModule)) {
        setAccessDenied(true);
        setDenialReason({
          type: 'module',
          required: requiredModule,
        });

        if (!showInlineError) {
          router.push(
            `${fallbackUrl}?error=${errorMessage}&required_module=${requiredModule}`
          );
        }
        return;
      }

      // Verificar múltiplos módulos
      if (requiredModules.length > 0 && !hasAnyPermission(requiredModules)) {
        setAccessDenied(true);
        setDenialReason({
          type: 'modules',
          required: requiredModules.join(', '),
        });

        if (!showInlineError) {
          router.push(
            `${fallbackUrl}?error=${errorMessage}&required_modules=${requiredModules.join(',')}`
          );
        }
        return;
      }

      setAccessDenied(false);
      setDenialReason(null);
    }
  }, [
    user,
    loading,
    hasPermission,
    hasAnyPermission,
    isRole,
    router,
    requiredModule,
    requiredRole,
    requiredModules,
    fallbackUrl,
    errorMessage,
    showInlineError,
  ]);

  // Mostrar loading enquanto verifica permissões
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se não tem usuário, não renderizar (será redirecionado)
  if (!user) {
    return null;
  }

  // Se acesso negado e deve mostrar erro inline
  if (accessDenied && showInlineError) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-start justify-center pt-32 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            {/* Ícone */}
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-6">
              <Shield className="w-8 h-8 text-slate-600" />
            </div>

            {/* Título */}
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Acesso Negado
            </h1>

            {/* Mensagem */}
            <p className="text-slate-600 mb-8 leading-relaxed">
              Você não tem permissão para acessar esta página.
            </p>

            {/* Botões */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full border-slate-300 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <Button
                onClick={() => router.push('/home')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Home className="w-4 h-4 mr-2" />
                Ir para Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se acesso negado mas não deve mostrar erro inline, não renderizar (foi redirecionado)
  if (accessDenied && !showInlineError) {
    return null;
  }

  // Se chegou até aqui, tem permissão
  return <>{children}</>;
}
