/**
 * Configuração Centralizada do Menu Lateral
 * 
 * FONTE ÚNICA DE VERDADE para:
 * - Estrutura do menu lateral (sidebar)
 * - Módulos disponíveis para permissões de usuários
 * 
 * Qualquer alteração aqui reflete automaticamente em:
 * - API de permissões (/api/configuracoes/permissoes)
 * - Tela de edição de usuários
 * 
 * IMPORTANTE: Ao adicionar/remover itens do menu, também atualize o
 * arquivo ModernSidebarOptimized.tsx para manter sincronizado.
 */

// Interface para módulos de permissão (usada pela API)
export interface ModuloPermissao {
  id: string;
  nome: string;
  categoria: string;
}

/**
 * MÓDULOS DISPONÍVEIS PARA PERMISSÕES
 * 
 * Organizados por seção do menu lateral.
 * Cada módulo aqui corresponde a um item do menu.
 */
export const MODULOS_MENU: ModuloPermissao[] = [
  // ═══════════════════════════════════════════════════════════════
  // ESTRATÉGICO
  // ═══════════════════════════════════════════════════════════════
  { id: 'estrategico_visao_geral', nome: 'Visão Geral', categoria: 'Estratégico' },
  { id: 'estrategico_desempenho', nome: 'Desempenho', categoria: 'Estratégico' },
  { id: 'estrategico_planejamento', nome: 'Planejamento Comercial', categoria: 'Estratégico' },
  { id: 'estrategico_orcamentacao', nome: 'Orçamentação', categoria: 'Estratégico' },
  
  // ═══════════════════════════════════════════════════════════════
  // ANALÍTICO
  // ═══════════════════════════════════════════════════════════════
  { id: 'analitico_clientes', nome: 'Clientes', categoria: 'Analítico' },
  { id: 'analitico_tempo_estadia', nome: 'Tempo de Estadia', categoria: 'Analítico' },
  { id: 'analitico_impacto_entrada', nome: 'Impacto Entrada', categoria: 'Analítico' },
  { id: 'analitico_eventos', nome: 'Eventos', categoria: 'Analítico' },
  { id: 'analitico_retrospectiva', nome: 'Retrospectiva 2025', categoria: 'Analítico' },
  
  // ═══════════════════════════════════════════════════════════════
  // CRM
  // ═══════════════════════════════════════════════════════════════
  { id: 'crm_umbler', nome: 'Umbler Talk', categoria: 'CRM' },
  { id: 'crm_segmentacao', nome: 'Segmentação RFM', categoria: 'CRM' },
  { id: 'crm_churn', nome: 'Predição Churn', categoria: 'CRM' },
  { id: 'crm_ltv', nome: 'LTV e Engajamento', categoria: 'CRM' },
  { id: 'crm_padroes', nome: 'Padrões de Comportamento', categoria: 'CRM' },
  
  // ═══════════════════════════════════════════════════════════════
  // FERRAMENTAS
  // ═══════════════════════════════════════════════════════════════
  { id: 'ferramentas_comercial', nome: 'Central Comercial', categoria: 'Ferramentas' },
  { id: 'ferramentas_producao', nome: 'Produção e Insumos', categoria: 'Ferramentas' },
  { id: 'ferramentas_contagem_estoque', nome: 'Contagem de Estoque', categoria: 'Ferramentas' },
  { id: 'ferramentas_contagem_rapida', nome: 'Contagem Rápida', categoria: 'Ferramentas' },
  { id: 'ferramentas_agendamento', nome: 'Agendamento', categoria: 'Ferramentas' },
  { id: 'ferramentas_nps', nome: 'NPS Funcionários', categoria: 'Ferramentas' },
  { id: 'ferramentas_cmv', nome: 'CMV Semanal', categoria: 'Ferramentas' },
  { id: 'ferramentas_cma', nome: 'CMA - Alimentação Funcionários', categoria: 'Ferramentas' },
  { id: 'ferramentas_cmo', nome: 'CMO Semanal', categoria: 'Ferramentas' },
  { id: 'ferramentas_cmo_dashboard', nome: 'CMO - Dashboard', categoria: 'Ferramentas' },
  { id: 'ferramentas_cmo_comparar', nome: 'CMO - Comparar', categoria: 'Ferramentas' },
  { id: 'ferramentas_cmo_alertas', nome: 'CMO - Alertas', categoria: 'Ferramentas' },
  { id: 'ferramentas_stockout', nome: 'Stockout', categoria: 'Ferramentas' },
  { id: 'ferramentas_consultas', nome: 'Consultas', categoria: 'Ferramentas' },
  { id: 'ferramentas_dre', nome: 'DRE', categoria: 'Ferramentas' },
  
  // ═══════════════════════════════════════════════════════════════
  // CONFIGURAÇÕES
  // ═══════════════════════════════════════════════════════════════
  { id: 'config_usuarios', nome: 'Usuários', categoria: 'Configurações' },
  { id: 'config_fichas_tecnicas', nome: 'Fichas Técnicas', categoria: 'Configurações' },
  { id: 'config_checklists', nome: 'Checklists', categoria: 'Configurações' },
  { id: 'config_metas', nome: 'Metas', categoria: 'Configurações' },
  { id: 'config_teste_producao', nome: 'Teste de Produção', categoria: 'Configurações' },
  { id: 'config_calendario', nome: 'Calendário Operacional', categoria: 'Configurações' },
  { id: 'config_auditoria', nome: 'Auditoria', categoria: 'Configurações' },
  { id: 'config_saude_dados', nome: 'Saúde dos Dados', categoria: 'Configurações' },
  { id: 'config_monitoramento', nome: 'Monitoramento', categoria: 'Configurações' },
];

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
 * MAPEAMENTO: Módulo específico -> Permissões genéricas que ele concede
 * 
 * Quando um usuário tem um módulo específico (ex: 'estrategico_desempenho'),
 * ele automaticamente ganha acesso às permissões genéricas listadas aqui.
 * Isso permite que o sidebar (que usa permissões genéricas) funcione corretamente.
 */
export const MODULO_TO_PERMISSIONS: Record<string, string[]> = {
  // Estratégico
  estrategico_visao_geral: ['home', 'gestao'],
  estrategico_desempenho: ['gestao'],
  estrategico_planejamento: ['planejamento', 'gestao'],
  estrategico_orcamentacao: ['home', 'gestao'],
  
  // Analítico
  analitico_clientes: ['relatorios'],
  analitico_tempo_estadia: ['relatorios'],
  analitico_impacto_entrada: ['relatorios'],
  analitico_eventos: ['relatorios'],
  analitico_retrospectiva: ['home', 'relatorios'],
  
  // CRM
  crm_umbler: ['gestao'],
  crm_segmentacao: ['gestao'],
  crm_churn: ['gestao'],
  crm_ltv: ['gestao'],
  crm_padroes: ['gestao'],
  
  // Ferramentas
  ferramentas_comercial: ['gestao', 'ferramentas'],
  ferramentas_producao: ['operacoes', 'ferramentas'],
  ferramentas_contagem_estoque: ['operacoes', 'ferramentas'],
  ferramentas_contagem_rapida: ['operacoes', 'ferramentas'],
  ferramentas_agendamento: ['financeiro_agendamento', 'ferramentas'],
  ferramentas_nps: ['gestao', 'ferramentas'],
  ferramentas_cmv: ['gestao', 'ferramentas'],
  ferramentas_stockout: ['gestao', 'ferramentas'],
  ferramentas_consultas: ['financeiro_agendamento', 'ferramentas'],
  ferramentas_dre: ['dashboard_financeiro_mensal', 'ferramentas'],
  
  // Configurações
  config_usuarios: ['configuracoes'],
  config_fichas_tecnicas: ['operacoes', 'configuracoes'],
  config_checklists: ['configuracoes'],
  config_metas: ['configuracoes'],
  config_teste_producao: ['operacoes', 'configuracoes'],
  config_calendario: ['operacoes', 'configuracoes'],
  config_auditoria: ['configuracoes'],
  config_saude_dados: ['configuracoes'],
  config_monitoramento: ['configuracoes'],
};

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
      .filter(m => ['Estratégico', 'Analítico', 'CRM', 'Ferramentas'].includes(m.categoria))
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
