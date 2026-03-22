// ===== TIPOS PARA AS TABELAS DO SUPABASE =====

export interface EventoBase {
  id?: number;
  bar_id?: number;
  data_evento?: string;
  nome?: string;
  real_r?: number;
  m1_r?: number;
  cl_real?: number;
  ativo?: boolean;
}

export interface ContaHubAnalitico {
  prd_desc?: string;
  grp_desc?: string;
  qtd?: number;
  valorfinal?: number;
  trn_dtgerencial?: string;
}

export interface CMVSemanal {
  cmv_percentual?: number;
  custo_total?: number;
  faturamento?: number;
}

export interface ChatContext {
  barName: string;
  currentTopic?: string;
  previousMessages: { role: string; content: string; agent?: string }[];
  timeOfDay?: 'morning' | 'afternoon' | 'night';
  dayOfWeek?: number;
}

export interface AgentResponse {
  success: boolean;
  response: string;
  agent?: string;
  metrics?: { label: string; value: string; trend?: 'up' | 'down' | 'neutral'; percentage?: number }[];
  suggestions?: string[];
  deepLinks?: { label: string; href: string }[];
  chartData?: { label: string; value: number; color?: string }[];
  insight?: { type: 'success' | 'warning' | 'info'; text: string };
  data?: {
    faturamento?: number;
    publico?: number;
    atingimento?: number;
    cmv?: number;
    ticketMedio?: number;
    variacaoFaturamento?: number;
    variacaoPublico?: number;
  };
}

export const DEEP_LINKS: Record<string, { label: string; href: string }[]> = {
  faturamento: [
    { label: 'Ver Planejamento Comercial', href: '/estrategico/planejamento-comercial' },
    { label: 'Análise de Eventos', href: '/analitico/eventos' }
  ],
  clientes: [
    { label: 'Ver Clientes', href: '/analitico/clientes' },
    { label: 'CRM Inteligente', href: '/crm' }
  ],
  cmv: [
    { label: 'DRE Completo', href: '/ferramentas/dre' },
    { label: 'Orçamentação', href: '/estrategico/orcamentacao' }
  ],
  meta: [
    { label: 'Planejamento Comercial', href: '/estrategico/planejamento-comercial' },
    { label: 'Visão Mensal', href: '/estrategico/visao-mensal' }
  ],
  meta_projecao: [
    { label: 'Visão Geral Estratégica', href: '/estrategico/visao-geral' },
    { label: 'Desempenho', href: '/estrategico/desempenho' }
  ],
  produto: [
    { label: 'Produtos Analítico', href: '/analitico/produtos' },
    { label: 'Estoque', href: '/ferramentas/contagem-estoque' }
  ],
  comparativo_dias: [
    { label: 'Análise Semanal', href: '/analitico/semanal' },
    { label: 'Comparativo de Eventos', href: '/analitico/comparativo-eventos' }
  ],
  comparativo_periodos: [
    { label: 'Visão Mensal', href: '/estrategico/visao-mensal' },
    { label: 'Comparativo de Eventos', href: '/analitico/comparativo-eventos' }
  ],
  tendencia: [
    { label: 'Evolução Mensal', href: '/estrategico/visao-mensal' },
    { label: 'Dashboard Principal', href: '/home' }
  ]
};
