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
      { icon: 'Trash2', label: 'Desperdício', href: '/operacional/desperdicio', permission: 'producao - cmv_desperdicio', beta: true },
      { icon: 'AlertTriangle', label: 'Stockout', href: '/ferramentas/stockout', permission: 'producao - cmv_stockout' },
      { icon: 'ShoppingCart', label: 'Planejamento de Compras', href: '/operacional/plano-compras', permission: 'producao - cmv_planejamento_de_compras' },
      { header: 'Insumos' },
      { icon: 'Package', label: 'Insumos', href: '/operacional/insumos', permission: 'producao - cmv_insumos' },
      { icon: 'ShoppingCart', label: 'Compras', href: '/operacional/compras', permission: 'producao - cmv_compras' },
      { icon: 'LogOut', label: 'Saídas', href: '/operacional/consumo-insumo', permission: 'producao - cmv_saidas' },
      { header: 'Produções' },
      { icon: 'ChefHat', label: 'Fichas Técnicas', href: '/operacional/fichas-tecnicas', permission: 'producao - cmv_fichas_tecnicas' },
      { icon: 'CalendarDays', label: 'Planejamento da Produção', href: '/operacional/plano-producao', permission: 'producao - cmv_planejamento_da_producao' },
      { icon: 'Timer', label: 'Controle de Produção', href: '/operacional/producoes', permission: 'producao - cmv_controle_de_producao' },
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
      { icon: 'Folder', label: 'Arquivos', href: '/ferramentas/arquivos', permission: 'ferramentas_arquivos' },
      { icon: 'Star', label: 'NPS por Área', href: '/analitico/nps', permission: 'ferramentas_nps_por_area', beta: true },
      { icon: 'Sun', label: 'Almoço × Noite', href: '/analitico/dia-noite', permission: 'ferramentas_almoco_noite', beta: true },
      { icon: 'Clock', label: 'Gargalo de Cozinha', href: '/operacional/gargalo-cozinha', permission: 'ferramentas_gargalo_de_cozinha' },
      { icon: 'UserCheck', label: 'Raio-x por Garçom', href: '/operacional/raio-x-garcom', permission: 'ferramentas_raio_x_por_garcom' },
      { icon: 'PackageX', label: 'Venda Perdida (ruptura)', href: '/operacional/venda-perdida-ruptura', permission: 'ferramentas_venda_perdida_ruptura' },
      { icon: 'Percent', label: 'Vazamento (descontos)', href: '/operacional/vazamento-descontos', permission: 'ferramentas_vazamento_descontos' },
      { icon: 'UsersRound', label: 'Escala × Venda', href: '/operacional/escala-produtividade', permission: 'ferramentas_escala_venda' },
      { icon: 'Activity', label: 'Termômetro do Dia', href: '/operacional/termometro', permission: 'ferramentas_termometro_do_dia' },
      { icon: 'Wallet', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-caixa', permission: 'ferramentas_fluxo_de_caixa' },
      { icon: 'LineChart', label: 'Gráficos', href: '/graficos', permission: 'ferramentas_graficos' },
      { header: 'Comercial' },
      { icon: 'Megaphone', label: 'Central Comercial', href: '/comercial', permission: 'ferramentas_central_comercial' },
      // CRM (Umbler): as telas viviam em /crm/*, fora do menu — ou seja, sem módulo pra exigir,
      // o que deixava as rotas de disparo sem autorização. /ferramentas/crm é o hub com abas
      // (as páginas de lá só re-exportam /crm/*, nada duplicado). Entra no menu agora pra
      // existir o módulo `ferramentas_crm`; ainda não está em uso — vai ser ativado depois.
      { icon: 'MessageCircle', label: 'CRM', href: '/ferramentas/crm', permission: 'ferramentas_crm', beta: true },
    ],
  },
  {
    icon: 'Users',
    label: 'RH',
    // Sem página raiz /rh — a seção aponta pro primeiro item, mesmo padrão de "Produção - CMV".
    href: '/rh/funcionarios',
    permission: 'rh',
    beta: true,
    // Saiu de dentro de Ferramentas (29/07/2026) e virou seção própria. Isso MUDA os ids de
    // módulo, que são gerados por categoria_nome: `ferramentas_funcionarios` → `rh_funcionarios`.
    //
    // A troca não quebra permissão — pelo contrário, CONSERTA: 17 usuários já tinham no banco
    // exatamente os tokens `rh_funcionarios`, `rh_escala`, `rh_freelas`, `rh_ponto`,
    // `rh_recrutamento`, `rh_custo_de_mo` e `rh_nps_funcionarios` (sobra de quando RH era seção
    // própria), que estavam órfãos: não correspondiam a módulo nenhum e portanto não concediam
    // nada. Só 1 usuário tinha os equivalentes `ferramentas_*`, cobertos por alias no resolver.
    //
    // Os LABELS abaixo são o que gera o id — mexer neles quebra os grants dos 17. Não renomear
    // sem migrar os tokens junto.
    subItems: [
      { icon: 'Users', label: 'Funcionários', href: '/rh/funcionarios', permission: 'rh_funcionarios' },
      // A mensagem de toda segunda, montada sozinha (objetivo 3 da ata de 13/08/2026).
      { icon: 'CalendarDays', label: 'Ata Semanal', href: '/rh/ata-semanal', permission: 'rh_ata_semanal' },
      // Os alertas do dossiê aplicados à base inteira — quem está sem contrato, sem exame,
      // com experiência vencendo. Ninguém abre 68 fichas pra descobrir isso.
      { icon: 'ShieldAlert', label: 'Alerta de RH', href: '/rh/alertas', permission: 'rh_alerta_de_rh' },
      // Saiu do perfil de cada pessoa: a pesquisa é anônima e agregada por setor,
      // então nunca houve resposta "daquele funcionário" pra mostrar lá.
      // Renomeada de "Pesquisa da Felicidade" para "Pesquisas" em 14/08/2026 (a Felicidade virou
      // uma aba, ao lado de Calibração e Reconhecimentos). O rename troca o id da permissão —
      // conferido antes: nenhum usuário nem perfil tinha `rh_pesquisa_da_felicidade` gravado.
      { icon: 'Smile', label: 'Pesquisas', href: '/rh/pesquisas', permission: 'rh_pesquisas' },
      // RH → Escala saiu do menu em 12/08/2026: não era usada. A escala de verdade (a que o
      // time mantém na planilha "ESCALA ORDI!") virou a seção Operação abaixo. A rota
      // /rh/escala continua existindo, mas órfã do menu = admin-only pelo guard.
      { icon: 'HandCoins', label: 'Freelas', href: '/rh/freelas', permission: 'rh_freelas' },
      { icon: 'Clock', label: 'Ponto', href: '/rh/ponto', permission: 'rh_ponto' },
      { icon: 'Briefcase', label: 'Recrutamento', href: '/rh/recrutamento', permission: 'rh_recrutamento' },
      { icon: 'Coins', label: 'Custo de MO', href: '/rh/custo-mo', permission: 'rh_custo_de_mo' },
      { icon: 'Star', label: 'NPS Funcionários', href: '/operacional/nps', permission: 'rh_nps_funcionarios' },
    ],
  },
  {
    icon: 'CalendarRange',
    label: 'Operação',
    // Sem página raiz — a seção aponta pro primeiro item, mesmo padrão de RH e Produção - CMV.
    href: '/operacao/plano',
    permission: 'operacao',
    beta: true,
    // Substitui as duas planilhas que hoje são a fonte da verdade da operação do Ordinário:
    // "Plano Operacional Semanal" e "ESCALA ORDI!". Decisão (Rodrigo, 12/08/2026): o Zykor
    // vira a fonte, o histórico de 2026 entra por backfill e setembro já é desenhado aqui.
    //
    // As `permission` abaixo são os ids GERADOS por gerarIdModulo('Operação', label) —
    // `operacao_plano_operacional` e `operacao_escala`. Mexer nos labels muda o id e
    // derruba o grant de quem já tiver o módulo.
    subItems: [
      { icon: 'ClipboardList', label: 'Plano Operacional', href: '/operacao/plano', permission: 'operacao_plano_operacional' },
      { icon: 'CalendarRange', label: 'Escala', href: '/operacao/escala', permission: 'operacao_escala' },
      { icon: 'Scale', label: 'Planejado × Realizado', href: '/operacao/comparativo', permission: 'operacao_planejado_realizado' },
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
      { icon: 'Users', label: 'Usuários', href: '/configuracoes/usuarios', permission: 'configuracoes' },
      { header: 'Testes' },
      // Era `gestao` — genérico de OUTRA categoria, o único item da seção fora do padrão.
      // A regra é a permission ser o id gerado `gerarIdModulo(seção, item)`; aqui a seção é
      // Configurações, cujo genérico `configuracoes` cobre o módulo no resolver — então quem
      // administra o sistema continua vendo, e sai a dependência de um token alheio.
      { icon: 'Bot', label: 'Zykor Assistant', href: '/assistente-zykor', permission: 'configuracoes_zykor_assistant' },
      { icon: 'CheckSquare', label: 'Checklist Validação', href: '/checklist-validacao', permission: 'configuracoes' },
      { icon: 'MessageCircle', label: 'Feedbacks', href: '/configuracoes/feedbacks', permission: 'configuracoes' },
    ],
  },
];
