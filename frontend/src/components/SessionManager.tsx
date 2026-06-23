'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setupSessionSync, validateAndSyncSession } from '@/lib/auth/session-manager';
import { isPublicRoute } from '@/lib/auth/public-routes';

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

  // Validacao da sessao por rota (pula rotas publicas: /login, /auth, redefinir-senha).
  // CRÍTICO: a redefinição de senha (1º acesso) roda SEM sessão — se não for pública,
  // o usuário é jogado de volta pro /login em loop ao tentar criar a senha.
  useEffect(() => {
    if (isPublicRoute(pathname)) return;

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
