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

  // setupSessionSync registra storage listener + setInterval(5min) — deve rodar
  // UMA VEZ no mount, nao a cada route change (vazava intervals/listeners).
  useEffect(() => {
    return setupSessionSync();
  }, []);

  // Validacao da sessao por rota (pula /login).
  useEffect(() => {
    if (pathname === '/login') return;

    let cancelled = false;
    validateAndSyncSession().then((isValid) => {
      if (cancelled) return;
      if (!isValid) {
        console.log('⚠️ Sessão inválida, redirecionando para login...');
        router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
