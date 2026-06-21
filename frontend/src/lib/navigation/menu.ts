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
      { icon: 'PieChart', label: 'Segmentos (RFM)', href: '/analitico/clientes/segmentos', permission: 'relatorios' },
      { icon: 'TrendingUp', label: 'Retenção', href: '/analitico/clientes/retencao', permission: 'relatorios' },
      { icon: 'BarChart3', label: 'Eventos', href: '/analitico/eventos', permission: 'relatorios' },
    ],
  },
  {
    icon: 'Megaphone',
    label: 'Marketing',
    href: '/marketing/instagram',
    permission: 'gestao',
    subItems: [
      { icon: 'Instagram', label: 'Instagram', href: '/marketing/instagram', permission: 'gestao' },
    ],
  },
  {
    icon: 'ClipboardList',
    label: 'Operacional',
    href: '/operacional/nps',
    permission: 'gestao',
    subItems: [
      { icon: 'Star', label: 'NPS Funcionários', href: '/operacional/nps', permission: 'gestao' },
      { icon: 'Boxes', label: 'Estoque (contagem, compras, insumos)', href: '/operacional/contagem', permission: 'gestao' },
    ],
  },
  {
    icon: 'Wallet',
    label: 'Financeiro',
    href: '/financeiro/agendamentos',
    permission: 'home',
    subItems: [
      { icon: 'Calendar', label: 'Agendamentos', href: '/financeiro/agendamentos', permission: 'financeiro_agendamento' },
      { icon: 'Receipt', label: 'Pedidos de Pagamento', href: '/financeiro/pedidos-pagamento', permission: 'home' },
      { icon: 'Users', label: 'Beneficiários', href: '/financeiro/beneficiarios', permission: 'financeiro_agendamento' },
      { icon: 'BarChart3', label: 'Business Plan', href: '/financeiro/bp', permission: 'home' },
      { icon: 'FileText', label: 'DRE', href: '/financeiro/dre', permission: 'home' },
      { icon: 'TrendingUp', label: 'DFC', href: '/financeiro/dfc', permission: 'home' },
      { icon: 'Wallet', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-caixa', permission: 'home' },
      { icon: 'Layers', label: 'Balanço', href: '/financeiro/balanco', permission: 'home' },
      { icon: 'FileSearch', label: 'Consultas CA', href: '/ferramentas/consultas', permission: 'financeiro_agendamento' },
    ],
  },
  {
    icon: 'Briefcase',
    label: 'Comercial',
    href: '/comercial',
    permission: 'gestao',
    subItems: [
      { icon: 'Megaphone', label: 'Central Comercial', href: '/comercial', permission: 'gestao' },
    ],
  },
  {
    icon: 'Package',
    label: 'Produção - CMV',
    href: '/ferramentas/cmv-semanal/tabela',
    permission: 'gestao',
    subItems: [
      { icon: 'TrendingUp', label: 'Gestão CMV', href: '/ferramentas/cmv-semanal/tabela', permission: 'gestao' },
      { icon: 'AlertTriangle', label: 'Stockout', href: '/ferramentas/stockout', permission: 'gestao' },
    ],
  },
  {
    icon: 'Wrench',
    label: 'Ferramentas',
    href: '/ferramentas',
    permission: 'ferramentas',
    subItems: [
      { icon: 'Activity', label: 'Painel Executivo', href: '/ferramentas/painel-executivo', permission: 'home' },
      { icon: 'BarChart3', label: 'Análises Avançadas', href: '/ferramentas/analises', permission: 'gestao' },
      { icon: 'Users', label: 'CMO - Mão de Obra', href: '/ferramentas/cmo', permission: 'gestao' },
      { icon: 'Tag', label: 'Classificação de Grupos (Mix)', href: '/ferramentas/consumos-classificacao', permission: 'gestao' },
      { icon: 'AlertTriangle', label: 'Cancelamentos', href: '/ferramentas/cancelamentos', permission: 'gestao' },
      { icon: 'PieChart', label: 'Mix & Margem', href: '/ferramentas/mix-categoria', permission: 'gestao' },
    ],
  },
  {
    icon: 'Settings',
    label: 'Configurações',
    href: '/configuracoes',
    permission: 'configuracoes',
    subItems: [
      { icon: 'Bell', label: 'Notificações', href: '/configuracoes/notifications', permission: 'configuracoes' },
      { icon: 'Store', label: 'Bares', href: '/configuracoes/bares', permission: 'configuracoes' },
      { icon: 'Users', label: 'Administração', href: '/configuracoes/administracao/usuarios', permission: 'configuracoes' },
      { icon: 'Activity', label: 'Monitoramento', href: '/configuracoes/monitoramento', permission: 'configuracoes' },
      { icon: 'Server', label: 'Painel Supabase', href: '/configuracoes/painel', permission: 'configuracoes' },
      { icon: 'CheckSquare', label: 'Checklist Validação', href: '/checklist-validacao', permission: 'configuracoes' },
      { icon: 'Bot', label: 'Zykor Assistant', href: '/assistente-zykor', permission: 'gestao' },
    ],
  },
];
