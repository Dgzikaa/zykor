'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Usuario {
  id: number;
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

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sgb_user') {
        loadUserData();
      }
    };

    const handleUserDataUpdated = () => {
      loadUserData();
    };

    const handleRefreshContext = () => {
      loadUserData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataUpdated', handleUserDataUpdated);
    window.addEventListener('refreshUserContext', handleRefreshContext);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
      window.removeEventListener('refreshUserContext', handleRefreshContext);
    };
  }, []);

  const loadUserData = () => {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    setLoading(true);

    try {
      const userData = localStorage.getItem('sgb_user');

      if (userData) {
        const parsedUser = JSON.parse(userData);

        // Validar se os dados do usuário são válidos
        if (
          parsedUser &&
          parsedUser.id &&
          parsedUser.email &&
          parsedUser.nome
        ) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('sgb_user');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      // Limpar dados corrompidos
      localStorage.removeItem('sgb_user');
      setUser(null);
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

    try {
      const userData = localStorage.getItem('sgb_user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      // Only clear localStorage on client side
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sgb_user');
        localStorage.removeItem('sgb_selected_bar_id');
        localStorage.removeItem('sgb_session');
      }

      // Aguardar um pouco antes de recarregar para garantir limpeza
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }, 100);
    } catch (error) {
      // Em caso de erro, tentar recarregar mesmo assim
      if (typeof window !== 'undefined') {
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
