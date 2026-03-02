/**
 * Sistema de validação granular de permissões
 */

import type { AuthenticatedUser } from './types';

/**
 * Módulos disponíveis no sistema
 */
export const MODULES = {
  // Admin
  ADMIN: 'admin',
  TODOS: 'todos',
  
  // Operacional
  OPERACOES: 'operacoes',
  CHECKLISTS: 'checklists',
  TERMINAL_PRODUCAO: 'terminal_producao',
  PRODUCAO: 'producao',
  OPERACOES_CHECKLIST_ABERTURA: 'operacoes_checklist_abertura',
  
  // Financeiro
  FINANCEIRO: 'financeiro',
  DASHBOARD_FINANCEIRO: 'dashboard_financeiro',
  FINANCEIRO_AGENDAMENTO: 'financeiro_agendamento',
  AGENDAMENTO_PAGAMENTOS: 'agendamento_pagamentos',
  FINANCEIRO_TRANSACOES: 'financeiro_transacoes',
  FINANCEIRO_CONTAS: 'financeiro_contas',
  FINANCEIRO_CATEGORIAS: 'financeiro_categorias',
  
  // Estratégico
  ESTRATEGICO: 'estrategico',
  ESTRATEGICO_DESEMPENHO: 'estrategico_desempenho',
  DESEMPENHO: 'desempenho',
  ESTRATEGICO_METAS: 'estrategico_metas',
  METAS: 'metas',
  ESTRATEGICO_ANALYTICS: 'estrategico_analytics',
  ANALYTICS: 'analytics',
  
  // Analítico
  ANALITICO: 'analitico',
  ANALITICO_DASHBOARD: 'analitico_dashboard',
  ANALITICO_RELATORIOS: 'analitico_relatorios',
  RELATORIOS: 'relatorios',
  RELATORIOS_EVENTOS: 'relatorios_eventos',
  RELATORIOS_CLIENTES: 'relatorios_clientes',
  RELATORIOS_CLIENTES_ATIVOS: 'relatorios_clientes_ativos',
  RELATORIOS_VISAO_GERAL: 'relatorios_visao_geral',
  
  // Marketing
  MARKETING: 'marketing',
  MARKETING_CAMPANHAS: 'marketing_campanhas',
  CAMPANHAS: 'campanhas',
  MARKETING_ANALYTICS: 'marketing_analytics',
  ANALYTICS_MARKETING: 'analytics_marketing',
  WHATSAPP_MARKETING: 'whatsapp_marketing',
  MARKETING_360: 'marketing_360',
  
  // Gestão
  GESTAO: 'gestao',
  GESTAO_TEMPO: 'gestao_tempo',
  GESTAO_PRODUTOS: 'gestao_produtos',
  PRODUTOS: 'produtos',
  GESTAO_ESTOQUE: 'gestao_estoque',
  ESTOQUE: 'estoque',
  GESTAO_CALENDARIO: 'gestao_calendario',
  GESTAO_DESEMPENHO: 'gestao_desempenho',
  GESTAO_STOCKOUT: 'gestao_stockout',
  
  // CRM
  CRM: 'crm',
  GESTAO_CRM: 'gestao_crm',
  
  // Ferramentas
  FERRAMENTAS: 'ferramentas',
  OPERACOES_CONTAGEM_ESTOQUE: 'operacoes_contagem_estoque',
  OPERACOES_CONTAGEM_RAPIDA: 'operacoes_contagem_rapida',
  
  // Dashboard
  DASHBOARD: 'dashboard',
  HOME: 'home',
  VISAO_GERAL: 'visao_geral',
} as const;

/**
 * Verificar se usuário tem uma permissão específica
 */
export function hasPermission(
  user: AuthenticatedUser,
  permission: string
): boolean {
  // Admin tem todas as permissões
  if (user.role === 'admin') {
    return true;
  }
  
  // Verificar se tem o módulo específico ou 'todos'
  return (
    user.modulos_permitidos.includes(permission) ||
    user.modulos_permitidos.includes(MODULES.TODOS) ||
    user.modulos_permitidos.includes(MODULES.ADMIN)
  );
}

/**
 * Verificar se usuário tem pelo menos uma das permissões
 */
export function hasAnyPermission(
  user: AuthenticatedUser,
  permissions: string[]
): boolean {
  // Admin tem todas as permissões
  if (user.role === 'admin') {
    return true;
  }
  
  // Verificar se tem 'todos' ou 'admin'
  if (
    user.modulos_permitidos.includes(MODULES.TODOS) ||
    user.modulos_permitidos.includes(MODULES.ADMIN)
  ) {
    return true;
  }
  
  // Verificar se tem pelo menos uma das permissões
  return permissions.some(permission =>
    user.modulos_permitidos.includes(permission)
  );
}

/**
 * Verificar se usuário tem todas as permissões
 */
export function hasAllPermissions(
  user: AuthenticatedUser,
  permissions: string[]
): boolean {
  // Admin tem todas as permissões
  if (user.role === 'admin') {
    return true;
  }
  
  // Verificar se tem 'todos' ou 'admin'
  if (
    user.modulos_permitidos.includes(MODULES.TODOS) ||
    user.modulos_permitidos.includes(MODULES.ADMIN)
  ) {
    return true;
  }
  
  // Verificar se tem todas as permissões
  return permissions.every(permission =>
    user.modulos_permitidos.includes(permission)
  );
}

/**
 * Verificar se usuário é admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}

/**
 * Verificar se usuário pode gerenciar financeiro
 */
export function canManageFinancial(user: AuthenticatedUser): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'financeiro' ||
    hasPermission(user, MODULES.FINANCEIRO)
  );
}

/**
 * Verificar se usuário pode gerenciar operações
 */
export function canManageOperations(user: AuthenticatedUser): boolean {
  return (
    user.role === 'admin' ||
    hasPermission(user, MODULES.OPERACOES)
  );
}

/**
 * Verificar se usuário pode gerenciar marketing
 */
export function canManageMarketing(user: AuthenticatedUser): boolean {
  return (
    user.role === 'admin' ||
    hasPermission(user, MODULES.MARKETING)
  );
}

/**
 * Obter lista de permissões do usuário
 */
export function getUserPermissions(user: AuthenticatedUser): string[] {
  return user.modulos_permitidos;
}

/**
 * Verificar se usuário tem acesso a uma rota
 */
export function canAccessRoute(
  user: AuthenticatedUser,
  route: string
): boolean {
  // Mapeamento de rotas para permissões necessárias
  const routePermissions: Record<string, string[]> = {
    '/operacional': [MODULES.OPERACOES],
    '/financeiro': [MODULES.FINANCEIRO],
    '/estrategico': [MODULES.ESTRATEGICO, MODULES.DASHBOARD, MODULES.HOME],
    '/analitico': [MODULES.ANALITICO, MODULES.DASHBOARD, MODULES.HOME],
    '/marketing': [MODULES.MARKETING],
    '/gestao': [MODULES.GESTAO],
    '/crm': [MODULES.CRM, MODULES.DASHBOARD, MODULES.HOME],
    '/ferramentas': [MODULES.FERRAMENTAS, MODULES.DASHBOARD, MODULES.HOME],
    '/configuracoes': [MODULES.ADMIN],
  };
  
  // Encontrar permissões necessárias para a rota
  const requiredPermissions = Object.entries(routePermissions).find(
    ([path]) => route.startsWith(path)
  )?.[1];
  
  if (!requiredPermissions) {
    // Rota sem permissões específicas - permitir acesso
    return true;
  }
  
  // Verificar se tem pelo menos uma das permissões
  return hasAnyPermission(user, requiredPermissions);
}
