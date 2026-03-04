import { getMenuRoutePermissions } from './menu-config';

/**
 * Mapeamento de rotas para módulos/permissões necessárias
 * Este arquivo define quais permissões são necessárias para acessar cada rota
 */

export interface RoutePermission {
  /** Rota ou padrão de rota */
  path: string;
  /** Módulos necessários (OR - precisa de pelo menos um) */
  requiredModules?: string[];
  /** Role necessária (opcional) */
  requiredRole?: 'admin' | 'funcionario' | 'financeiro';
  /** Se true, apenas admin pode acessar */
  adminOnly?: boolean;
}

/**
 * Configuração de permissões por rota
 * IMPORTANTE: Rotas mais específicas devem vir ANTES das genéricas
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // ========================================
  // ROTAS PÚBLICAS (sem autenticação)
  // ========================================
  { path: '/login', requiredModules: [] },
  { path: '/auth', requiredModules: [] },
  
  // ========================================
  // HOME
  // ========================================
  { path: '/home', requiredModules: ['home', 'dashboard'] },

  // ========================================
  // MENU LATERAL (fonte única de verdade)
  // ========================================
  ...getMenuRoutePermissions().map(route => ({
    path: route.path,
    requiredModules: route.requiredModules,
  })),
  
  // ========================================
  // OPERACIONAL
  // ========================================
  { path: '/operacional/checklists', requiredModules: ['operacoes', 'checklists', 'operacoes_checklist_abertura'] },
  { path: '/operacional/producao', requiredModules: ['operacoes', 'terminal_producao', 'producao'] },
  { path: '/operacional', requiredModules: ['operacoes'] },
  
  // ========================================
  // FINANCEIRO
  // ========================================
  { path: '/financeiro/dashboard', requiredModules: ['financeiro', 'dashboard_financeiro'] },
  { path: '/financeiro/agendamento', requiredModules: ['financeiro', 'financeiro_agendamento', 'agendamento_pagamentos'] },
  { path: '/financeiro/transacoes', requiredModules: ['financeiro', 'financeiro_transacoes'] },
  { path: '/financeiro/contas', requiredModules: ['financeiro', 'financeiro_contas'] },
  { path: '/financeiro/categorias', requiredModules: ['financeiro', 'financeiro_categorias'] },
  { path: '/financeiro', requiredModules: ['financeiro'] },
  
  // ========================================
  // ESTRATÉGICO (Todos os usuários podem ver)
  // ========================================
  { path: '/estrategico/desempenho', requiredModules: ['estrategico', 'estrategico_desempenho', 'desempenho', 'dashboard', 'home'] },
  { path: '/estrategico/metas', requiredModules: ['estrategico', 'estrategico_metas', 'metas', 'dashboard', 'home'] },
  { path: '/estrategico/analytics', requiredModules: ['estrategico', 'estrategico_analytics', 'analytics', 'dashboard', 'home'] },
  { path: '/estrategico', requiredModules: ['estrategico', 'dashboard', 'home'] },
  
  // ========================================
  // ANALÍTICO (Todos os usuários podem ver)
  // ========================================
  { path: '/analitico/clientes', requiredModules: ['analitico_clientes', 'analitico', 'analitico_relatorios', 'relatorios', 'dashboard', 'home'] },
  { path: '/analitico/eventos', requiredModules: ['analitico_eventos', 'analitico', 'analitico_relatorios', 'relatorios', 'dashboard', 'home'] },
  { path: '/analitico/dashboard', requiredModules: ['analitico', 'analitico_dashboard', 'analitico_clientes', 'analitico_eventos', 'relatorios', 'dashboard', 'home'] },
  { path: '/analitico/relatorios', requiredModules: ['analitico', 'analitico_relatorios', 'analitico_clientes', 'analitico_eventos', 'relatorios', 'dashboard', 'home'] },
  { path: '/analitico', requiredModules: ['analitico', 'analitico_clientes', 'analitico_eventos', 'relatorios', 'dashboard', 'home'] },
  
  // ========================================
  // MARKETING
  // ========================================
  { path: '/marketing/campanhas', requiredModules: ['marketing', 'marketing_campanhas', 'campanhas'] },
  { path: '/marketing/analytics', requiredModules: ['marketing', 'marketing_analytics', 'analytics_marketing'] },
  { path: '/marketing/whatsapp', requiredModules: ['marketing', 'whatsapp_marketing'] },
  { path: '/marketing', requiredModules: ['marketing'] },
  { path: '/visao-geral/marketing-360', requiredModules: ['marketing', 'marketing_360'] },
  
  // ========================================
  // GESTÃO
  // ========================================
  { path: '/gestao/tempo', requiredModules: ['gestao', 'gestao_tempo'] },
  { path: '/gestao/produtos', requiredModules: ['gestao', 'gestao_produtos', 'produtos'] },
  { path: '/gestao/estoque', requiredModules: ['gestao', 'gestao_estoque', 'estoque'] },
  { path: '/gestao', requiredModules: ['gestao'] },
  
  // ========================================
  // CRM (Todos os usuários podem ver)
  // ========================================
  { path: '/crm', requiredModules: ['crm', 'dashboard', 'home'] },
  
  // ========================================
  // FERRAMENTAS (Todos os usuários podem ver)
  // ========================================
  { path: '/ferramentas/stockout', requiredModules: ['ferramentas', 'gestao_stockout', 'ferramentas_stockout', 'dashboard', 'home'] },
  { path: '/ferramentas', requiredModules: ['ferramentas', 'dashboard', 'home'] },
  
  // ========================================
  // EXTRAS (Apenas Admin)
  // ========================================
  { path: '/extras', adminOnly: true },
  
  // ========================================
  // CONFIGURAÇÕES (Apenas Admin)
  // ========================================
  { path: '/configuracoes/usuarios', adminOnly: true },
  { path: '/configuracoes/permissoes', adminOnly: true },
  { path: '/configuracoes/seguranca', adminOnly: true },
  { path: '/configuracoes/integracoes', adminOnly: true },
  { path: '/configuracoes/whatsapp', adminOnly: true },
  { path: '/configuracoes/metas', adminOnly: true },
  { path: '/configuracoes/templates', adminOnly: true },
  { path: '/configuracoes', adminOnly: true },
  
  // ========================================
  // RELATÓRIOS
  // ========================================
  { path: '/relatorios', requiredModules: ['relatorios', 'analitico'] },
  { path: '/visao-geral', requiredModules: ['relatorios', 'visao_geral', 'analitico'] },
];

/**
 * Encontra a configuração de permissão para uma rota
 * @param pathname Caminho da rota
 * @returns Configuração de permissão ou null se não encontrado
 */
export function getRoutePermission(pathname: string): RoutePermission | null {
  // Normalizar pathname (remover trailing slash)
  const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
    ? pathname.slice(0, -1) 
    : pathname;
  
  // Buscar correspondência exata primeiro
  const exactMatch = ROUTE_PERMISSIONS.find(route => route.path === normalizedPath);
  if (exactMatch) return exactMatch;
  
  // Buscar correspondência por prefixo (mais específico primeiro)
  const prefixMatch = ROUTE_PERMISSIONS.find(route => 
    normalizedPath.startsWith(route.path + '/')
  );
  if (prefixMatch) return prefixMatch;
  
  return null;
}

/**
 * Verifica se usuário tem permissão para acessar uma rota
 * @param pathname Caminho da rota
 * @param user Dados do usuário
 * @returns true se tem permissão, false caso contrário
 */
export function hasRoutePermission(
  pathname: string,
  user: {
    role: string;
    modulos_permitidos: string[] | Record<string, any>;
    ativo: boolean;
  }
): boolean {
  // Usuário inativo não tem acesso
  if (!user.ativo) return false;
  
  const routeConfig = getRoutePermission(pathname);
  
  // Se não tem configuração, bloquear por segurança
  if (!routeConfig) {
    console.warn(`⚠️ Rota sem configuração de permissão: ${pathname}`);
    return false;
  }
  
  // Se é rota pública (sem módulos necessários)
  if (!routeConfig.requiredModules && !routeConfig.adminOnly && !routeConfig.requiredRole) {
    return true;
  }
  
  // Verificar se é admin only
  if (routeConfig.adminOnly && user.role !== 'admin') {
    return false;
  }
  
  // Verificar role específica
  if (routeConfig.requiredRole && user.role !== routeConfig.requiredRole) {
    return false;
  }
  
  // Admin tem acesso a tudo (exceto se tiver permissões específicas configuradas)
  if (user.role === 'admin') {
    // Verificar se admin tem permissão "todos"
    const modulosArray = Array.isArray(user.modulos_permitidos) 
      ? user.modulos_permitidos 
      : Object.keys(user.modulos_permitidos).filter(k => user.modulos_permitidos[k]);
    
    if (modulosArray.includes('todos')) {
      return true;
    }
    
    // Se admin não tem "todos", verificar se tem permissões específicas
    if (modulosArray.length > 0 && routeConfig.requiredModules) {
      return hasAnyModule(user.modulos_permitidos, routeConfig.requiredModules);
    }
    
    // Admin sem permissões específicas = acesso total
    return true;
  }
  
  // Verificar módulos necessários
  if (routeConfig.requiredModules && routeConfig.requiredModules.length > 0) {
    return hasAnyModule(user.modulos_permitidos, routeConfig.requiredModules);
  }
  
  return true;
}

/**
 * Verifica se usuário tem pelo menos um dos módulos necessários
 */
function hasAnyModule(
  userModules: string[] | Record<string, any>,
  requiredModules: string[]
): boolean {
  const userModulesArray = Array.isArray(userModules)
    ? userModules.map(m => m.toLowerCase())
    : Object.keys(userModules)
        .filter(k => userModules[k])
        .map(k => k.toLowerCase());
  
  // Verificar se tem "todos"
  if (userModulesArray.includes('todos')) {
    return true;
  }
  
  // Verificar se tem pelo menos um módulo necessário
  return requiredModules.some(module => 
    userModulesArray.includes(module.toLowerCase())
  );
}
