'use client';

import { useEffect } from 'react';
import { syncAuthData } from '@/lib/cookies';

/**
 * Componente para sincronizar automaticamente dados de autenticação
 * entre localStorage e cookies para que o middleware funcione corretamente
 * TODO(rodrigo/2026-05): sgb_user mantido apenas como cache durante migração
 */
export default function AuthSync() {
  useEffect(() => {
    // Função para sincronizar dados (cache)
    const syncUserData = () => {
      try {
        const userData = localStorage.getItem('sgb_user');
        if (userData) {
          const parsedData = JSON.parse(userData);
          if (parsedData && parsedData.id && parsedData.email) {
            syncAuthData(parsedData);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao sincronizar dados de auth:', error);
      }
    };

    // Sincronizar imediatamente
    syncUserData();

    // Listener para mudanças no localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sgb_user' && e.newValue) {
        syncUserData();
      }
    };

    // Listener customizado para mudanças internas
    const handleCustomUpdate = () => {
      syncUserData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataUpdated', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleCustomUpdate);
    };
  }, []);

  // Este componente não renderiza nada
  return null;
}
