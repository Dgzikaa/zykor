/**
 * RESOLVER ÚNICO DE PERMISSÕES (fonte única de verdade para CHECAGEM)
 *
 * Problema histórico: existiam ~6 vocabulários divergentes de permissão
 * (menu-config, sidebar, route-permissions, usePermissions, permissions.ts,
 * aliases ContaHub). Um usuário salvo com `financeiro_agendamento` não casava
 * com a tela que checava `ferramentas_agendamento`, gerando "Nenhum módulo
 * disponível" silenciosamente.
 *
 * Este módulo centraliza a resolução. Regras:
 * 1. CLASSES DE EQUIVALÊNCIA: nomes legados/sinônimos colapsam num id canônico
 *    (ex: financeiro_agendamento ≡ ferramentas_agendamento ≡ agendamento_pagamentos).
 * 2. GENERICS POR CATEGORIA: ter a permissão genérica da categoria concede os
 *    módulos dela (ex: `ferramentas` concede `ferramentas_agendamento`), e vice-versa
 *    (ter um módulo da categoria concede acesso ao hub genérico daquela categoria).
 * 3. ADITIVO: a resolução só ADICIONA equivalências — nunca remove um acesso que
 *    já funcionava hoje. Logo é seguro contra regressão de quem já está OK.
 *
 * Puro (sem React/Next) de propósito: usável tanto no client (usePermissions, home,
 * sidebar) quanto no server (get-user, route guards).
 */

import { MODULOS_MENU } from './modules';

export type ModulosPermitidos = string[] | Record<string, unknown> | null | undefined;

/** Permissão coringa: acesso total. */
const TODOS = 'todos';

/**
 * Generics de cada categoria do menu. Mantido consistente com
 * `buildSectionFallbackModules` em ./modules.ts.
 */
const CATEGORY_GENERICS: Record<string, string[]> = {
  'Estratégico': ['estrategico', 'gestao', 'dashboard', 'home'],
  'Analítico': ['analitico', 'relatorios', 'dashboard', 'home'],
  'Ferramentas': ['ferramentas', 'operacoes', 'dashboard', 'home'],
  // Financeiro em 2 grupos. 'home'/'financeiro' mantêm quem já tinha acesso (aditivo);
  // o token único do grupo ('financeiro_relatorios'/'financeiro_ferramentas') permite
  // segmentar (ex: investidor recebe só 'financeiro_relatorios' e NÃO vê as ferramentas).
  'Relatórios Financeiros': ['financeiro_relatorios', 'financeiro', 'home'],
  'Ferramentas Financeiro': ['financeiro_ferramentas', 'financeiro', 'ferramentas', 'ferramentas_agendamento', 'home'],
  'Configurações': ['configuracoes'],
  'Extras': ['home', 'relatorios'],
};

/**
 * Grants genéricos extras por módulo específico (além da categoria).
 * Cobre casos onde o módulo cruza fronteiras de categoria no negócio.
 */
const MODULE_EXTRA_GENERICS: Record<string, string[]> = {
  ferramentas_agendamento: ['financeiro'],
  ferramentas_stockout: ['gestao'],
};

/**
 * Classes de equivalência (alias legado/sinônimo -> id canônico do menu).
 * O id canônico é o gerado por ./modules (categoria_nome).
 * Cobre TODAS as strings legadas encontradas no banco em produção.
 */
const ALIAS_TO_CANONICAL: Record<string, string> = {
  // Agendamento / pagamentos
  financeiro_agendamento: 'ferramentas_agendamento',
  agendamento_pagamentos: 'ferramentas_agendamento',
  pagamentos: 'ferramentas_agendamento',
  // Stockout
  gestao_stockout: 'ferramentas_stockout',
  // CRM (módulo único; sub-abas granulares legadas colapsam no módulo)
  crm: 'ferramentas_crm',
  gestao_crm: 'ferramentas_crm',
  crm_segmentacao_rfm: 'ferramentas_crm',
  crm_padroes: 'ferramentas_crm',
  crm_predicao_churn: 'ferramentas_crm',
  crm_ltv_e_engajamento: 'ferramentas_crm',
  crm_umbler_talk: 'ferramentas_crm',
  // NPS
  ferramentas_nps: 'ferramentas_nps_funcionarios',
  nps: 'ferramentas_nps_funcionarios',
  // Controle de Produção (perfil de tablet: producaobar@/producaocozinha@).
  // A página /operacional/producoes é liberada pelo token dedicado `operacional_producoes`
  // (route-permissions) e pelo `permission` do menu `controle_producao`, mas o guard de ESCRITA
  // da API mapeia a rota pro id do menu `producao - cmv_controle_de_producao` e exigia os tokens
  // granulares (:inserir etc). Sem isso, o tablet ABRIA a página mas tomava 403 ao salvar. Colapsar
  // os dois tokens da página no módulo torna o perfil de tablet auto-suficiente (bar ≡ cozinha).
  operacional_producoes: 'producao - cmv_controle_de_producao',
  controle_producao: 'producao - cmv_controle_de_producao',
  // Estratégico
  desempenho: 'estrategico_desempenho',
  estrategico_planejamento_comercial: 'estrategico_planejamento',
  planejamento: 'estrategico_planejamento',
  orcamentacao: 'estrategico_orcamentacao',
  visao_geral: 'estrategico_visao_geral',
  // Analítico
  clientes: 'analitico_clientes',
  relatorios_clientes: 'analitico_clientes',
  eventos: 'analitico_eventos',
  relatorios_eventos: 'analitico_eventos',
};

/** id canônico do módulo -> categoria do menu (derivado de MODULOS_MENU). */
const MODULE_TO_CATEGORY: Record<string, string> = MODULOS_MENU.reduce(
  (acc, m) => {
    acc[m.id] = m.categoria;
    return acc;
  },
  {} as Record<string, string>
);

/** generic (ex: 'ferramentas') -> ids de módulos que ele cobre. */
const GENERIC_TO_MODULES: Record<string, Set<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const m of MODULOS_MENU) {
    const generics = CATEGORY_GENERICS[m.categoria] || [];
    for (const g of generics) {
      (map[g] ??= new Set()).add(m.id);
    }
    for (const g of MODULE_EXTRA_GENERICS[m.id] || []) {
      (map[g] ??= new Set()).add(m.id);
    }
  }
  return map;
})();

/** Normaliza modulos_permitidos (array OU objeto bool) para array lowercase. */
export function normalizeStoredPermissions(stored: ModulosPermitidos): string[] {
  if (!stored) return [];
  if (Array.isArray(stored)) {
    return stored
      .filter((s): s is string => typeof s === 'string')
      .map(s => s.toLowerCase());
  }
  if (typeof stored === 'object') {
    return Object.entries(stored)
      .filter(([, v]) => v === true)
      .map(([k]) => k.toLowerCase());
  }
  return [];
}

/** Ações CRUD de um módulo. 'ver' é a base (editar/inserir/excluir implicam ver). */
export type PermAction = 'ver' | 'editar' | 'inserir' | 'excluir';
export const PERM_ACTIONS: PermAction[] = ['ver', 'editar', 'inserir', 'excluir'];
const ACTION_SET = new Set<string>(PERM_ACTIONS);

/** Separa 'modulo:acao' → { base, action }. Sem sufixo de ação conhecido → action undefined. */
export function splitAction(token: string): { base: string; action?: PermAction } {
  const i = token.lastIndexOf(':');
  if (i > 0) {
    const suffix = token.slice(i + 1).toLowerCase();
    if (ACTION_SET.has(suffix)) return { base: token.slice(0, i).toLowerCase(), action: suffix as PermAction };
  }
  return { base: token.toLowerCase() };
}

/** Colapsa um token na sua classe de equivalência canônica. */
export function canonicalize(token: string): string {
  const t = token.toLowerCase();
  return ALIAS_TO_CANONICAL[t] ?? t;
}

/**
 * Conjunto efetivo de permissões do usuário: tokens crus + suas formas canônicas.
 * Mantém os generics crus (ferramentas, financeiro, gestao, etc.). Para tokens granulares
 * ('modulo:acao'), adiciona também a forma canônica da BASE (ex.: 'crm:editar' → 'ferramentas_crm:editar').
 */
export function expandUserPermissions(stored: ModulosPermitidos): Set<string> {
  const tokens = normalizeStoredPermissions(stored);
  const set = new Set<string>();
  for (const t of tokens) {
    set.add(t);
    const { base, action } = splitAction(t);
    if (action) set.add(`${canonicalize(base)}:${action}`);
    else set.add(canonicalize(t));
  }
  return set;
}

/**
 * Tokens que SATISFAZEM um módulo requerido: o próprio, seu canônico,
 * os generics da categoria + extras. Para um generic requerido, também
 * os módulos-membro daquele generic.
 */
function acceptingTokensFor(moduleId: string): Set<string> {
  const target = canonicalize(moduleId);
  const accept = new Set<string>([moduleId.toLowerCase(), target]);

  const categoria = MODULE_TO_CATEGORY[target];
  if (categoria) {
    for (const g of CATEGORY_GENERICS[categoria] || []) accept.add(g);
    for (const g of MODULE_EXTRA_GENERICS[target] || []) accept.add(g);
  }

  // Se o alvo é um generic, qualquer módulo-membro dele também concede.
  const members = GENERIC_TO_MODULES[target];
  if (members) for (const m of members) accept.add(m);

  return accept;
}

/**
 * Usuário pode executar a AÇÃO (ver/editar/inserir/excluir) no módulo?
 * Regras (retrocompatíveis):
 *  - 'todos', token liso do módulo, ou um generic aceitante → concede TODAS as ações (como hoje).
 *  - Granular: token '<modulo>:<acao>' concede aquela ação. Qualquer granular concede 'ver'.
 * Pra restringir alguém a só-ver, dá '<modulo>:ver' (sem o token liso nem generics).
 */
export function userCan(stored: ModulosPermitidos, moduleId: string, action: PermAction): boolean {
  if (!moduleId) return false;
  const userSet = expandUserPermissions(stored);
  if (userSet.has(TODOS)) return true;

  const target = canonicalize(moduleId);
  const rawId = moduleId.toLowerCase();

  // Acesso CHEIO: token liso do módulo (ou canônico) ou um generic aceitante → todas as ações.
  const accept = acceptingTokensFor(moduleId);
  for (const a of accept) if (userSet.has(a)) return true;

  // Granular: a ação específica.
  if (userSet.has(`${target}:${action}`) || userSet.has(`${rawId}:${action}`)) return true;

  // 'ver' também é concedido por QUALQUER grant granular no módulo.
  if (action === 'ver') {
    for (const t of userSet) {
      const s = splitAction(t);
      if (s.action && (s.base === target || s.base === rawId)) return true;
    }
  }
  return false;
}

/** Usuário tem acesso (pode ver/entrar) no módulo? (= userCan ..., 'ver') */
export function userHasModule(stored: ModulosPermitidos, moduleId: string): boolean {
  return userCan(stored, moduleId, 'ver');
}

/** Usuário tem acesso a PELO MENOS UM dos módulos requeridos? */
export function userHasAnyModule(stored: ModulosPermitidos, moduleIds: string[]): boolean {
  if (!moduleIds || moduleIds.length === 0) return true;
  const userSet = expandUserPermissions(stored);
  if (userSet.has(TODOS)) return true;
  return moduleIds.some(id => {
    const accept = acceptingTokensFor(id);
    for (const a of accept) if (userSet.has(a)) return true;
    return false;
  });
}

/** Lista de ids canônicos válidos (para validação/testes). */
export function getCanonicalModuleIds(): string[] {
  return MODULOS_MENU.map(m => m.id);
}
