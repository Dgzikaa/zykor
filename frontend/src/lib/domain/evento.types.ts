/**
 * Types do dominio "Evento".
 */

export type EventoBasePlanejamento = {
  id: number;
  data_evento: string;
  nome: string | null;
  dia_semana: string | null;
  bar_id: number;

  // Plano (manual)
  m1_r: number | null;
  cl_plan: number | null;
  te_plan: number | null;
  tb_plan: number | null;
  c_artistico_plan: number | null;
  observacoes: string | null;

  // Real (calculado pelo cron)
  real_r: number | null;
  cl_real: number | null;
  lot_max: number | null;
  te_real: number | null;
  tb_real: number | null;
  t_medio: number | null;
  c_art: number | string | null;
  c_prod: number | string | null;
  percent_art_fat: number | string | null;
  percent_b: number | null;
  percent_d: number | null;
  percent_c: number | null;
  percent_stockout: number | null;
  t_coz: number | null;
  t_bar: number | null;
  fat_19h_percent: number | null;

  // Integracoes
  sympla_liquido: number | null;
  sympla_checkins: number | null;
  yuzer_liquido: number | null;
  yuzer_ingressos: number | null;

  // Reservas
  res_tot: number | null;
  res_p: number | null;

  // Couvert / faturamento manual
  faturamento_couvert_manual: number | null;
  faturamento_bar_manual: number | null;
  faturamento_couvert: number | null;
  couvert_vr_contahub: number | null;

  // Controle
  calculado_em: string | null;
  precisa_recalculo: boolean | null;
  versao_calculo: number | null;
  ativo: boolean;
};

/**
 * Formato de saida para a tela de Planejamento Comercial.
 */
export type PlanejamentoComercialItem = {
  evento_id: number;
  data_evento: string;
  dia_semana: string;
  evento_nome: string;
  dia: number;
  mes: number;
  ano: number;
  dia_formatado: string;
  data_curta: string;

  // Financeiros
  real_receita: number;
  m1_receita: number;
  faturamento_couvert: number;
  couvert_vr_contahub: number | null;
  faturamento_couvert_manual?: number;
  faturamento_bar_manual?: number;

  // Publico
  clientes_plan: number;
  clientes_real: number;
  res_tot: number;
  res_p: number;
  lot_max: number;

  // Tickets
  te_plan: number;
  te_real: number;
  tb_plan: number;
  tb_real: number;
  t_medio: number;

  // Custos
  c_art: number;
  c_prod: number;
  percent_art_fat: number;

  // Percentuais
  percent_b: number;
  percent_d: number;
  percent_c: number;

  // Tempos
  t_coz: number;
  t_bar: number;
  fat_19h: number;

  percent_stockout: number;

  // Segmentacao de clientes
  percent_clientes_novos: number | null;
  clientes_ativos: number | null;

  // Flags de performance
  real_vs_m1_green: boolean;
  ci_real_vs_plan_green: boolean;
  te_real_vs_plan_green: boolean;
  tb_real_vs_plan_green: boolean;
  t_medio_green: boolean;
  percent_art_fat_green: boolean;
  t_coz_green: boolean;
  t_bar_green: boolean;
  fat_19h_green: boolean;
};
