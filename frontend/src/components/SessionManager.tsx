'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setupSessionSync, validateAndSyncSession } from '@/lib/auth/session-manager';

/**
 * Componente para gerenciar sessão globalmente
 * Garante que a sessão seja mantida consistente em todas as páginas
 */
export function SessionManager() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Configurar sincronização de sessão entre abas
    setupSessionSync();

    // Verificar sessão ao montar
    const checkSession = async () => {
      // Não verificar na página de login
      if (pathname === '/login') return;

      const isValid = await validateAndSyncSession();
      
      if (!isValid && pathname !== '/login') {
        console.log('⚠️ Sessão inválida, redirecionando para login...');
        router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
      }
    };

    checkSession();
  }, [pathname, router]);

  return null;
}
