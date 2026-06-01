/**
 * FONTE ÚNICA do menu lateral do sistema.
 *
 * Dados puros (sem React, sem 'use client') de propósito: é importado tanto pela
 * sidebar renderizada (`components/layouts/MinimalSidebar.tsx`, client) quanto pela
 * derivação de permissões/route-guards (`lib/permissions/modules.ts`, usado no server).
 *
 * O ícone é o NOME do ícone do lucide-react (string); a sidebar mapeia nome -> componente.
 * Assim este arquivo não arrasta React pro código de permissões.
 *
 * Para adicionar/remover um item do menu: edite SÓ este arquivo. A sidebar e as
 * permissões saem daqui. O teste `__tests__/menu.test.ts` falha se um item apontar
 * para uma rota inexistente.
 */

export interface MenuLeaf {
  /** Nome do ícone lucide-react (ex: 'Calendar'). Mapeado para componente na sidebar. */
  icon: string;
  label: string;
  href: string;
  /** Chave de permissão (resolvida pelo resolver único). */
  permission?: string;
}

export interface MenuSection {
  icon: string;
  label: string;
  href: string;
  permission?: string;
  subItems: MenuLeaf[];
}

export const MENU_TREE: MenuSection[] = [
  {
    icon: 'Target',
    label: 'Estratégico',
    href: '/estrategico',
    permission: 'gestao',
    subItems: [
      { icon: 'TrendingUp', label: 'Visão Geral', href: '/estrategico/visao-geral', permission: 'home' },
      { icon: 'BarChart3', label: 'Desempenho', href: '/estrategico/desempenho', permission: 'gestao' },
      { icon: 'Calendar', label: 'Planejamento', href: '/estrategico/planejamento-comercial', permission: 'planejamento' },
      { icon: 'DollarSign', label: 'Orçamentação', href: '/estrategico/orcamentacao', permission: 'home' },
    ],
  },
  {
    icon: 'BarChart3',
    label: 'Analítico',
    href: '/analitico',
    permission: 'relatorios',
    subItems: [
      { icon: 'Users', label: 'Clientes', href: '/analitico/clientes', permission: 'relatorios' },
      { icon: 'BarChart3', label: 'Eventos', href: '/analitico/eventos', permission: 'relatorios' },
    ],
  },
  {
    icon: 'Wrench',
    label: 'Ferramentas',
    href: '/ferramentas',
    permission: 'ferramentas',
    subItems: [
      { icon: 'Zap', label: 'Insights Estratégicos', href: '/ferramentas/insights', permission: 'gestao' },
      { icon: 'BarChart3', label: 'Análises Avançadas', href: '/ferramentas/analises', permission: 'gestao' },
      { icon: 'Wallet', label: 'Financeiro', href: '/ferramentas/financeiro', permission: 'gestao' },
      { icon: 'Calendar', label: 'Agendamento', href: '/ferramentas/agendamento', permission: 'financeiro_agendamento' },
      { icon: 'Receipt', label: 'Pedidos de Pagamento', href: '/ferramentas/pedidos-pagamento', permission: 'home' },
      { icon: 'MessageCircle', label: 'CRM', href: '/ferramentas/crm', permission: 'gestao' },
      { icon: 'TrendingUp', label: 'Gestão CMV', href: '/ferramentas/cmv-semanal', permission: 'gestao' },
      { icon: 'ChefHat', label: 'CMA - Alimentação', href: '/ferramentas/cma-semanal', permission: 'gestao' },
      { icon: 'Users', label: 'CMO - Mão de Obra', href: '/ferramentas/cmo', permission: 'gestao' },
      { icon: 'Tag', label: 'Classificação de Consumos', href: '/ferramentas/consumos-classificacao', permission: 'gestao' },
      { icon: 'AlertTriangle', label: 'Stockout', href: '/ferramentas/stockout', permission: 'gestao' },
      { icon: 'FileSearch', label: 'Consultas', href: '/ferramentas/consultas', permission: 'financeiro_agendamento' },
      { icon: 'Star', label: 'NPS Funcionários', href: '/ferramentas/nps', permission: 'gestao' },
      { icon: 'Instagram', label: 'Instagram', href: '/ferramentas/instagram', permission: 'gestao' },
      { icon: 'Bot', label: 'Zykor Assistant', href: '/ferramentas/assistente-zykor', permission: 'gestao' },
    ],
  },
  {
    icon: 'Sparkles',
    label: 'Extras',
    href: '/extras',
    permission: 'home',
    subItems: [
      { icon: 'PieChart', label: 'DRE', href: '/ferramentas/dre', permission: 'gestao' },
      { icon: 'Package', label: 'Produção e Insumos', href: '/ferramentas/producao-insumos', permission: 'gestao' },
      { icon: 'Layers', label: 'Contagem de Estoque', href: '/ferramentas/contagem-estoque', permission: 'gestao' },
      { icon: 'Megaphone', label: 'Central Comercial', href: '/ferramentas/comercial', permission: 'gestao' },
      { icon: 'Ticket', label: 'Impacto Entrada', href: '/ferramentas/analise-couvert', permission: 'gestao' },
      { icon: 'Clock', label: 'Tempo de Estadia', href: '/relatorios/tempo-estadia', permission: 'relatorios' },
      { icon: 'FileText', label: 'Fichas Técnicas', href: '/extras/fichas-tecnicas', permission: 'gestao' },
      { icon: 'CheckSquare', label: 'Checklists', href: '/extras/checklists', permission: 'gestao' },
      { icon: 'Calendar', label: 'Calendário Operacional', href: '/extras/calendario-operacional', permission: 'home' },
    ],
  },
  {
    icon: 'Settings',
    label: 'Configurações',
    href: '/configuracoes',
    permission: 'configuracoes',
    subItems: [
      { icon: 'Users', label: 'Administração', href: '/configuracoes/administracao/usuarios', permission: 'configuracoes' },
      { icon: 'Target', label: 'Metas', href: '/configuracoes/metas', permission: 'configuracoes' },
      { icon: 'Activity', label: 'Teste de Produção', href: '/configuracoes/teste-producao', permission: 'configuracoes' },
      { icon: 'Activity', label: 'Saúde dos Dados', href: '/configuracoes/saude-dados', permission: 'configuracoes' },
      { icon: 'Activity', label: 'Monitoramento', href: '/configuracoes/monitoramento', permission: 'configuracoes' },
      { icon: 'CheckSquare', label: 'Checklist Validação', href: '/checklist-validacao', permission: 'configuracoes' },
    ],
  },
];
