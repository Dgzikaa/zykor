/**
 * 🤖 Types - Agent V2
 * 
 * Tipos TypeScript para o sistema de insights Agent V2
 */

// ============================================================
// INSIGHT EVENT (Eventos Detectados)
// ============================================================

export interface InsightEvent {
  id: string;
  bar_id: number;
  data: string;
  event_type: string;
  severity: 'baixa' | 'media' | 'alta';
  evidence_json: string[];
  processed: boolean;
  created_at: string;
}

export type EventType =
  | 'queda_ticket_medio'
  | 'queda_faturamento'
  | 'queda_clientes'
  | 'aumento_custo'
  | 'baixa_reserva'
  | 'performance_atracao_boa'
  | 'performance_atracao_ruim'
  | 'produto_anomalo';

// ============================================================
// AGENT INSIGHT V2 (Insights Gerados)
// ============================================================

export interface AgentInsightV2 {
  id: string;
  bar_id: number;
  data: string;
  titulo: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta';
  tipo: 'problema' | 'oportunidade';
  causa_provavel: string | null;
  acoes_recomendadas: string[];
  eventos_relacionados: string[];
  resumo_geral: string | null;
  source: string;
  visualizado: boolean;
  arquivado: boolean;
  created_at: string;
}

// ============================================================
// API RESPONSES
// ============================================================

export interface InsightsV2Response {
  success: boolean;
  insights: AgentInsightV2[];
  stats: {
    total: number;
    nao_visualizados: number;
    problemas: number;
    oportunidades: number;
    por_severidade: {
      alta: number;
      media: number;
      baixa: number;
    };
  };
}

export interface EventsResponse {
  success: boolean;
  eventos: InsightEvent[];
  stats: {
    total: number;
    processados: number;
    nao_processados: number;
    por_tipo: Record<string, number>;
    por_severidade: {
      alta: number;
      media: number;
      baixa: number;
    };
  };
}

export interface PipelineResponse {
  success: boolean;
  data_analise: string;
  pipeline: {
    detector: {
      eventos_detectados: number;
      eventos_salvos: number;
    };
    narrator: {
      eventos_processados: number;
      insights_gerados: number;
      insights_salvos: number;
    } | null;
    notificacoes: {
      enviadas: number;
    };
  };
  insights: Array<{
    titulo: string;
    severidade: string;
    tipo: string;
    descricao: string;
    causa_provavel: string;
    acoes_recomendadas: string[];
  }>;
  resumo_geral: string;
}

// ============================================================
// API REQUESTS
// ============================================================

export interface GetInsightsParams {
  bar_id: number;
  data_inicio?: string;
  data_fim?: string;
  tipo?: 'problema' | 'oportunidade';
  severidade?: 'baixa' | 'media' | 'alta';
  limit?: number;
}

export interface GetEventsParams {
  bar_id: number;
  data?: string;
  processed?: boolean;
  event_type?: EventType;
  severity?: 'baixa' | 'media' | 'alta';
  limit?: number;
}

export interface TriggerPipelineParams {
  bar_id: number;
  data?: string;
}

export interface UpdateInsightParams {
  id: string;
  visualizado?: boolean;
  arquivado?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

export const SEVERIDADE_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const SEVERIDADE_COLORS: Record<string, string> = {
  alta: 'red',
  media: 'orange',
  baixa: 'blue',
};

export const SEVERIDADE_ICONS: Record<string, string> = {
  alta: '🔴',
  media: '🟠',
  baixa: '🔵',
};

export const TIPO_LABELS: Record<string, string> = {
  problema: 'Problema',
  oportunidade: 'Oportunidade',
};

export const TIPO_ICONS: Record<string, string> = {
  problema: '⚠️',
  oportunidade: '✨',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  queda_ticket_medio: 'Queda no Ticket Médio',
  queda_faturamento: 'Queda no Faturamento',
  queda_clientes: 'Queda de Clientes',
  aumento_custo: 'Aumento de Custo',
  baixa_reserva: 'Baixa em Reservas',
  performance_atracao_boa: 'Performance Boa',
  performance_atracao_ruim: 'Performance Ruim',
  produto_anomalo: 'Produto Anômalo',
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getSeveridadeColor(severidade: string): string {
  return SEVERIDADE_COLORS[severidade] || 'gray';
}

export function getSeveridadeIcon(severidade: string): string {
  return SEVERIDADE_ICONS[severidade] || '⚪';
}

export function getTipoIcon(tipo: string): string {
  return TIPO_ICONS[tipo] || '📌';
}

export function formatEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType as EventType] || eventType;
}

export function isInsightCritico(insight: AgentInsightV2): boolean {
  return insight.severidade === 'alta';
}

export function isInsightNovo(insight: AgentInsightV2): boolean {
  return !insight.visualizado;
}

export function getInsightPriority(insight: AgentInsightV2): number {
  const severidadeWeight = {
    alta: 3,
    media: 2,
    baixa: 1,
  };
  
  const tipoWeight = {
    problema: 2,
    oportunidade: 1,
  };

  return (
    severidadeWeight[insight.severidade] * 10 +
    tipoWeight[insight.tipo] * 5 +
    (insight.visualizado ? 0 : 10)
  );
}

export function sortInsightsByPriority(insights: AgentInsightV2[]): AgentInsightV2[] {
  return [...insights].sort((a, b) => getInsightPriority(b) - getInsightPriority(a));
}
