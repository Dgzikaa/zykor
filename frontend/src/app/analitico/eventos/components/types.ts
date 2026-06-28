// Tipos compartilhados da análise por evento

export interface EventoMetricas {
  faturamento: number;
  publico: number;
  couvert: number;
  bar: number;
  ticket: number;
  c_art: number;
  c_prod: number;
  custo_total: number;
  resultado: number;
  percent_comida: number;
  percent_bebida: number;
  percent_drink: number;
  percent_stockout: number;
  atrasos: number;
  res_tot: number;
}

export interface BaselineEvento extends EventoMetricas {
  data_evento: string;
  nome: string | null;
  cancelamentos?: number;
  conta_assinada?: number;
}

export interface NpsDia {
  data: string;
  score: number;
  respostas: number;
}

export interface Insight {
  tipo: 'positivo' | 'atencao' | 'info';
  dimensao: string;
  titulo: string;
  descricao: string;
  delta_pct?: number | null;
}

export type Gran = 'dia' | 'semana' | 'mes';

// ---- Planejado vs Realizado ----
export interface PlanoLado {
  faturamento: number;
  c_art: number;
  c_prod: number;
  pct_art_fat: number | null;
  pct_prod_fat: number | null;
}

export interface PlanoEventoRow {
  evento_id: number;
  data_evento: string;
  nome: string | null;
  fat_planejado: number | null;
  c_art_planejado: number | null;
  c_prod_planejado: number | null;
  pct_art_planejado: number | null;
  fat_realizado: number | null;
  c_art_realizado: number | null;
  c_prod_realizado: number | null;
  pct_art_realizado: number | null;
  delta_fat_pct: number | null;
  n_revisoes: number;
}

export interface PlanoSnapshot {
  tipo: 'inicial' | 'revisao' | 'final';
  versao: number;
  faturamento: number;
  c_art: number;
  c_prod: number;
  pct_art_fat: number | null;
  pct_prod_fat: number | null;
  fonte: 'projecao' | 'real';
  criado_em: string;
}

export interface ContextoData {
  data: string;
  nome: string;
  tipo: string | null;
  /** fator histórico de ajuste do bar p/ esta data (1.0 = normal; <1 fatura menos) */
  ajuste: number;
  observacao: string | null;
}

export interface PlanoBloco {
  plano: PlanoLado;
  realizado: PlanoLado;
  delta: { faturamento: number; faturamento_pct: number | null; c_art: number; c_prod: number };
  n_eventos: number;
  n_realizados: number;
  eventos: PlanoEventoRow[];
  snapshots: PlanoSnapshot[];
  contexto_datas: ContextoData[];
}

export interface Periodo {
  inicio: string;
  fim: string;
  label: string;
}

export interface EventoResponse {
  success: boolean;
  encontrado: boolean;
  gran?: Gran;
  periodo?: Periodo;
  data_evento?: string;
  motivo?: string;
  evento?: Record<string, any> & {
    dia_semana_label: string;
    nome: string | null;
    artista: string | null;
    nome_evento: string | null;
    _faturamento: number;
    _publico: number;
    _couvert: number;
    _bar: number;
    _ticket: number;
    _custo_total: number;
    _resultado: number;
  };
  metricas?: EventoMetricas;
  baseline?: {
    n: number;
    media: EventoMetricas | null;
    eventos: BaselineEvento[];
  };
  deltas?: Partial<Record<keyof EventoMetricas, number | null>>;
  diagnostico?: {
    veredito: 'bom' | 'regular' | 'ruim';
    insights: Insight[];
  };
  /** NPS agregado do período (gold.desempenho) — presente em semana/mês */
  nps?: {
    geral: number | null;
    respostas: number;
    comida: number | null;
    drink: number | null;
    atendimento: number | null;
    ambiente: number | null;
    musica: number | null;
    preco: number | null;
    limpeza: number | null;
  } | null;
  /** NPS por dia no período (silver.nps_diario) — para gráfico */
  nps_diario?: NpsDia[];
  /** fonte dos dados agregados (gold.desempenho ou planejamento) */
  fonte?: string;
  /** Planejado vs Realizado (fotos do plano: inicial/revisão/final) */
  planejado?: PlanoBloco;
  /** Perfil de clientes do dia: novos x recorrentes + retorno (só na visão de dia) */
  clientes_perfil?: {
    total: number;
    novos: number;
    recorrentes: number;
    retorno_30d: number;
    retorno_60d: number;
    ticket_medio: number;
  } | null;
}
