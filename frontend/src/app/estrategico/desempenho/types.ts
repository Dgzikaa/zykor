export interface DadosSemana {
  id?: number;
  numero_semana: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  faturamento_total: number;
  faturamento_entrada: number;
  faturamento_bar: number;
  faturamento_cmovivel: number;
  cmv_rs: number;
  ticket_medio: number;
  tm_entrada: number;
  tm_bar: number;
  cmv_limpo: number;
  cmv_global_real: number;
  cmv_teorico: number;
  cmo: number;
  custo_atracao_faturamento: number;
  retencao_1m: number;
  retencao_2m: number;
  perc_clientes_novos: number;
  clientes_atendidos: number;
  clientes_ativos: number;
  reservas_totais: number;
  reservas_presentes: number;
  pessoas_reservas_totais?: number;
  pessoas_reservas_presentes?: number;
  quebra_reservas?: number;
  conta_assinada_valor?: number;
  conta_assinada_perc?: number;
  descontos_valor?: number;
  descontos_perc?: number;
  descontos_detalhes?: { motivo: string; valor: number; qtd: number; por_dia?: { dia_semana: string; valor: number; qtd: number }[] }[];
  avaliacoes_5_google_trip: number;
  media_avaliacoes_google: number;
  nps_geral: number;
  nps_reservas: number;
  nota_felicidade_equipe: number;
  stockout_comidas: number;
  stockout_drinks: number;
  stockout_bar: number;
  stockout_comidas_perc?: number;
  stockout_drinks_perc?: number;
  stockout_bar_perc?: number;
  perc_bebidas: number;
  perc_drinks: number;
  perc_comida: number;
  perc_happy_hour: number;
  qtde_itens_bar: number;
  atrasos_bar: number;
  atrasos_bar_perc?: number;
  atrasos_bar_detalhes?: { dia_semana: string; itens: { nome: string; atraso_minutos: number; quantidade: number }[] }[];
  tempo_saida_bar: number;
  qtde_itens_cozinha: number;
  atrasos_cozinha: number;
  atrasos_cozinha_perc?: number;
  atrasos_cozinha_detalhes?: { dia_semana: string; itens: { nome: string; atraso_minutos: number; quantidade: number }[] }[];
  tempo_saida_cozinha: number;
  perc_faturamento_ate_19h: number;
  perc_faturamento_apos_22h?: number;
  qui_sab_dom: number;
  o_num_posts: number;
  o_alcance: number;
  o_interacao: number;
  o_compartilhamento: number;
  o_engajamento: number;
  o_num_stories: number;
  o_visu_stories: number;
  m_valor_investido: number;
  m_alcance: number;
  m_frequencia: number;
  m_cpm: number;
  m_cliques: number;
  m_ctr: number;
  m_custo_por_clique: number;
  m_conversas_iniciadas: number;
}

export type MetricaStatus = 'auto' | 'manual' | 'nao_confiavel';

export interface MetricaConfig {
  key: string;
  label: string;
  status: MetricaStatus;
  fonte: string;
  calculo: string;
  formato: 'moeda' | 'moeda_decimal' | 'moeda_com_percentual' | 'percentual' | 'numero' | 'decimal' | 'reservas';
  percentualKey?: string;
  inverso?: boolean;
  sufixo?: string;
  editavel?: boolean;
  keyPessoas?: string;
  indentado?: boolean;
  temTooltipDetalhes?: boolean;
  keyPercentual?: string;
}

export type TipoAgregacao = 'media' | 'soma' | 'fixa' | 'campo';

export interface GrupoMetricas {
  id: string;
  label: string;
  metricas: MetricaConfig[];
  agregacao?: {
    tipo: TipoAgregacao;
    valorFixo?: number;
    campo?: string;
    formato: string;
    sufixo?: string;
  };
}

export interface SecaoConfig {
  id: string;
  titulo: string;
  icone: React.ReactNode;
  cor: string;
  grupos: GrupoMetricas[];
}
