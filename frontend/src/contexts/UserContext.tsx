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
          setUser(data.user);
          // Salvar no localStorage apenas para cache (não é fonte de verdade)
          localStorage.setItem('sgb_user', JSON.stringify(data.user));
        } else {
          setUser(null);
          localStorage.removeItem('sgb_user');
        }
      } else {
        // Não autenticado ou token inválido
        setUser(null);
        localStorage.removeItem('sgb_user');
        
        // Se não está na página de login, redirecionar
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      // Tentar fallback para localStorage (compatibilidade)
      try {
        const userData = localStorage.getItem('sgb_user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && parsedUser.id && parsedUser.email) {
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
      // Chamar API de logout para limpar cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setUser(null);
      
      // Only clear localStorage on client side
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
