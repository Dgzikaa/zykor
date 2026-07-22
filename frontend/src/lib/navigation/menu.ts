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
    // GRANULAR: cada item exige o MÓDULO próprio (o perfil controla item a item).
    // Retrocompat garantida pelos generics da categoria no resolver (estrategico/gestao/home).
    subItems: [
      { icon: 'TrendingUp', label: 'Visão Geral', href: '/estrategico/visao-geral', permission: 'estrategico_visao_geral' },
      { icon: 'BarChart3', label: 'Desempenho', href: '/estrategico/desempenho', permission: 'estrategico_desempenho' },
      { icon: 'Calendar', label: 'Planejamento', href: '/estrategico/planejamento-comercial', permission: 'estrategico_planejamento' },
      { icon: 'DollarSign', label: 'Orçamentação', href: '/estrategico/orcamentacao', permission: 'estrategico_orcamentacao' },
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
    // GRANULAR: módulo próprio por item. Retrocompat pelos generics de Receitas
    // (receitas/relatorios/analitico/gestao) — quem tinha 'relatorios' continua vendo tudo.
    subItems: [
      { icon: 'BarChart3', label: 'Dashboard de Receitas', href: '/receitas', permission: 'receitas_dashboard_de_receitas' },
      { icon: 'Megaphone', label: 'Comunicação', href: '/receitas/comunicacao', permission: 'receitas_comunicacao' },
      { icon: 'Gift', label: 'Fidelização', href: '/receitas/fidelidade', permission: 'receitas_fidelizacao' },
      { icon: 'Music', label: 'Visão do Artista', href: '/analitico/atracoes', permission: 'receitas_visao_do_artista' },
      { icon: 'BarChart3', label: 'Eventos', href: '/analitico/eventos', permission: 'receitas_eventos' },
      { header: 'Clientes' },
      { icon: 'Users', label: 'Clientes', href: '/analitico/clientes', permission: 'receitas_clientes' },
      { icon: 'PieChart', label: 'Segmentos (RFM)', href: '/analitico/clientes/segmentos', permission: 'receitas_segmentos_rfm' },
      { icon: 'HeartHandshake', label: 'Win-back', href: '/analitico/clientes/win-back', permission: 'receitas_win_back' },
      { icon: 'TrendingUp', label: 'Retenção', href: '/analitico/clientes/retencao', permission: 'receitas_retencao' },
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
      { icon: 'HandCoins', label: 'Freelas (Semana)', href: '/operacional/freelas', permission: 'ferramentas financeiro_freelas_semana', beta: true },
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
    // Sub-headers agrupam por domínio (CMV / Estoque / Insumos / Produções) — só visuais.
    // Labels antigos preservados pra manter compat de IDs de módulo (categoria_nome).
    // GRANULAR (piloto): cada item exige o MÓDULO próprio (categoria_nome), pra o perfil
    // controlar item por item. O fallback pro 'gestao' fica só no menu (matchPermission),
    // então quem já tem 'gestao' não perde nada e não há vazamento no resolver.
    subItems: [
      { header: 'CMV' },
      { icon: 'TrendingUp', label: 'Gestão CMV', href: '/ferramentas/cmv-semanal/tabela', permission: 'producao - cmv_gestao_cmv' },
      { icon: 'BarChart3', label: 'CMV Teórico', href: '/operacional/cmv-teorico', permission: 'producao - cmv_cmv_teorico' },
      { icon: 'Coffee', label: 'Controle de Consumação', href: '/operacional/consumacao', permission: 'producao - cmv_controle_de_consumacao' },
      { header: 'Estoque' },
      { icon: 'Boxes', label: 'Estoque', href: '/operacional/estoque-historico', permission: 'producao - cmv_estoque' },
      { icon: 'Scale', label: 'Desvios de Consumo', href: '/operacional/desvios', permission: 'producao - cmv_desvios_de_consumo' },
      { icon: 'Trash2', label: 'Desperdício', href: '/operacional/desperdicio', permission: 'desperdicio', beta: true },
      { icon: 'AlertTriangle', label: 'Stockout', href: '/ferramentas/stockout', permission: 'producao - cmv_stockout' },
      { icon: 'ShoppingCart', label: 'Planejamento de Compras', href: '/operacional/plano-compras', permission: 'producao - cmv_planejamento_de_compras' },
      { header: 'Insumos' },
      { icon: 'Package', label: 'Insumos', href: '/operacional/insumos', permission: 'producao - cmv_insumos' },
      { icon: 'ShoppingCart', label: 'Compras', href: '/operacional/compras', permission: 'producao - cmv_compras' },
      { icon: 'LogOut', label: 'Saídas', href: '/operacional/consumo-insumo', permission: 'producao - cmv_saidas' },
      { header: 'Produções' },
      { icon: 'ChefHat', label: 'Fichas Técnicas', href: '/operacional/fichas-tecnicas', permission: 'producao - cmv_fichas_tecnicas' },
      { icon: 'CalendarDays', label: 'Planejamento da Produção', href: '/operacional/plano-producao', permission: 'producao - cmv_planejamento_da_producao' },
      { icon: 'Timer', label: 'Controle de Produção', href: '/operacional/producoes', permission: 'controle_producao' },
    ],
  },
  {
    icon: 'Wrench',
    label: 'Ferramentas',
    href: '/ferramentas',
    permission: 'ferramentas',
    beta: true,
    // GRANULAR: módulo próprio por item. A categoria Ferramentas NÃO tem 'gestao' nos generics,
    // então o fallback pro 'gestao' (retrocompat de quem já tinha) fica no menu (matchPermission,
    // prefixo 'ferramentas_') + no fallback de rota — sem virar generic no resolver (sem vazamento).
    subItems: [
      { icon: 'Activity', label: 'Painel Executivo', href: '/ferramentas/painel-executivo', permission: 'ferramentas_painel_executivo' },
      { icon: 'BarChart3', label: 'Análises Avançadas', href: '/ferramentas/analises', permission: 'ferramentas_analises_avancadas' },
      { icon: 'ShoppingCart', label: 'Consulta de Vendas', href: '/ferramentas/vendas-produtos', permission: 'ferramentas_consulta_de_vendas' },
      { icon: 'Users', label: 'CMO - Mão de Obra', href: '/ferramentas/cmo', permission: 'ferramentas_cmo_mao_de_obra' },
      { icon: 'Tag', label: 'Classificação de Grupos (Mix)', href: '/ferramentas/consumos-classificacao', permission: 'ferramentas_classificacao_de_grupos_mix' },
      { icon: 'AlertTriangle', label: 'Cancelamentos', href: '/ferramentas/cancelamentos', permission: 'ferramentas_cancelamentos' },
      { icon: 'PieChart', label: 'Mix & Margem', href: '/ferramentas/mix-categoria', permission: 'ferramentas_mix_margem' },
      { icon: 'Music', label: 'Artistas (visão da casa)', href: '/ferramentas/artistas', permission: 'ferramentas_artistas_visao_da_casa' },
      { icon: 'Clock', label: 'Gargalo de Cozinha', href: '/operacional/gargalo-cozinha', permission: 'ferramentas_gargalo_de_cozinha' },
      { icon: 'UserCheck', label: 'Raio-x por Garçom', href: '/operacional/raio-x-garcom', permission: 'ferramentas_raio_x_por_garcom' },
      { icon: 'PackageX', label: 'Venda Perdida (ruptura)', href: '/operacional/venda-perdida-ruptura', permission: 'ferramentas_venda_perdida_ruptura' },
      { icon: 'Percent', label: 'Vazamento (descontos)', href: '/operacional/vazamento-descontos', permission: 'ferramentas_vazamento_descontos' },
      { icon: 'UsersRound', label: 'Escala × Venda', href: '/operacional/escala-produtividade', permission: 'ferramentas_escala_venda' },
      { icon: 'Activity', label: 'Termômetro do Dia', href: '/operacional/termometro', permission: 'ferramentas_termometro_do_dia' },
      { icon: 'Wallet', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-caixa', permission: 'ferramentas financeiro_fluxo_de_caixa' },
      { icon: 'LineChart', label: 'Gráficos', href: '/graficos', permission: 'ferramentas_graficos' },
      { header: 'RH' },
      { icon: 'Users', label: 'Funcionários', href: '/rh/funcionarios', permission: 'ferramentas_funcionarios' },
      { icon: 'CalendarRange', label: 'Escala', href: '/rh/escala', permission: 'ferramentas_escala' },
      { icon: 'HandCoins', label: 'Freelas', href: '/rh/freelas', permission: 'ferramentas_freelas' },
      { icon: 'Clock', label: 'Ponto', href: '/rh/ponto', permission: 'ferramentas_ponto' },
      { icon: 'Briefcase', label: 'Recrutamento', href: '/rh/recrutamento', permission: 'ferramentas_recrutamento' },
      { icon: 'Coins', label: 'Custo de MO', href: '/rh/custo-mo', permission: 'ferramentas_custo_de_mo' },
      { icon: 'Star', label: 'NPS Funcionários', href: '/operacional/nps', permission: 'ferramentas_nps_funcionarios' },
      { header: 'Comercial' },
      { icon: 'Megaphone', label: 'Central Comercial', href: '/comercial', permission: 'ferramentas_central_comercial' },
    ],
  },
  {
    icon: 'Settings',
    label: 'Configurações',
    href: '/configuracoes',
    permission: 'configuracoes',
    // Agrupado por headers (só visual): Administração (infra/config), Acesso (perfis) e
    // Testes (ferramentas em validação). Usuários saiu daqui — vive dentro de Perfis de Acesso.
    subItems: [
      { header: 'Administração' },
      { icon: 'Zap', label: 'Integrações', href: '/configuracoes/administracao/integracoes', permission: 'configuracoes' },
      { icon: 'Bell', label: 'Notificações', href: '/configuracoes/notifications', permission: 'configuracoes' },
      { icon: 'Store', label: 'Bares', href: '/configuracoes/bares', permission: 'configuracoes' },
      { icon: 'Activity', label: 'Monitoramento', href: '/configuracoes/monitoramento', permission: 'configuracoes' },
      { icon: 'Shield', label: 'Auditoria', href: '/configuracoes/auditoria', permission: 'configuracoes' },
      { icon: 'Server', label: 'Painel Supabase', href: '/configuracoes/painel', permission: 'configuracoes' },
      { header: 'Acesso' },
      { icon: 'Shield', label: 'Perfis de Acesso', href: '/configuracoes/administracao/perfis', permission: 'configuracoes' },
      { header: 'Testes' },
      { icon: 'Bot', label: 'Zykor Assistant', href: '/assistente-zykor', permission: 'gestao' },
      { icon: 'CheckSquare', label: 'Checklist Validação', href: '/checklist-validacao', permission: 'configuracoes' },
      { icon: 'MessageCircle', label: 'Feedbacks', href: '/configuracoes/feedbacks', permission: 'configuracoes' },
    ],
  },
];
