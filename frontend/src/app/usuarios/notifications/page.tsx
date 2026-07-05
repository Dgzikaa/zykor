'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Página antiga de notificações — consolidada na Central de Notificações
 * (/configuracoes/notifications). Mantida apenas como redirect para não quebrar
 * links/histórico.
 */
export default function NotificationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/configuracoes/notifications');
  }, [router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
      Redirecionando para a Central de Notificações...
    </div>
  );
}
