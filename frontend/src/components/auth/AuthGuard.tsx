'use client';

import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  requiredPermissions?: string[];
}

export default function AuthGuard({
  children,
  redirectTo = '/login',
  requiredPermissions = [],
}: AuthGuardProps) {
  const { user, loading: userLoading, isInitialized } = useUser();
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [contextWaitCount, setContextWaitCount] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      // Aguardar até que os dados do usuário sejam inicializados
      if (!isInitialized || userLoading) {
        return;
      }

      // Se não há usuário, verificar localStorage diretamente antes de redirecionar
      if (!user) {
        // Verificação dupla para evitar loop infinito
        try {
          // TODO(rodrigo/2026-05): sgb_user é apenas cache, fonte de verdade é JWT via UserContext
          const userData = localStorage.getItem('sgb_user');
          console.log(
            '🔍 AuthGuard: Verificando cache localStorage...',
            userData ? 'Dados encontrados' : 'Nenhum dado'
          );

          if (userData) {
            const parsedUser = JSON.parse(userData);
            console.log('🔍 AuthGuard: Dados parseados (cache):', parsedUser);

            if (
              parsedUser &&
              parsedUser.id &&
              parsedUser.email &&
              parsedUser.nome
            ) {
              // Usuário existe no localStorage, aguardar o contexto se atualizar
              console.log(
                '🔄 Usuário encontrado no localStorage, aguardando contexto... (tentativa:',
                contextWaitCount + 1,
                ')'
              );

              // Tentar forçar o contexto a recarregar os dados
              const contextRefresh = new CustomEvent('refreshUserContext');
              window.dispatchEvent(contextRefresh);

              // Incrementar contador de espera
              setContextWaitCount(prev => prev + 1);

              // Se já aguardou muito tempo, permitir acesso direto
              if (contextWaitCount > 5) {
                console.log(
                  '⚠️ AuthGuard: Timeout aguardando contexto, permitindo acesso direto'
                );
                setIsAuthenticating(false);
                return;
              }

              return;
            } else {
              console.log('⚠️ AuthGuard: Dados inválidos no localStorage');
            }
          } else {
            console.log('🔍 AuthGuard: Nenhum dado no localStorage');
          }
        } catch (error) {
          console.error('❌ AuthGuard: Erro ao verificar localStorage:', error);
        }

        // Se realmente não há usuário, definir para redirecionar
        if (!shouldRedirect) {
          console.log(
            '🔒 Usuário não autenticado, agendando redirecionamento...'
          );
          setShouldRedirect(true);
          // Aguardar um pouco antes de redirecionar para evitar loop
          setTimeout(() => {
            router.push(redirectTo);
          }, 100);
          return;
        }
        return;
      }

      // Verificar permissões se necessário
      if (requiredPermissions.length > 0) {
        const hasRequiredPermissions = requiredPermissions.some(permission => {
          if (!user.modulos_permitidos) return false;

          // Se modulos_permitidos é um array
          if (Array.isArray(user.modulos_permitidos)) {
            return user.modulos_permitidos.includes(permission);
          }

          // Se modulos_permitidos é um objeto
          if (typeof user.modulos_permitidos === 'object') {
            return user.modulos_permitidos[permission] === true;
          }

          return false;
        });

        if (!hasRequiredPermissions) {
          console.log(
            '🚫 Usuário não tem permissões necessárias:',
            requiredPermissions
          );
          router.push('/home'); // Redirecionar para uma página permitida
          return;
        }
      }

      // Verificar se o usuário está ativo
      if (!user.ativo) {
        console.log('⚠️ Usuário inativo, redirecionando para login');
        router.push(redirectTo);
        return;
      }

      // Tudo ok, permitir acesso
      setShouldRedirect(false);
      setContextWaitCount(0);
      setIsAuthenticating(false);
    };

    checkAuth();
  }, [
    user,
    userLoading,
    isInitialized,
    shouldRedirect,
    contextWaitCount,
    router,
    redirectTo,
    requiredPermissions,
  ]);

  // Mostrar loading enquanto autentica
  if (isAuthenticating || userLoading || !isInitialized) {
    return <AuthLoadingScreen />;
  }

  // Se chegou até aqui, usuário está autenticado e com permissões
  return <>{children}</>;
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[hsl(var(--border))] border-t-[hsl(var(--primary))] rounded-full animate-spin mx-auto mb-4"></div>
        <div className="space-y-2">
          <p className="text-lg font-medium text-[hsl(var(--foreground))]">
            Carregando suas informações...
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Aguarde enquanto verificamos suas permissões
          </p>
        </div>
      </div>
    </div>
  );
}
