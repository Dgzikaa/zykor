'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Componente que detecta quando há uma nova versão do app disponível
 * e oferece ao usuário a opção de atualizar.
 * 
 * Funciona verificando se o Service Worker foi atualizado.
 */
export function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (registration) {
          // Verificar atualizações
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nova versão instalada, mas ainda não ativa
                  console.log('[VersionChecker] Nova versão disponível!');
                  setUpdateAvailable(true);
                }
              });
            }
          });

          // Forçar check de atualização
          registration.update().catch(console.error);
        }

        // Também verificar se já há um worker esperando
        if (registration?.waiting) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('[VersionChecker] Erro:', error);
      }
    };

    // Verificar ao carregar
    checkForUpdates();

    // Verificar periodicamente (a cada 5 minutos)
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    // Listener para quando a página ganha foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        // Envia mensagem para o SW ativar imediatamente
        registration.waiting.postMessage('skipWaiting');
      }

      // Aguarda um momento e recarrega
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('[VersionChecker] Erro ao atualizar:', error);
      // Em caso de erro, simplesmente recarrega
      window.location.reload();
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-blue-600 text-white rounded-lg shadow-xl p-4 flex items-start gap-3">
        <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Nova versão disponível!</p>
          <p className="text-xs text-blue-100 mt-0.5">
            Clique em atualizar para obter as últimas melhorias.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleUpdate}
              className="bg-white text-blue-600 hover:bg-blue-50 text-xs h-7 px-3"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Atualizar agora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="text-blue-100 hover:text-white hover:bg-blue-500 text-xs h-7 px-2"
            >
              Depois
            </Button>
          </div>
        </div>
        <button 
          onClick={() => setDismissed(true)}
          className="text-blue-200 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
