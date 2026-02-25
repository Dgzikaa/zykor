'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeLocalStorage, isClient } from '@/lib/client-utils';
import { MODULO_TO_PERMISSIONS } from '@/lib/menu-config';

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
    // Carregar dados do usuário do localStorage
    const loadUserData = () => {
      if (!isClient) {
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        const userData = safeLocalStorage.getItem('sgb_user');
        
        if (userData) {
          const parsedUser = JSON.parse(userData);
          
          if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.modulos_permitidos) {
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

  // Memoizar as permissões do usuário para evitar recálculos desnecessários
  // Agora também expande módulos específicos para permissões genéricas
  const userPermissions = useMemo(() => {
    if (!user || !user.ativo || !user.modulos_permitidos) {
      return new Set<string>();
    }
    
    const permissions = new Set<string>();
    const modulosDoUsuario: string[] = [];
    
    // Se modulos_permitidos é um array
    if (Array.isArray(user.modulos_permitidos)) {
      user.modulos_permitidos.forEach(modulo => {
        if (typeof modulo === 'string') {
          const moduloLower = modulo.toLowerCase();
          permissions.add(moduloLower);
          modulosDoUsuario.push(moduloLower);
        }
      });
    }
    // Se modulos_permitidos é um objeto
    else if (typeof user.modulos_permitidos === 'object') {
      Object.entries(user.modulos_permitidos).forEach(([modulo, value]) => {
        if (value === true) {
          const moduloLower = modulo.toLowerCase();
          permissions.add(moduloLower);
          modulosDoUsuario.push(moduloLower);
        }
      });
    }

    // Expandir módulos específicos para permissões genéricas
    // Ex: 'ferramentas_producao' -> também concede 'operacoes' e 'ferramentas'
    for (const modulo of modulosDoUsuario) {
      const permissoesGenericas = MODULO_TO_PERMISSIONS[modulo];
      if (permissoesGenericas) {
        permissoesGenericas.forEach(perm => permissions.add(perm.toLowerCase()));
      }
    }

    return permissions;
  }, [user]);

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

  const hasPermission = useCallback(
    (moduloId: string): boolean => {
      if (!user || !user.ativo) {
        return false;
      }

      // Se admin tem permissões específicas configuradas, respeitar elas
      if (user.role === 'admin') {
        if (adminHasExplicitPermissions) {
          // Primeiro verificar se tem permissão "todos"
          if (userPermissions.has('todos')) {
            return true;
          }
          return userPermissions.has(moduloId.toLowerCase());
        }
        // Admin sem permissões específicas = acesso total
        return true;
      }

      // Verificar permissão especial "todos"
      const hasTodos = userPermissions.has('todos');
      if (hasTodos) {
        return true;
      }

      // Verificar se o módulo está na lista de permissões
      const hasDirectPermission = userPermissions.has(moduloId.toLowerCase());

      // Se é o módulo "operacoes", verificar se tem qualquer permissão relacionada
      if (moduloId === 'operacoes') {
        const operacoesPermissions = [
          'operacoes',
          'operacoes_checklist_abertura',
          'terminal_producao',
          'receitas_insumos',
          'gestao_tempo',
          'produtos_estoque',
          'planejamento_operacional',
          'recorrencia_tarefas',
          'controle_periodo',
          'checklists',
          'vendas',
          'eventos',
          'clientes',
          'producao',
          'produtos',
        ];

        const hasAnyOperacoesPermission = operacoesPermissions.some(perm => 
          userPermissions.has(perm.toLowerCase())
        );
        return hasDirectPermission || hasAnyOperacoesPermission;
      }

      // Se é o módulo "financeiro", verificar se tem qualquer permissão relacionada
      if (moduloId === 'financeiro' || moduloId.startsWith('financeiro_')) {
        const financeiroPermissions = [
          'financeiro',
          'financeiro_agendamento',
          'pagamentos',
          'dashboard_financeiro_mensal',
          'nfs',
          'fatporhora',
          'vendas',
          'eventos',
          'clientes',
          'producao',
          'produtos',
        ];

        const hasAnyFinanceiroPermission = financeiroPermissions.some(perm => 
          userPermissions.has(perm.toLowerCase())
        );
        return hasDirectPermission || hasAnyFinanceiroPermission;
      }

      return hasDirectPermission;
    },
    [user, userPermissions, adminHasExplicitPermissions]
  );

  const hasAnyPermission = useCallback(
    (modulosIds: string[]): boolean => {
      if (!user || !user.ativo) return false;

      // Se admin tem permissões específicas configuradas, respeitar elas
      if (user.role === 'admin') {
        if (adminHasExplicitPermissions) {
          return modulosIds.some(modulo => userPermissions.has(modulo.toLowerCase()));
        }
        return true;
      }

      // Verificar se tem pelo menos uma permissão
      return modulosIds.some(modulo => userPermissions.has(modulo.toLowerCase()));
    },
    [user, userPermissions, adminHasExplicitPermissions]
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

        // Windsor.ai
        windsor_analytics: 'windsor_analytics',

        // NIBO
        nibo_contabil: 'nibo_contabil',

        // ContaHub
        contahub_teste: 'contahub_teste',
        contahub_tempo: 'contahub_tempo',
        contahub_produtos: 'contahub_produtos',
        contahub_receitas: 'contahub_receitas',
        contahub_periodo: 'contahub_periodo',
        contahub_analitico: 'contahub_analitico',
        contahub_pagamentos: 'contahub_pagamentos',
        contahub_faturamento_hora: 'contahub_faturamento_hora',

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