'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeLocalStorage, isClient } from '@/lib/client-utils';
import { userHasModule, userHasAnyModule } from '@/lib/permissions/resolver';

interface Usuario {
  id: number;
  email: string;
  nome: string;
  role: 'admin' | 'manager' | 'funcionario';
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

interface PermissionsHook {
  user: Usuario | null;
  hasPermission: (moduloId: string) => boolean;
  hasAnyPermission: (modulosIds: string[]) => boolean;
  isRole: (role: string) => boolean;
  canAccessModule: (categoria: string) => boolean;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  updateUserPermissions: (newPermissions: string[]) => void;
  isAdminWithSpecificPermissions: () => boolean;
}

export function usePermissions(): PermissionsHook {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Carregar dados do usuário via JWT (fonte de verdade)
    const loadUserData = async () => {
      if (!isClient) {
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        // Buscar dados do servidor via JWT
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
            // Manter cache no localStorage
            safeLocalStorage.setItem('sgb_user', JSON.stringify(data.user));
            setLoading(false);
            setIsInitialized(true);
            return;
          }
        }

        // Se API falhou, tentar fallback do localStorage
        const userData = safeLocalStorage.getItem('sgb_user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.modulos_permitidos) {
            console.warn('⚠️ Usando dados em cache do localStorage');
            setUser(parsedUser);
            setLoading(false);
            setIsInitialized(true);
            return;
          }
        }
        
        // Se chegou aqui, não tem dados válidos
        safeLocalStorage.removeItem('sgb_user');
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
        
        // Só redirecionar se estiver inicializado e não for página de login
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        
        // Fallback para localStorage em caso de erro
        try {
          const userData = safeLocalStorage.getItem('sgb_user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            if (parsedUser && parsedUser.id && parsedUser.email) {
              console.warn('⚠️ Usando dados em cache do localStorage após erro');
              setUser(parsedUser);
              setLoading(false);
              setIsInitialized(true);
              return;
            }
          }
        } catch {
          // Ignorar erro de fallback
        }
        
        safeLocalStorage.removeItem('sgb_user');
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
        
        // Só redirecionar se estiver inicializado e não for página de login
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    };

    // Carregar dados iniciais apenas uma vez
    loadUserData();
  }, []);

  // Memoizar se o admin tem permissões específicas
  const adminHasExplicitPermissions = useMemo(() => {
    if (!user || user.role !== 'admin') return false;
    
    if (!user.modulos_permitidos) return false;
    
    // Se modulos_permitidos é um array
    if (Array.isArray(user.modulos_permitidos)) {
      return user.modulos_permitidos.length > 0;
    }
    
    // Se modulos_permitidos é um objeto
    if (typeof user.modulos_permitidos === 'object') {
      return Object.values(user.modulos_permitidos).some(value => value === true);
    }
    
    return false;
  }, [user]);

  // Toda a resolução de alias/generic/'todos' vive no resolver único
  // (@/lib/permissions/resolver) — fonte única de verdade compartilhada
  // entre client (sidebar, home) e server (route guards, get-user).
  const hasPermission = useCallback(
    (moduloId: string): boolean => {
      if (!user || !user.ativo) {
        return false;
      }

      // Admin sem permissões específicas = acesso total
      if (user.role === 'admin' && !adminHasExplicitPermissions) {
        return true;
      }

      return userHasModule(user.modulos_permitidos, moduloId);
    },
    [user, adminHasExplicitPermissions]
  );

  const hasAnyPermission = useCallback(
    (modulosIds: string[]): boolean => {
      if (!user || !user.ativo) return false;

      // Admin sem permissões específicas = acesso total
      if (user.role === 'admin' && !adminHasExplicitPermissions) {
        return true;
      }

      return userHasAnyModule(user.modulos_permitidos, modulosIds);
    },
    [user, adminHasExplicitPermissions]
  );

  const isRole = useCallback(
    (role: string): boolean => {
      return user?.role === role;
    },
    [user?.role]
  );

  const canAccessModule = useCallback(
    (modulo: string): boolean => {
      if (!user || !user.ativo) return false;

      // Mapeamento 1:1 - cada item da sidebar é um módulo individual
      const modulosSidebar: Record<string, string> = {
        // Navegação Principal
        home: 'home',
        checklists: 'checklists',
        checklists_abertura: 'checklists_abertura',

        // Operações
        operacoes: 'operacoes',
        operacoes_checklist_abertura: 'operacoes_checklist_abertura',
        terminal_producao: 'terminal_producao',

        // Relatórios
        relatorios: 'relatorios',
        visao_geral: 'visao_geral',
        gestao_tempo: 'gestao_tempo',
        recorrencia: 'recorrencia',
        analitico: 'analitico',

        // Marketing
        marketing: 'marketing',
        marketing_360: 'marketing_360',
        campanhas: 'campanhas',
        whatsapp_marketing: 'whatsapp_marketing',
        analytics_marketing: 'analytics_marketing',

        // Financeiro
        financeiro: 'financeiro',
        agendamento_pagamentos: 'agendamento_pagamentos',

        // Configurações
        configuracoes: 'configuracoes',
        configuracoes_checklists: 'configuracoes_checklists',
        configuracoes_metas: 'configuracoes_metas',
        configuracoes_integracoes: 'configuracoes_integracoes',
        configuracoes_seguranca: 'configuracoes_seguranca',
        configuracoes_whatsapp: 'configuracoes_whatsapp',
        configuracoes_contahub_auto: 'configuracoes_contahub_auto',
        configuracoes_meta_config: 'configuracoes_meta_config',
        configuracoes_templates: 'configuracoes_templates',
        configuracoes_analytics: 'configuracoes_analytics',
        configuracoes_pwa: 'configuracoes_pwa',

        // Reservas
        reservas: 'reservas',
        reservas_recorrencia: 'reservas_recorrencia',

        // NIBO (deprecated - substituído pelo Conta Azul)
        // nibo_contabil: 'nibo_contabil',

        // ContaHub
        contahub_teste: 'contahub_teste',
        contahub_tempo: 'bronze_contahub_producao_tempo',
        contahub_produtos: 'contahub_produtos',
        contahub_receitas: 'contahub_receitas',
        contahub_periodo: 'bronze_contahub_vendas_periodo',
        contahub_analitico: 'bronze_contahub_vendas_analitico',
        contahub_pagamentos: 'bronze_contahub_financeiro_pagamentos',
        contahub_faturamento_hora: 'bronze_contahub_operacional_fatporhora',

        // Visão Geral
        visao_geral_diario: 'visao_geral_diario',
        visao_geral_comparativo: 'visao_geral_comparativo',
        visao_geral_garcons: 'visao_geral_garcons',
        visao_geral_metricas: 'visao_geral_metricas',
        visao_geral_financeiro_mensal: 'visao_geral_financeiro_mensal',

        // Funcionário
        funcionario_checklists: 'funcionario_checklists',
      };

      const moduloId = modulosSidebar[modulo] || modulo;
      return hasPermission(moduloId);
    },
    [hasPermission, user]
  );

  // Função para atualizar dados do usuário do servidor
  const refreshUserData = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/usuarios/${user.id}`);
      if (response.ok) {
        const userData = await response.json();
        if (userData.success && userData.user) {
          // Atualizar localStorage
          safeLocalStorage.setItem('sgb_user', JSON.stringify(userData.user));
          setUser(userData.user);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Função para atualizar apenas as permissões localmente
  const updateUserPermissions = useCallback(
    (newPermissions: string[]): void => {
      if (!user) return;

      const updatedUser = {
        ...user,
        modulos_permitidos: newPermissions,
      };

      // Atualizar estado local
      setUser(updatedUser);

      // Atualizar localStorage
      safeLocalStorage.setItem('sgb_user', JSON.stringify(updatedUser));

      // Disparar evento personalizado para notificar outros componentes
      if (isClient) {
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      }
    },
    [user]
  );

  // Função para detectar se admin está usando permissões específicas
  const isAdminWithSpecificPermissions = useCallback((): boolean => {
    if (!user || user.role !== 'admin') return false;
    
    if (!user.modulos_permitidos) return false;
    
    // Se modulos_permitidos é um array
    if (Array.isArray(user.modulos_permitidos)) {
      return user.modulos_permitidos.length < 23;
    }
    
    // Se modulos_permitidos é um objeto
    if (typeof user.modulos_permitidos === 'object') {
      const truePermissions = Object.values(user.modulos_permitidos).filter(value => value === true);
      return truePermissions.length < 23;
    }
    
    return false;
  }, [user]);

  return {
    user,
    hasPermission,
    hasAnyPermission,
    isRole,
    canAccessModule,
    loading,
    refreshUserData,
    updateUserPermissions,
    isAdminWithSpecificPermissions,
  };
}