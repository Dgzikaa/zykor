/**
 * Configuração DINÂMICA do Menu Lateral
 * 
 * Este arquivo IMPORTA a estrutura do menu lateral e gera automaticamente
 * os módulos de permissão. Assim, qualquer alteração no menu lateral
 * reflete AUTOMATICAMENTE nas permissões de usuários.
 * 
 * FONTE ÚNICA DE VERDADE: ModernSidebarOptimized.tsx
 */

// Interface para módulos de permissão (usada pela API)
export interface ModuloPermissao {
  id: string;
  nome: string;
  categoria: string;
}

/**
 * Estrutura do menu lateral (importada dinamicamente)
 * Esta é uma cópia da estrutura do ModernSidebarOptimized.tsx
 * para evitar dependências circulares e problemas de importação client/server
 */
const MENU_LATERAL_STRUCTURE = [
  {
    label: 'Estratégico',
    subItems: [
      { label: 'Visão Geral', href: '/estrategico/visao-geral' },
      { label: 'Desempenho', href: '/estrategico/desempenho' },
      { label: 'Planejamento', href: '/estrategico/planejamento-comercial' },
      { label: 'Orçamentação', href: '/estrategico/orcamentacao' },
    ],
  },
  {
    label: 'Analítico',
    subItems: [
      { label: 'Clientes', href: '/analitico/clientes' },
      { label: 'Eventos', href: '/analitico/eventos' },
    ],
  },
  {
    label: 'Ferramentas',
    subItems: [
      { label: 'CRM', href: '/ferramentas/crm' },
      { label: 'Agendamento', href: '/ferramentas/agendamento' },
      { label: 'NPS Funcionários', href: '/ferramentas/nps' },
      { label: 'Voz do Cliente', href: '/ferramentas/voz-cliente' },
      { label: 'CMV Semanal', href: '/ferramentas/cmv-semanal' },
      { label: 'CMA - Alimentação', href: '/ferramentas/cma-semanal' },
      { label: 'CMO - Mão de Obra', href: '/ferramentas/cmo' },
      { label: 'Stockout', href: '/ferramentas/stockout' },
      { label: 'Consultas', href: '/ferramentas/consultas' },
    ],
  },
  {
    label: 'Configurações',
    subItems: [
      { label: 'Usuários', href: '/configuracoes/usuarios' },
      { label: 'Fichas Técnicas', href: '/configuracoes/fichas-tecnicas' },
      { label: 'Checklists', href: '/configuracoes/checklists' },
      { label: 'Metas', href: '/configuracoes/metas' },
      { label: 'Teste de Produção', href: '/configuracoes/teste-producao' },
      { label: 'Calendário Operacional', href: '/configuracoes/calendario-operacional' },
      { label: 'Auditoria', href: '/configuracoes/auditoria' },
      { label: 'Saúde dos Dados', href: '/configuracoes/saude-dados' },
      { label: 'Monitoramento', href: '/configuracoes/monitoramento' },
    ],
  },
  {
    label: 'Extras',
    subItems: [
      { label: 'Produção e Insumos', href: '/ferramentas/producao-insumos' },
      { label: 'Contagem de Estoque', href: '/ferramentas/contagem-estoque' },
      { label: 'DRE', href: '/ferramentas/dre' },
      { label: 'Tempo de Estadia', href: '/relatorios/tempo-estadia' },
      { label: 'Retrospectiva 2025', href: '/retrospectiva-2025' },
      { label: 'Impacto Entrada', href: '/ferramentas/analise-couvert' },
      { label: 'Central Comercial', href: '/ferramentas/comercial' },
    ],
  },
];

/**
 * Gera ID único para o módulo baseado na categoria e nome
 */
function gerarIdModulo(categoria: string, nome: string): string {
  const categoriaSlug = categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nomeSlug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${categoriaSlug}_${nomeSlug}`;
}

/**
 * MÓDULOS GERADOS AUTOMATICAMENTE DO MENU LATERAL
 * Esta lista é gerada dinamicamente da estrutura acima
 */
export const MODULOS_MENU: ModuloPermissao[] = MENU_LATERAL_STRUCTURE.flatMap(secao =>
  secao.subItems.map(item => ({
    id: gerarIdModulo(secao.label, item.label),
    nome: item.label,
    categoria: secao.label,
  }))
);

/**
 * Retorna todos os módulos disponíveis para configuração de permissões
 */
export function getModulosParaPermissoes(): ModuloPermissao[] {
  return MODULOS_MENU;
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

/**
 * MAPEAMENTO AUTOMÁTICO: Módulo específico -> Permissões genéricas
 * 
 * Este mapeamento é gerado automaticamente baseado na categoria do módulo.
 * Regras:
 * - Estratégico -> ['gestao', 'home']
 * - Analítico -> ['relatorios']
 * - Ferramentas -> ['ferramentas', 'operacoes']
 * - Configurações -> ['configuracoes']
 * - Extras -> ['home', 'relatorios']
 */
function gerarPermissoesAutomaticas(categoria: string): string[] {
  const mapa: Record<string, string[]> = {
    'Estratégico': ['gestao', 'home'],
    'Analítico': ['relatorios'],
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
