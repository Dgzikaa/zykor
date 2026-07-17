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
  /** Marca o item específico como "em construção" — badge Beta ao lado do label. */
  beta?: boolean;
}

/**
 * Cabeçalho visual (CAIXA ALTA) que separa grupos dentro de uma seção. Sem clique,
 * sem href, sem permissão própria — os itens abaixo dele carregam suas permissões.
 */
export interface MenuHeader {
  header: string;
}

export type MenuNode = MenuLeaf | MenuHeader;

export function isMenuLeaf(n: MenuNode): n is MenuLeaf {
  return 'href' in n;
}

export interface MenuSection {
  icon: string;
  label: string;
  href: string;
  permission?: string;
  subItems: MenuNode[];
  /** Marca a seção como "em construção" — mostra badge Beta na sidebar. */
  beta?: boolean;
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
    // Área unificada: absorve Analítico + Marketing (reunião mkt 08/07/2026).
    // As URLs físicas (/analitico/*, /marketing/*) são mantidas — só o agrupamento
    // do menu muda, então não há redirect nem link morto. Os ids de módulo passam a
    // ser `receitas_*`; a retrocompatibilidade é garantida por aliases no resolver.
    icon: 'Coins',
    label: 'Receitas',
    href: '/receitas',
    permission: 'relatorios',
    // Análise (IA) e Taggear Artistas viraram botão dentro das próprias páginas
    // (/receitas e /analitico/atracoes) — saíram do menu. Sub-header "Clientes"
    // agrupa dashboard + segmentos/win-back/retenção pra facilitar navegação.
    subItems: [
      { icon: 'BarChart3', label: 'Dashboard de Receitas', href: '/receitas', permission: 'relatorios' },
      { icon: 'Megaphone', label: 'Comunicação', href: '/receitas/comunicacao', permission: 'relatorios' },
      { icon: 'Gift', label: 'Fidelização', href: '/receitas/fidelidade', permission: 'relatorios' },
      { icon: 'Music', label: 'Visão do Artista', href: '/analitico/atracoes', permission: 'relatorios' },
      { icon: 'BarChart3', label: 'Eventos', href: '/analitico/eventos', permission: 'relatorios' },
      { header: 'Clientes' },
      { icon: 'Users', label: 'Clientes', href: '/analitico/clientes', permission: 'relatorios' },
      { icon: 'PieChart', label: 'Segmentos (RFM)', href: '/analitico/clientes/segmentos', permission: 'relatorios' },
      { icon: 'HeartHandshake', label: 'Win-back', href: '/analitico/clientes/win-back', permission: 'relatorios' },
      { icon: 'TrendingUp', label: 'Retenção', href: '/analitico/clientes/retencao', permission: 'relatorios' },
    ],
  },
  {
    // Relatórios fechados — segmentável p/ investidores (permissão única 'financeiro_relatorios').
    icon: 'FileText',
    label: 'Relatórios Financeiros',
    href: '/financeiro/dre',
    permission: 'financeiro_relatorios',
    subItems: [
      { icon: 'FileText', label: 'DRE', href: '/financeiro/dre', permission: 'financeiro_relatorios' },
      { icon: 'TrendingUp', label: 'DFC', href: '/financeiro/dfc', permission: 'financeiro_relatorios' },
      { icon: 'Layers', label: 'Balanço Patrimonial', href: '/financeiro/balanco', permission: 'financeiro_relatorios' },
      { icon: 'BarChart3', label: 'Business Plan', href: '/financeiro/bp', permission: 'financeiro_relatorios' },
    ],
  },
  {
    icon: 'Wallet',
    label: 'Ferramentas Financeiro',
    href: '/financeiro/agendamentos',
    permission: 'financeiro_ferramentas',
    // Cada ferramenta = módulo próprio (categoria_nome). `financeiro_ferramentas` segue como
    // GENERIC (concede todas — retrocompat) no resolver; aqui cada item filtra pela sua própria.
    // Sub-headers (Pagamentos / Conta Azul / Contábil) são só visuais — não mexem em permissão.
    subItems: [
      { header: 'Pagamentos' },
      { icon: 'Calendar', label: 'Agendamentos', href: '/financeiro/agendamentos', permission: 'ferramentas financeiro_agendamentos' },
      { icon: 'Receipt', label: 'Pedidos de Pagamento', href: '/financeiro/pedidos-pagamento', permission: 'ferramentas financeiro_pedidos_de_pagamento' },
      { icon: 'HandCoins', label: 'Freelas (Semana)', href: '/operacional/freelas', permission: 'gestao', beta: true },
      { header: 'Conta Azul' },
      { icon: 'Users', label: 'Beneficiários', href: '/financeiro/beneficiarios', permission: 'ferramentas financeiro_beneficiarios' },
      { icon: 'TrendingUp', label: 'Receitas CA', href: '/financeiro/receitas', permission: 'ferramentas financeiro_receitas_ca' },
      { icon: 'TrendingDown', label: 'Despesas CA', href: '/financeiro/despesas', permission: 'ferramentas financeiro_despesas_ca' },
      { icon: 'FileSearch', label: 'Consultas CA', href: '/ferramentas/consultas', permission: 'ferramentas financeiro_consultas_ca' },
      { icon: 'History', label: 'Histórico CA', href: '/financeiro/ca-historico', permission: 'ferramentas financeiro_historico_ca' },
      { header: 'Contábil' },
      { icon: 'ReceiptText', label: 'Notas Fiscais', href: '/financeiro/notas-fiscais', permission: 'ferramentas financeiro_notas_fiscais' },
      { icon: 'Scale', label: 'Conciliação', href: '/financeiro/conciliacao', permission: 'ferramentas financeiro_conciliacao' },
    ],
  },
  {
    icon: 'Package',
    label: 'Produção - CMV',
    href: '/ferramentas/cmv-semanal/tabela',
    permission: 'gestao',
    subItems: [
      { icon: 'TrendingUp', label: 'Gestão CMV', href: '/ferramentas/cmv-semanal/tabela', permission: 'gestao' },
      { icon: 'BarChart3', label: 'CMV Teórico', href: '/operacional/cmv-teorico', permission: 'gestao' },
      { icon: 'Scale', label: 'Desvios de Consumo', href: '/operacional/desvios', permission: 'gestao' },
      { icon: 'Coffee', label: 'Controle de Consumação', href: '/operacional/consumacao', permission: 'gestao' },
      { icon: 'LogOut', label: 'Saídas', href: '/operacional/consumo-insumo', permission: 'gestao' },
      { icon: 'Package', label: 'Insumos', href: '/operacional/insumos', permission: 'gestao' },
      { icon: 'ShoppingCart', label: 'Compras', href: '/operacional/compras', permission: 'gestao' },
      { icon: 'ChefHat', label: 'Fichas Técnicas', href: '/operacional/fichas-tecnicas', permission: 'gestao' },
      { icon: 'Timer', label: 'Controle de Produção', href: '/operacional/producoes', permission: 'controle_producao' },
      { icon: 'CalendarDays', label: 'Planejamento da Produção', href: '/operacional/plano-producao', permission: 'gestao' },
      { icon: 'ShoppingCart', label: 'Planejamento de Compras', href: '/operacional/plano-compras', permission: 'gestao' },
      { icon: 'Boxes', label: 'Estoque', href: '/operacional/estoque-historico', permission: 'gestao' },
      { icon: 'AlertTriangle', label: 'Stockout', href: '/ferramentas/stockout', permission: 'gestao' },
    ],
  },
  {
    icon: 'Wrench',
    label: 'Ferramentas',
    href: '/ferramentas',
    permission: 'ferramentas',
    beta: true,
    subItems: [
      { icon: 'Activity', label: 'Painel Executivo', href: '/ferramentas/painel-executivo', permission: 'home' },
      { icon: 'BarChart3', label: 'Análises Avançadas', href: '/ferramentas/analises', permission: 'gestao' },
      { icon: 'ShoppingCart', label: 'Consulta de Vendas', href: '/ferramentas/vendas-produtos', permission: 'gestao' },
      { icon: 'Users', label: 'CMO - Mão de Obra', href: '/ferramentas/cmo', permission: 'gestao' },
      { icon: 'Tag', label: 'Classificação de Grupos (Mix)', href: '/ferramentas/consumos-classificacao', permission: 'gestao' },
      { icon: 'AlertTriangle', label: 'Cancelamentos', href: '/ferramentas/cancelamentos', permission: 'gestao' },
      { icon: 'PieChart', label: 'Mix & Margem', href: '/ferramentas/mix-categoria', permission: 'gestao' },
      { icon: 'Music', label: 'Artistas (visão da casa)', href: '/ferramentas/artistas', permission: 'gestao' },
      { icon: 'Clock', label: 'Gargalo de Cozinha', href: '/operacional/gargalo-cozinha', permission: 'gestao' },
      { icon: 'UserCheck', label: 'Raio-x por Garçom', href: '/operacional/raio-x-garcom', permission: 'gestao' },
      { icon: 'PackageX', label: 'Venda Perdida (ruptura)', href: '/operacional/venda-perdida-ruptura', permission: 'gestao' },
      { icon: 'Percent', label: 'Vazamento (descontos)', href: '/operacional/vazamento-descontos', permission: 'gestao' },
      { icon: 'UsersRound', label: 'Escala × Venda', href: '/operacional/escala-produtividade', permission: 'gestao' },
      { icon: 'Activity', label: 'Termômetro do Dia', href: '/operacional/termometro', permission: 'gestao' },
      { icon: 'Wallet', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-caixa', permission: 'ferramentas financeiro_fluxo_de_caixa' },
      { icon: 'LineChart', label: 'Gráficos', href: '/graficos', permission: 'gestao' },
      { header: 'RH' },
      { icon: 'Users', label: 'Funcionários', href: '/rh/funcionarios', permission: 'gestao' },
      { icon: 'CalendarRange', label: 'Escala', href: '/rh/escala', permission: 'gestao' },
      { icon: 'HandCoins', label: 'Freelas', href: '/rh/freelas', permission: 'gestao' },
      { icon: 'Clock', label: 'Ponto', href: '/rh/ponto', permission: 'gestao' },
      { icon: 'Briefcase', label: 'Recrutamento', href: '/rh/recrutamento', permission: 'gestao' },
      { icon: 'Coins', label: 'Custo de MO', href: '/rh/custo-mo', permission: 'gestao' },
      { icon: 'Star', label: 'NPS Funcionários', href: '/operacional/nps', permission: 'gestao' },
      { header: 'Comercial' },
      { icon: 'Megaphone', label: 'Central Comercial', href: '/comercial', permission: 'gestao' },
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
      { icon: 'Zap', label: 'Integrações', href: '/configuracoes/administracao/integracoes', permission: 'configuracoes' },
      { icon: 'Users', label: 'Administração', href: '/configuracoes/administracao/usuarios', permission: 'configuracoes' },
      { icon: 'MessageCircle', label: 'Feedbacks', href: '/configuracoes/feedbacks', permission: 'configuracoes' },
      { icon: 'Activity', label: 'Monitoramento', href: '/configuracoes/monitoramento', permission: 'configuracoes' },
      { icon: 'Shield', label: 'Auditoria', href: '/configuracoes/auditoria', permission: 'configuracoes' },
      { icon: 'Server', label: 'Painel Supabase', href: '/configuracoes/painel', permission: 'configuracoes' },
      { icon: 'CheckSquare', label: 'Checklist Validação', href: '/checklist-validacao', permission: 'configuracoes' },
      { icon: 'Bot', label: 'Zykor Assistant', href: '/assistente-zykor', permission: 'gestao' },
    ],
  },
];
