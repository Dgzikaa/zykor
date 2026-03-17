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
  reservas_totais: number; // Pessoas totais
  reservas_presentes: number; // Pessoas presentes
  mesas_totais: number; // Mesas totais (COUNT de reservas)
  mesas_presentes: number; // Mesas presentes (COUNT de reservas presentes)
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
  nps_digital?: number | null;
  nps_salao?: number | null;
  nps_digital_respostas?: number;
  nps_salao_respostas?: number;
  nps_reservas_respostas?: number;
  falae_nps_score?: number | null;
  falae_nps_media?: number | null;
  falae_respostas_total?: number;
  falae_promotores_total?: number;
  falae_neutros_total?: number;
  falae_detratores_total?: number;
  falae_avaliacoes_detalhes?: { nome: string; media: number; total: number }[];
  falae_comentarios_detalhes?: {
    nps: number;
    comentario: string;
    data: string;
    tipo: 'promotor' | 'neutro' | 'detrator';
    avaliacoes?: { nome: string; nota: number }[];
  }[];
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
  ter_qua_qui?: number;
  sex_sab?: number;
  cancelamentos?: number;
  cancelamentos_detalhes?: { dia_semana: string; data?: string; valor: number }[];
  atrasinhos_bar?: number;
  atrasinhos_bar_perc?: number;
  atrasinhos_cozinha?: number;
  atrasinhos_cozinha_perc?: number;
  atrasinhos_detalhes?: { dia_semana: string; atrasinhos_bar: number; atrasinhos_cozinha: number; atraso_bar: number; atraso_cozinha: number }[];
  atraso_bar?: number;
  atraso_cozinha?: number;
  atraso_detalhes?: { dia_semana: string; atrasinhos_bar: number; atrasinhos_cozinha: number; atraso_bar: number; atraso_cozinha: number }[];
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
  m_cpc: number;
  m_conversas_iniciadas: number;
  // Google Meu Negócio
  gmn_total_visualizacoes: number;
  gmn_total_acoes: number;
  gmn_solicitacoes_rotas: number;
  gmn_visu_pesquisa?: number;
  gmn_visu_maps?: number;
  gmn_cliques_website?: number;
  gmn_ligacoes?: number;
  gmn_menu_views?: number;
  // Google Ads
  g_valor_investido: number;
  g_impressoes: number;
  g_cliques: number;
  g_ctr: number;
  g_cpc?: number;
  g_solicitacoes_rotas?: number;
  g_ligacoes?: number;
  g_click_reservas?: number;
  quebra_utensilios?: number;
  bonificacoes_contratos?: number;
  nota_producao_bar?: number;
  nota_producao_cozinha?: number;
  perc_checklist_producao?: number;
  desvio_semana?: number;
  quorum_pesquisa_felicidade?: number;
  vagas_abertas?: number;
  num_testes_ps?: number;
  perc_comparecimento_ps?: number;
  aprovados_ps?: number;
  perc_checklist_rh?: number;
  absenteismo?: number;
  num_lancamentos_vencidos?: number;
  conciliacoes_pendentes?: number;
  erros_pente_fino?: number;
  lancamentos_atrasados?: number;
  perc_checklist_semanal_terca?: number;
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
  temTooltipGoogle?: boolean;
  temTooltipFaturamento?: boolean;
  keyPercentual?: string;
  detalhesKey?: string;
  respostasKey?: string;
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

export interface MetaDesempenho {
  valor: number;
  operador: string;
}

export interface MetasDesempenhoMap {
  [metrica: string]: MetaDesempenho;
}
