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
  // Receitas absorveu Analítico + Marketing: herda os generics dos dois (aditivo).
  'Receitas': ['receitas', 'relatorios', 'analitico', 'gestao', 'dashboard', 'home'],
  'Ferramentas': ['ferramentas', 'operacoes', 'dashboard', 'home'],
  // Financeiro em 2 grupos. 'home'/'financeiro' mantêm quem já tinha acesso (aditivo);
  // o token único do grupo ('financeiro_relatorios'/'financeiro_ferramentas') permite
  // segmentar (ex: investidor recebe só 'financeiro_relatorios' e NÃO vê as ferramentas).
  'Relatórios Financeiros': ['financeiro_relatorios', 'financeiro', 'home'],
  // Ferramentas Financeiro agora é GRANULAR (1 módulo por ferramenta). Só o token do grupo
  // ('financeiro_ferramentas') concede TODAS as ferramentas (retrocompat p/ quem já tinha).
  // 'ferramentas'/'home' foram REMOVIDOS de propósito (segmentação). O 'financeiro' amplo
  // também foi REMOVIDO daqui (2026-07): ele concedia a categoria inteira (ex.: Agendamentos
  // aparecia no menu e abria pra quem tinha só 'financeiro', sem o V específico — caso do
  // arturpelinski, marketing, que só deveria ter Pedidos). Agora vale o módulo específico
  // (o "V" por ferramenta) ou o grupo 'financeiro_ferramentas'. Impacto verificado: só 1
  // usuário dependia do 'financeiro' amplo aqui, e ele mantém Pedidos pelo grant granular.
  'Ferramentas Financeiro': ['financeiro_ferramentas'],
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
  // Após a quebra de "Ferramentas Financeiro" em módulos por ferramenta, os tokens legados de
  // agendamento (usados por perfis antigos/tablets) continuam concedendo só a aba Agendamentos.
  'ferramentas financeiro_agendamentos': ['ferramentas_agendamento', 'financeiro_agendamento'],
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
  // A página /operacional/producoes é liberada por estes tokens (route-permissions/menu). Eles
  // mapeiam pro módulo `producao - cmv_controle_de_producao`, mas concedem só a AÇÃO 'ver' (abrir a
  // página) — NÃO CRUD completo. As ações de ESCRITA vêm dos granulares explícitos que a conta tem
  // (`...:inserir`/`:editar`/`:excluir`). Assim o token de página não "vaza" excluir: os tablets têm
  // `:ver/:editar/:inserir` (sem `:excluir`) e ficam sem poder apagar histórico, enquanto quem tem o
  // token LISO do módulo (ex.: Isaías/admin) mantém CRUD completo. Ao criar um novo perfil de tablet,
  // conceda os granulares de escrita desejados além do token de página (senão abre mas dá 403 ao salvar).
  operacional_producoes: 'producao - cmv_controle_de_producao:ver',
  controle_producao: 'producao - cmv_controle_de_producao:ver',
  // Estratégico
  desempenho: 'estrategico_desempenho',
  estrategico_planejamento_comercial: 'estrategico_planejamento',
  planejamento: 'estrategico_planejamento',
  orcamentacao: 'estrategico_orcamentacao',
  visao_geral: 'estrategico_visao_geral',
  // Receitas — absorveu Analítico + Marketing (08/07/2026). Os itens migraram de seção,
  // então o id canônico virou `receitas_*`. Estes aliases mantêm os grants antigos
  // salvos no banco (ids de Analítico/Marketing) funcionando sem migração de dados.
  analitico_clientes: 'receitas_clientes',
  analitico_eventos: 'receitas_eventos',
  analitico_visao_do_artista: 'receitas_visao_do_artista',
  analitico_taggear_artistas: 'receitas_taggear_artistas',
  marketing_instagram: 'receitas_instagram',
  marketing_segmentos_rfm: 'receitas_segmentos_rfm',
  marketing_retencao: 'receitas_retencao',
  // Sinônimos curtos legados (já existiam) reapontados pro novo canônico.
  clientes: 'receitas_clientes',
  relatorios_clientes: 'receitas_clientes',
  eventos: 'receitas_eventos',
  relatorios_eventos: 'receitas_eventos',
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

/**
 * Usuário tem acesso a PELO MENOS UM dos módulos requeridos?
 * Delega a `userCan(..., 'ver')` por módulo: além do token liso e dos generics, isso faz
 * QUALQUER grant granular ('<modulo>:ver/editar/inserir/excluir') conceder o "ver" — sem isso
 * quem só tem os granulares (ex.: `ferramentas financeiro_pedidos_de_pagamento:ver`) era barrado
 * na porta da página mesmo tendo direito legítimo (guard de página caía em acesso_negado).
 */
export function userHasAnyModule(stored: ModulosPermitidos, moduleIds: string[]): boolean {
  if (!moduleIds || moduleIds.length === 0) return true;
  const userSet = expandUserPermissions(stored);
  if (userSet.has(TODOS)) return true;
  return moduleIds.some(id => userCan(stored, id, 'ver'));
}

/** Lista de ids canônicos válidos (para validação/testes). */
export function getCanonicalModuleIds(): string[] {
  return MODULOS_MENU.map(m => m.id);
}
