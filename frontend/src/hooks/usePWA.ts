import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  isOnline: boolean;
  isLoading: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  notificationPermission: NotificationPermission;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
}

interface PWAActions {
  install: () => Promise<boolean>;
  enableNotifications: () => Promise<boolean>;
  showNotification: (
    title: string,
    options?: NotificationOptions
  ) => Promise<void>;
  updateServiceWorker: () => Promise<void>;
  clearCache: () => Promise<void>;
  checkForUpdates: () => Promise<boolean>;
}

export function usePWA(): PWAState & PWAActions {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOffline: false,
    isOnline:
      typeof window !== 'undefined' && navigator ? navigator.onLine : true,
    isLoading: true,
    installPrompt: null,
    notificationPermission: 'default',
    serviceWorkerRegistration: null,
  });

  // Detectar se PWA está instalada
  const detectInstallation = useCallback(() => {
    if (typeof window === 'undefined') return;

    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true ||
      document.referrer.includes('android-app://');

    setState(prev => ({ ...prev, isInstalled }));
  }, []);

  // Antes registrava /sw.js (cache-first sem TTL = stale data por dias).
  // Projeto nao usa PWA real — agora desregistra qualquer SW e limpa caches.
  // Mantem assinatura pra nao quebrar callers.
  const registerServiceWorker =
    useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator))
        return null;

      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch { /* swallow */ }

      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* swallow */ }

      setState(prev => ({
        ...prev,
        serviceWorkerRegistration: null,
      }));

      return null;
    }, []);

  // Detectar conectividade
  const handleOnline = useCallback(() => {
    setState(prev => ({ ...prev, isOnline: true, isOffline: false }));
  }, []);

  const handleOffline = useCallback(() => {
    setState(prev => ({ ...prev, isOnline: false, isOffline: true }));
  }, []);

  // Detectar prompt de instalação
  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();
    const installEvent = e as BeforeInstallPromptEvent;
    setState(prev => ({
      ...prev,
      installPrompt: installEvent,
      isInstallable: true,
    }));
  }, []);

  // Função para instalar PWA
  const install = useCallback(async (): Promise<boolean> => {
    if (!state.installPrompt) {
      return false;
    }

    try {
      await state.installPrompt.prompt();
      const choiceResult = await state.installPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        setState(prev => ({
          ...prev,
          installPrompt: null,
          isInstallable: false,
          isInstalled: true,
        }));
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('❌ PWA: Erro durante instalação:', error);
      return false;
    }
  }, [state.installPrompt]);

  // Habilitar notificações
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, notificationPermission: permission }));

      if (permission === 'granted') {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(
        '❌ PWA: Erro ao solicitar permissão de notificação:',
        error
      );
      return false;
    }
  }, []);

  // Mostrar notificação
  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (state.notificationPermission !== 'granted') {
        return;
      }

      if (state.serviceWorkerRegistration) {
        // Usar Service Worker para notificações
        await state.serviceWorkerRegistration.showNotification(title, {
          icon: '/android-chrome-192x192.png',
          badge: '/favicon-16x16.png',
          tag: 'sgb-notification',
          ...options,
        });
      } else {
        // Fallback para notificação direta
        new Notification(title, {
          icon: '/android-chrome-192x192.png',
          ...options,
        });
      }
    },
    [state.notificationPermission, state.serviceWorkerRegistration]
  );

  // Atualizar Service Worker
  const updateServiceWorker = useCallback(async () => {
    if (state.serviceWorkerRegistration) {
      try {
        await state.serviceWorkerRegistration.update();
      } catch (error) {
        console.error('❌ PWA: Erro ao atualizar Service Worker:', error);
      }
    }
  }, [state.serviceWorkerRegistration]);

  // Limpar cache
  const clearCache = useCallback(async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (error) {
        console.error('❌ PWA: Erro ao limpar cache:', error);
      }
    }
  }, []);

  // Verificar atualizações
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    if (state.serviceWorkerRegistration) {
      try {
        await state.serviceWorkerRegistration.update();
        return true;
      } catch (error) {
        console.error('❌ PWA: Erro ao verificar atualizações:', error);
        return false;
      }
    }
    return false;
  }, [state.serviceWorkerRegistration]);

  // Configurar listeners e inicialização
  useEffect(() => {
    const init = async () => {
      setState(prev => ({ ...prev, isLoading: true }));

      // Detectar instalação
      detectInstallation();

      // Registrar Service Worker
      await registerServiceWorker();

      // Configurar listeners de conectividade
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Configurar listener de instalação
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Detectar permissão de notificação atual
      if ('Notification' in window) {
        setState(prev => ({
          ...prev,
          notificationPermission: Notification.permission,
        }));
      }

      setState(prev => ({ ...prev, isLoading: false }));
    };

    init();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
    };
  }, [
    detectInstallation,
    registerServiceWorker,
    handleOnline,
    handleOffline,
    handleBeforeInstallPrompt,
  ]);

  // Escutar mudanças no display mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, isInstalled: e.matches }));
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return {
    ...state,
    install,
    enableNotifications,
    showNotification,
    updateServiceWorker,
    clearCache,
    checkForUpdates,
  };
}

export default usePWA;
