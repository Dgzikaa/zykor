'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Usuario {
  id: number;
  auth_id?: string;
  email: string;
  nome: string;
  role: 'admin' | 'manager' | 'funcionario';
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

interface UserContextData {
  user: Usuario | null;
  loading: boolean;
  isInitialized: boolean;
  updateUser: (userData: Usuario) => void;
  updatePermissions: (newPermissions: string[]) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextData>({} as UserContextData);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Carregar dados do usuário ao inicializar
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    loadUserData();
  }, []);

  // Configurar listeners para atualizações
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Debounce para evitar múltiplas chamadas simultâneas
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleStorageChange = (e: StorageEvent) => {
      // TODO(rodrigo/2026-05): sgb_user é mantido apenas como cache, fonte de verdade é JWT via /api/auth/me
      if (e.key === 'sgb_user') {
        // Verificar se houve um reload de bar muito recente
        const lastReload = sessionStorage.getItem('last_bar_reload');
        if (lastReload) {
          const timeSinceReload = Date.now() - parseInt(lastReload);
          if (timeSinceReload < 1000) {
            // Reload muito recente, aguardar para evitar conflitos
            return;
          }
        }
        
        // Debounce para evitar múltiplas chamadas
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadUserData();
        }, 300);
      }
    };

    const handleUserDataUpdated = () => {
      // Debounce para evitar múltiplas chamadas
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadUserData();
      }, 300);
    };

    const handleRefreshContext = () => {
      loadUserData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataUpdated', handleUserDataUpdated);
    window.addEventListener('refreshUserContext', handleRefreshContext);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
      window.removeEventListener('refreshUserContext', handleRefreshContext);
    };
  }, []);

  const tryRefreshToken = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const loadUserData = async () => {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    setLoading(true);

    try {
      // Buscar dados do servidor (fonte de verdade)
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // Preservar bar_id selecionado pelo usuário (se existir)
          const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
          const userDataToSave = {
            ...data.user,
            // Manter o bar_id selecionado se existir, senão usar o da API
            bar_id: selectedBarId ? parseInt(selectedBarId) : data.user.bar_id,
          };
          setUser(userDataToSave);
          // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache, fonte de verdade é JWT
          localStorage.setItem('sgb_user', JSON.stringify(userDataToSave));
        } else {
          setUser(null);
          localStorage.removeItem('sgb_user');
        }
      } else if (response.status === 401) {
        // Token expirado — tentar refresh antes de redirecionar
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Retry após refresh bem-sucedido
          const retryResponse = await fetch('/api/auth/me', {
            credentials: 'include',
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.success && retryData.user) {
              const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
              const userDataToSave = {
                ...retryData.user,
                bar_id: selectedBarId ? parseInt(selectedBarId) : retryData.user.bar_id,
              };
              setUser(userDataToSave);
              // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache
              localStorage.setItem('sgb_user', JSON.stringify(userDataToSave));
              return;
            }
          }
        }

        // Refresh falhou ou retry falhou — redirecionar ao login
        setUser(null);
        // TODO(rodrigo/2026-05): Limpar cache sgb_user
        localStorage.removeItem('sgb_user');

        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      // Tentar fallback para localStorage (compatibilidade)
      // TODO(rodrigo/2026-05): Fallback sgb_user será removido após migração completa
      try {
        const userData = localStorage.getItem('sgb_user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && parsedUser.id && parsedUser.email) {
            console.warn('⚠️ Usando cache sgb_user como fallback');
            setUser(parsedUser);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const updateUser = (userData: Usuario) => {
    try {
      setUser(userData);
      // Only update localStorage on client side
      // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache
      if (typeof window !== 'undefined') {
        localStorage.setItem('sgb_user', JSON.stringify(userData));
        // Disparar evento customizado para notificar outros componentes
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      }
    } catch (error) {
      // Erro silencioso
    }
  };

  const updatePermissions = (newPermissions: string[]) => {
    if (user) {
      const updatedUser = { ...user, modulos_permitidos: newPermissions };
      setUser(updatedUser);
      // Only update localStorage on client side
      // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache
      if (typeof window !== 'undefined') {
        localStorage.setItem('sgb_user', JSON.stringify(updatedUser));
      }
    }
  };

  const refreshUser = async (): Promise<void> => {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return;
    }

    // Buscar dados atualizados do servidor
    await loadUserData();
  };

  const logout = async () => {
    try {
      // Chamar API de logout para limpar cookies (auth_token + sgb_user)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setUser(null);
      
      // Only clear localStorage on client side
      // TODO(rodrigo/2026-05): sgb_user será removido após migração completa
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sgb_user');
        localStorage.removeItem('sgb_selected_bar_id');
        localStorage.removeItem('sgb_session');
        
        // Redirecionar para login
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Em caso de erro, limpar localmente e redirecionar
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        isInitialized,
        updateUser,
        updatePermissions,
        refreshUser,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser deve ser usado dentro de UserProvider');
  }
  return context;
}
