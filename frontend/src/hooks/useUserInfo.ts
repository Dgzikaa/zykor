'use client';

import { useState, useEffect } from 'react';

interface UserInfo {
  id: number;
  nome: string;
  email: string;
  role: string;
  avatar?: string;
  bar_id: number;
  modulos_permitidos: Record<string, any>;
}

export function useUserInfo() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUserInfo() {
      try {
        // Buscar dados do servidor via JWT (fonte de verdade)
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Usuário não autenticado - faça login novamente');
          }
          throw new Error('Erro ao carregar informações do usuário');
        }

        const data = await response.json();
        if (data.success && data.user) {
          if (mounted) {
            setUserInfo(data.user);
            // Manter cache no localStorage para uso offline/fallback
            localStorage.setItem('sgb_user', JSON.stringify(data.user));
          }
        } else {
          throw new Error('Dados do usuário inválidos');
        }
      } catch (err) {
        console.error('❌ Erro ao carregar informações do usuário:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        
        // Fallback: tentar localStorage se API falhar
        try {
          const storedUser = localStorage.getItem('sgb_user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            if (userData && userData.nome && userData.email) {
              console.warn('⚠️ Usando dados em cache do localStorage');
              if (mounted) {
                setUserInfo(userData);
              }
              return;
            }
          }
        } catch {
          // Ignorar erros de fallback
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadUserInfo();

    return () => {
      mounted = false;
    };
  }, []);

  const roleDisplayName = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'Administrador';
      case 'financeiro':
        return 'Financeiro';
      case 'funcionario':
        return 'Funcionário';
      default:
        return role;
    }
  };

  return {
    userInfo,
    isLoading,
    error,
    roleDisplayName: userInfo ? roleDisplayName(userInfo.role) : null,
  };
}
