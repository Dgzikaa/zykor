'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Home, ArrowLeft, AlertCircle } from 'lucide-react';
import { getRoutePermission, hasRoutePermission } from '@/lib/route-permissions';

interface PermissionGuardProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rotas verificando permissões do usuário
 * Deve ser usado no layout raiz ou em layouts específicos
 */
export function PermissionGuard({ children }: PermissionGuardProps) {
  const { user, loading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [routeConfig, setRouteConfig] = useState<ReturnType<typeof getRoutePermission>>(null);

  useEffect(() => {
    // Rotas públicas que não precisam de verificação
    const publicRoutes = ['/login', '/auth'];
    if (publicRoutes.some(route => pathname.startsWith(route))) {
      setHasAccess(true);
      return;
    }

    if (!loading && user) {
      const config = getRoutePermission(pathname);
      setRouteConfig(config);

      if (!config) {
        // Rota sem configuração - permitir por padrão mas logar warning
        console.warn(`⚠️ Rota sem configuração de permissão: ${pathname}`);
        setHasAccess(true);
        return;
      }

      const permitted = hasRoutePermission(pathname, user);
      setHasAccess(permitted);
    }
  }, [user, loading, pathname]);

  // Mostrar loading enquanto verifica
  if (loading || hasAccess === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se não tem acesso, mostrar tela de erro
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            {/* Ícone */}
            <div className="mx-auto flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>

            {/* Título */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">
              Nenhum módulo disponível
            </h1>

            {/* Mensagem */}
            <div className="text-gray-600 dark:text-gray-400 mb-6 text-center space-y-2">
              <p>
                Você ainda não tem permissões atribuídas.
              </p>
              <p className="text-sm">
                Entre em contato com um administrador para liberar seu acesso aos módulos do sistema.
              </p>
            </div>

            {/* Info adicional */}
            {routeConfig && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <strong>Rota solicitada:</strong> {pathname}
                </p>
                {routeConfig.requiredModules && routeConfig.requiredModules.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>Módulos necessários:</strong> {routeConfig.requiredModules.join(', ')}
                  </p>
                )}
                {routeConfig.adminOnly && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Esta página é restrita apenas para administradores
                  </p>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <Button
                onClick={() => router.push('/home')}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
              >
                <Home className="w-4 h-4 mr-2" />
                Ir para Home
              </Button>
            </div>

            {/* Info do usuário */}
            {user && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Logado como: <strong>{user.nome}</strong> ({user.role})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Se tem acesso, renderizar conteúdo
  return <>{children}</>;
}
