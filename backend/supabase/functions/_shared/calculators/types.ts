/**
 * 📊 CALCULATOR TYPES - Tipos Compartilhados para Calculators
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

export interface CalculatorInput {
  supabase: any;
  barId: number;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  semana?: {
    ano: number;
    numero_semana: number;
  };
}

export interface CalculatorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duration_ms?: number;
}

export interface FaturamentoResult {
  faturamento_total: number;
  faturamento_entrada: number;
  faturamento_bar: number;
  clientes_atendidos: number;
  ticket_medio: number;
  tm_entrada: number;
  tm_bar: number;
  meta_semanal: number;
  mesas_totais: number;
  mesas_presentes: number;
  reservas_totais: number;
  reservas_presentes: number;
  desconto_total: number;
  desconto_percentual: number;
}

export interface CustosResult {
  custo_atracao_faturamento: number;
  couvert_atracoes: number;
  comissao: number;
  atracoes_eventos: number;
  cancelamentos: number;
}

export interface OperacionalResult {
  stockout_bar: number;
  stockout_bar_perc: number;
  stockout_drinks: number;
  stockout_drinks_perc: number;
  stockout_comidas: number;
  stockout_comidas_perc: number;
  perc_bebidas: number;
  perc_drinks: number;
  perc_comida: number;
  perc_happy_hour: number;
  tempo_saida_bar: number;
  tempo_saida_cozinha: number;
  qtde_itens_bar: number;
  qtde_itens_cozinha: number;
  atrasinhos_bar: number;
  atrasinhos_bar_perc: number;
  atrasinhos_cozinha: number;
  atrasinhos_cozinha_perc: number;
  atraso_bar: number;
  atraso_cozinha: number;
  atrasos_bar: number;
  atrasos_cozinha: number;
  atrasos_bar_perc: number;
  atrasos_cozinha_perc: number;
}

export interface SatisfacaoResult {
  avaliacoes_5_google_trip: number;
  media_avaliacoes_google: number;
  nps_geral: number | null;
  nps_reservas: number | null;
  nps_digital: number | null;
  nps_salao: number | null;
  nps_digital_respostas: number;
  nps_salao_respostas: number;
  nps_reservas_respostas: number;
}

export interface DistribuicaoResult {
  perc_faturamento_ate_19h: number | null;
  perc_faturamento_apos_22h: number;
  qui_sab_dom: number;
  ter_qua_qui: number;
  sex_sab: number;
}

export interface ClientesResult {
  clientes_ativos: number | null;
  perc_clientes_novos: number | null;
}
