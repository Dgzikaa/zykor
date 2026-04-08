/**
 * Gerenciador de Sessão
 * Garante que a sessão do usuário seja mantida consistente
 */

import { supabase } from '@/lib/supabase';

export interface SessionData {
  user: any;
  session: any;
}

/**
 * Verifica se há uma sessão válida
 * Se o token expirou, tenta renovar usando refresh token
 */
export async function hasValidSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/validate', {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      return data.valid === true;
    }

    // Token inválido, tentar renovar
    if (response.status === 401) {
      console.log('🔄 Token expirado, tentando renovar...');
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          console.log('✅ Token renovado com sucesso');
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    return false;
  }
}

/**
 * Limpa todos os dados de sessão
 */
export function clearSession() {
  try {
    // Limpar localStorage
    localStorage.removeItem('sgb_user');
    localStorage.removeItem('sgb_session');
    localStorage.removeItem('sgb_selected_bar_id');

    // Limpar cookies
    const pastDate = 'Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `sgb_user=; expires=${pastDate}; path=/`;
    document.cookie = `auth_token=; expires=${pastDate}; path=/`;
    document.cookie = `refresh_token=; expires=${pastDate}; path=/`;
    document.cookie = `sgb_bar_id=; expires=${pastDate}; path=/`;

    console.log('✅ Sessão limpa com sucesso');
  } catch (error) {
    console.error('Erro ao limpar sessão:', error);
  }
}

/**
 * Valida e sincroniza a sessão
 * Retorna true se a sessão está válida, false caso contrário
 */
export async function validateAndSyncSession(): Promise<boolean> {
  try {
    // Verificar se há token válido
    const isValid = await hasValidSession();

    if (!isValid) {
      // Sessão inválida, limpar dados
      clearSession();
      return false;
    }

    // Sessão válida, verificar se dados locais existem
    const userData = localStorage.getItem('sgb_user');
    if (!userData) {
      // Dados locais não existem, mas token é válido
      // Buscar dados do usuário
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            localStorage.setItem('sgb_user', JSON.stringify(data.user));
            console.log('✅ Dados do usuário sincronizados');
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    return false;
  }
}

/**
 * Configura listeners para sincronização de sessão entre abas
 */
export function setupSessionSync() {
  if (typeof window === 'undefined') return;

  // Listener para mudanças no localStorage (sincronização entre abas)
  const storageListener = (event: StorageEvent) => {
    if (event.key === 'sgb_user') {
      if (!event.newValue && window.location.pathname !== '/login') {
        // Usuário deslogou em outra aba (não redirecionar se já estamos no login)
        console.log('🔄 Logout detectado em outra aba');
        clearSession();
        window.location.href = '/login';
      }
    }
  };
  
  window.addEventListener('storage', storageListener);

  // Verificar sessão periodicamente (a cada 5 minutos)
  const intervalId = setInterval(async () => {
    // Não verificar se estamos na página de login
    if (window.location.pathname === '/login') return;
    
    const isValid = await hasValidSession();
    if (!isValid) {
      console.log('⚠️ Sessão expirada, redirecionando para login...');
      clearSession();
      window.location.href = '/login';
    }
  }, 5 * 60 * 1000); // 5 minutos

  // Retornar função de cleanup
  return () => {
    window.removeEventListener('storage', storageListener);
    clearInterval(intervalId);
  };
}
