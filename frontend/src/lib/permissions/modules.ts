/**
 * MÓDULOS DE PERMISSÃO + ROUTE GUARDS (derivados do menu lateral)
 *
 * Antigo `lib/menu-config.ts`. Não define mais a estrutura do menu — ele DERIVA da
 * FONTE ÚNICA (`lib/navigation/menu.ts`). Assim a sidebar renderizada e as permissões
 * saem do mesmo lugar e não divergem.
 *
 * Gera:
 * - MODULOS_MENU: ids canônicos de módulo (categoria_nome) usados pelo resolver e pela
 *   tela de permissões.
 * - getMenuRoutePermissions(): mapa rota -> módulos exigidos (route guards).
 * - ROLES_PADRAO: presets de papel.
 *
 * A CHECAGEM de permissão (alias/generics/'todos') vive no resolver único
 * (`lib/permissions/resolver.ts`).
 */

import { MENU_TREE } from '../navigation/menu';

// Interface para módulos de permissão (usada pela API)
export interface ModuloPermissao {
  id: string;
  nome: string;
  categoria: string;
}

export interface MenuSubItemConfig {
  label: string;
  href: string;
}

export interface MenuSectionConfig {
  label: string;
  subItems: MenuSubItemConfig[];
}

/**
 * Estrutura do menu para fins de permissão, derivada da fonte única.
 * (Só precisamos de label + href + categoria aqui; ícones ficam na sidebar.)
 */
export const MENU_LATERAL_STRUCTURE: MenuSectionConfig[] = MENU_TREE.map(secao => ({
  label: secao.label,
  subItems: secao.subItems.map(item => ({ label: item.label, href: item.href })),
}));

/**
 * Gera ID único para o módulo baseado na categoria e nome
 */
function gerarIdModulo(categoria: string, nome: string): string {
  const categoriaSlug = categoria.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const nomeSlug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${categoriaSlug}_${nomeSlug}`;
}

/**
 * Seções com PERMISSÃO ÚNICA por grupo (1 toggle libera o grupo inteiro), em vez de
 * um módulo por item. Usado p/ segmentar acesso (ex: investidor só vê Relatórios).
 */
const GRUPO_MODULO_UNICO: Record<string, string> = {
  'Relatórios Financeiros': 'financeiro_relatorios',
  'Ferramentas Financeiro': 'financeiro_ferramentas',
};

/**
 * MÓDULOS EXTRAS (NÃO derivados do menu): permissões granulares que não correspondem
 * a uma página, mas precisam aparecer na matriz "Acesso por módulo" (V/I/E/X) e ser
 * checadas pelo resolver. Não têm generic de categoria — só são concedidas por grant
 * EXPLÍCITO (token liso ou `<id>:<ação>`), nunca "vazam" por permissão genérica.
 */
export const MODULOS_EXTRAS: ModuloPermissao[] = [
  // Gerir a equipe de responsáveis do Controle de Produção (adicionar/editar/remover
  // pessoas do dropdown de "responsável"). Quem tiver Inserir e/ou Editar aqui pode abrir
  // "Gerir equipe" na tela de Produções — sem precisar ser admin.
  { id: 'producao - cmv_gerir_equipe', nome: 'Gerir Equipe (Responsáveis)', categoria: 'Produção - CMV' },
];

/**
 * MÓDULOS GERADOS AUTOMATICAMENTE DO MENU LATERAL (+ extras curados).
 * Seções em GRUPO_MODULO_UNICO viram UM módulo (o grupo); as demais, um por item.
 */
export const MODULOS_MENU: ModuloPermissao[] = [
  ...MENU_LATERAL_STRUCTURE.flatMap(secao => {
    const grupo = GRUPO_MODULO_UNICO[secao.label];
    if (grupo) {
      return [{ id: grupo, nome: secao.label, categoria: secao.label }];
    }
    return secao.subItems.map(item => ({
      id: gerarIdModulo(secao.label, item.label),
      nome: item.label,
      categoria: secao.label,
    }));
  }),
  ...MODULOS_EXTRAS,
];

/**
 * Retorna todos os módulos disponíveis para configuração de permissões
 */
export function getModulosParaPermissoes(): ModuloPermissao[] {
  return MODULOS_MENU;
}

/** Módulo específico de uma rota do menu (ex.: '/operacional/fichas-tecnicas' -> id do módulo). */
export function getModuleIdForPath(path: string): string | null {
  for (const section of MENU_LATERAL_STRUCTURE) {
    const grupo = GRUPO_MODULO_UNICO[section.label];
    for (const item of section.subItems) {
      if (item.href.split('?')[0].split('#')[0] === path) return grupo ?? gerarIdModulo(section.label, item.label);
    }
  }
  return null;
}

/**
 * Retorna módulos agrupados por categoria
 */
export function getModulosPorCategoria(): Record<string, ModuloPermissao[]> {
  return MODULOS_MENU.reduce((acc, modulo) => {
    if (!acc[modulo.categoria]) {
      acc[modulo.categoria] = [];
    }
    acc[modulo.categoria].push(modulo);
    return acc;
  }, {} as Record<string, ModuloPermissao[]>);
}

/**
 * Retorna lista de categorias disponíveis
 */
export function getCategorias(): string[] {
  return [...new Set(MODULOS_MENU.map(m => m.categoria))];
}

export interface MenuRoutePermissionEntry {
  path: string;
  requiredModules: string[];
}

function buildSectionFallbackModules(categoria: string): string[] {
  const categoriaLower = categoria.toLowerCase();
  const mapa: Record<string, string[]> = {
    'estratégico': ['estrategico', 'gestao', 'desempenho', 'dashboard', 'home'],
    estrategico: ['estrategico', 'gestao', 'desempenho', 'dashboard', 'home'],
    analitico: ['analitico', 'relatorios', 'dashboard', 'home'],
    'analítico': ['analitico', 'relatorios', 'dashboard', 'home'],
    // Receitas absorveu Analítico + Marketing: inclui os generics dos dois (relatorios,
    // analitico, gestao) pra quem tinha qualquer um deles continuar acessando.
    receitas: ['receitas', 'relatorios', 'analitico', 'gestao', 'dashboard', 'home'],
    ferramentas: ['ferramentas', 'operacoes', 'dashboard', 'home'],
    marketing: ['gestao', 'home'],
    operacional: ['gestao', 'operacoes', 'home'],
    financeiro: ['financeiro_agendamento', 'home'],
    'relatórios financeiros': ['financeiro_relatorios'],
    'relatorios financeiros': ['financeiro_relatorios'],
    'ferramentas financeiro': ['financeiro_ferramentas'],
    comercial: ['gestao', 'home'],
    configurações: ['configuracoes'],
    configuracoes: ['configuracoes'],
    extras: ['home', 'relatorios'],
  };
  return mapa[categoriaLower] || ['home'];
}

/**
 * Gera mapeamento de rotas a partir do menu lateral (fonte única de verdade).
 * Cada rota herda:
 * - módulo específico do item (ex: analitico_clientes)
 * - permissões genéricas da categoria (ex: relatorios, analitico, home)
 */
export function getMenuRoutePermissions(): MenuRoutePermissionEntry[] {
  const entries = MENU_LATERAL_STRUCTURE.flatMap(section =>
    section.subItems.map(item => {
      const moduleId = GRUPO_MODULO_UNICO[section.label] ?? gerarIdModulo(section.label, item.label);
      const fallback = buildSectionFallbackModules(section.label);
      return {
        // tira query/hash: o guard casa pelo pathname (ex.: /graficos?m=x → /graficos)
        path: item.href.split('?')[0].split('#')[0],
        requiredModules: Array.from(new Set([moduleId, ...fallback])),
      };
    })
  );

  return entries.sort((a, b) => b.path.length - a.path.length);
}

/**
 * MAPEAMENTO AUTOMÁTICO: Módulo específico -> Permissões genéricas
 */
function gerarPermissoesAutomaticas(categoria: string): string[] {
  const mapa: Record<string, string[]> = {
    'Estratégico': ['gestao', 'home'],
    'Receitas': ['relatorios', 'analitico', 'gestao', 'home'],
    'Analítico': ['relatorios'],
    'Marketing': ['gestao'],
    'Operacional': ['gestao', 'operacoes'],
    'Financeiro': ['financeiro_agendamento', 'home'],
    'Relatórios Financeiros': ['financeiro_relatorios', 'financeiro', 'home'],
    'Ferramentas Financeiro': ['financeiro_ferramentas', 'financeiro', 'ferramentas', 'ferramentas_agendamento', 'home'],
    'Comercial': ['gestao'],
    'Ferramentas': ['ferramentas', 'operacoes'],
    'Configurações': ['configuracoes'],
    'Extras': ['home', 'relatorios'],
  };
  return mapa[categoria] || ['home'];
}

export const MODULO_TO_PERMISSIONS: Record<string, string[]> = MODULOS_MENU.reduce((acc, modulo) => {
  acc[modulo.id] = gerarPermissoesAutomaticas(modulo.categoria);
  return acc;
}, {} as Record<string, string[]>);

/**
 * Dado um array de módulos específicos, retorna todas as permissões genéricas
 * que esses módulos concedem.
 */
export function getPermissoesFromModulos(modulos: string[]): string[] {
  const permissoes = new Set<string>();

  for (const modulo of modulos) {
    const perms = MODULO_TO_PERMISSIONS[modulo];
    if (perms) {
      perms.forEach(p => permissoes.add(p));
    }
    // Também adiciona o próprio módulo como permissão
    permissoes.add(modulo);
  }

  return Array.from(permissoes);
}

// Roles padrão com módulos baseados no menu
export const ROLES_PADRAO = {
  admin: {
    nome: 'Administrador',
    descricao: 'Acesso completo ao sistema',
    modulos: ['todos'],
  },
  manager: {
    nome: 'Gerente',
    descricao: 'Acesso a gestão, relatórios e configurações',
    modulos: MODULOS_MENU
      .filter(m => ['Estratégico', 'Analítico', 'Ferramentas'].includes(m.categoria))
      .map(m => m.id),
  },
  funcionario: {
    nome: 'Funcionário',
    descricao: 'Acesso a ferramentas operacionais',
    modulos: [
      'ferramentas_producao',
      'ferramentas_contagem_estoque',
      'ferramentas_contagem_rapida',
      'config_teste_producao',
      'config_calendario',
    ],
  },
};
