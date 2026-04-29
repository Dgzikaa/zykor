import { SupabaseClient } from '@supabase/supabase-js';
import {
  ContahubStockoutMixRow,
  DadosSemana,
  DesempenhoSemanalDbRow,
  EventoBaseDiarioRow,
  MarketingSemanalRow,
  SemanaProporcaoMes,
} from '../types';

export async function getMeses(
  supabase: SupabaseClient,
  barId: number,
  anoInicio: number,
  mesInicio: number,
  anoFim: number,
  mesFim: number
): Promise<DadosSemana[]> {
  
  // NOVO: Buscar direto de gold.desempenho com granularidade='mensal'
  // Gold já tem mensalidade pré-calculada (elimina ~200 linhas de agregação JS)
  const { data: mesesGold, error } = await supabase
    .schema('gold' as never)
    .from('desempenho')
    .select('*')
    .eq('bar_id', barId)
    .eq('granularidade', 'mensal')
    .gte('periodo', `${anoInicio}-${String(mesInicio).padStart(2, '0')}`)
    .lte('periodo', `${anoFim}-${String(mesFim).padStart(2, '0')}`)
    .order('periodo', { ascending: true });

  if (error) {
    console.error('❌ Erro em gold.desempenho (mensal):', {
      message: error.message,
      code: error.code,
      barId,
    });
    throw new Error(`Erro ao carregar desempenho mensal: ${error.message}`);
  }

  if (!mesesGold || mesesGold.length === 0) {
    return [];
  }

  // Buscar meta.desempenho_manual pra aplicar overrides editados pelo socio
  // (CMO, CMV teorico, NPS, stockout manual, etc — mesmo conceito do semanal)
  const { data: manuaisData } = await supabase
    .schema('meta' as never)
    .from('desempenho_manual')
    .select('*')
    .eq('bar_id', barId)
    .eq('granularidade', 'mensal')
    .gte('ano', anoInicio)
    .lte('ano', anoFim);

  const manuaisMap = new Map<string, any>();
  (manuaisData || []).forEach((m: any) => {
    const key = `${m.ano}-${String(m.mes).padStart(2, '0')}`;
    manuaisMap.set(key, m);
  });

  // Buscar meta.marketing_semanal pra agregar campos g_* e gmn_*
  // (gold.desempenho so tem m_*, mas o front exibe Google Ads e Google Meu Negocio)
  const { data: marketingData } = await supabase
    .schema('meta' as never)
    .from('marketing_semanal')
    .select('*')
    .eq('bar_id', barId)
    .gte('ano', anoInicio)
    .lte('ano', anoFim);

  // Agrupa marketing_semanal por (ano, mes) — quinta-feira ISO determina o mes
  // (mesma logica do ETL etl_gold_desempenho_mensal pra evitar double counting)
  const isoWeekStart = (ano: number, semana: number): Date => {
    // ISO: semana 1 contém o 4 de janeiro; week start = monday
    const jan4 = new Date(Date.UTC(ano, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // domingo=0 -> 7
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (semana - 1) * 7);
    return start;
  };

  type MktAgg = {
    g_valor_investido: number;
    g_impressoes: number;
    g_cliques: number;
    g_ctr_sum: number; g_ctr_n: number;
    g_solicitacoes_rotas: number;
    gmn_total_visualizacoes: number;
    gmn_total_acoes: number;
    gmn_solicitacoes_rotas: number;
    gmn_visu_pesquisa: number;
    gmn_visu_maps: number;
    gmn_cliques_website: number;
    gmn_ligacoes: number;
    gmn_menu_views: number;
  };
  const marketingMensalMap = new Map<string, MktAgg>();

  (marketingData || []).forEach((m: any) => {
    const start = isoWeekStart(m.ano, m.semana);
    const thursday = new Date(start);
    thursday.setUTCDate(start.getUTCDate() + 3);
    const mesAno = thursday.getUTCFullYear();
    const mesMes = thursday.getUTCMonth() + 1;
    const key = `${mesAno}-${String(mesMes).padStart(2, '0')}`;
    const agg = marketingMensalMap.get(key) ?? {
      g_valor_investido: 0, g_impressoes: 0, g_cliques: 0,
      g_ctr_sum: 0, g_ctr_n: 0, g_solicitacoes_rotas: 0,
      gmn_total_visualizacoes: 0, gmn_total_acoes: 0, gmn_solicitacoes_rotas: 0,
      gmn_visu_pesquisa: 0, gmn_visu_maps: 0, gmn_cliques_website: 0,
      gmn_ligacoes: 0, gmn_menu_views: 0,
    };
    agg.g_valor_investido += Number(m.g_valor_investido) || 0;
    agg.g_impressoes += Number(m.g_impressoes) || 0;
    agg.g_cliques += Number(m.g_cliques) || 0;
    if (m.g_ctr != null) { agg.g_ctr_sum += Number(m.g_ctr); agg.g_ctr_n += 1; }
    agg.g_solicitacoes_rotas += Number(m.g_solicitacoes_rotas) || 0;
    agg.gmn_total_visualizacoes += Number(m.gmn_total_visualizacoes) || 0;
    agg.gmn_total_acoes += Number(m.gmn_total_acoes) || 0;
    agg.gmn_solicitacoes_rotas += Number(m.gmn_solicitacoes_rotas) || 0;
    agg.gmn_visu_pesquisa += Number(m.gmn_visu_pesquisa) || 0;
    agg.gmn_visu_maps += Number(m.gmn_visu_maps) || 0;
    agg.gmn_cliques_website += Number(m.gmn_cliques_website) || 0;
    agg.gmn_ligacoes += Number(m.gmn_ligacoes) || 0;
    agg.gmn_menu_views += Number(m.gmn_menu_views) || 0;
    marketingMensalMap.set(key, agg);
  });

  // Mapeamento gold.desempenho -> nomes esperados pelo front
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
    return null;
  };

  return mesesGold.map((g: any) => {
    const tempoDrinks = toNum(g.tempo_drinks);
    const tempoCozinha = toNum(g.tempo_cozinha);
    const faturamentoTotal = toNum(g.faturamento_total) ?? 0;
    const descontoTotal = toNum(g.desconto_total) ?? 0;
    const mkt = marketingMensalMap.get(g.periodo);
    const manual = manuaisMap.get(g.periodo) || {};

    return {
      ...g,
      numero_semana: parseInt(g.periodo.split('-')[1]),
      atualizado_em: manual.atualizado_em ?? g.calculado_em,
      atualizado_por_nome: manual.id ? 'Manual' : 'Sistema ETL',

      // CMO: manual.cmo eh o % editado pelo socio. cmo_valor (R$) vem do gold.
      // cmo_percentual: se tiver manual override, usa ele; senao calcula de gold.cmo/faturamento.
      cmo: manual.cmo ?? null,
      cmo_valor: toNum(g.cmo) ?? 0,
      cmo_percentual: manual.cmo != null
        ? Number(manual.cmo)
        : (toNum(g.cmo) != null && faturamentoTotal > 0 ? (Number(g.cmo) / faturamentoTotal * 100) : 0),

      // CMV manual override
      cmv_teorico: manual.cmv_teorico ?? 0,
      cmv_limpo: toNum(g.cmv_percentual) ?? manual.cmv_limpo ?? 0,
      cmv_limpo_percentual: toNum(g.cmv_percentual) ?? manual.cmv_limpo ?? 0,
      cmv_rs: toNum(g.cmv) ?? manual.cmv ?? 0,

      // NPS overrides (igual semanal)
      nps_digital: toNum(g.nps_digital) ?? manual.nps_digital ?? 0,
      nps_digital_respostas: toNum(g.nps_digital_respostas) ?? manual.nps_digital_respostas ?? 0,
      nps_salao: toNum(g.nps_salao) ?? manual.nps_salao ?? 0,
      nps_salao_respostas: toNum(g.nps_salao_respostas) ?? manual.nps_salao_respostas ?? 0,
      nps_reservas: toNum(g.nps_reservas) ?? manual.nps_reservas ?? 0,
      nps_reservas_respostas: toNum(g.nps_reservas_respostas) ?? manual.nps_reservas_respostas ?? 0,
      nota_felicidade_equipe: g.nota_felicidade_equipe ?? manual.nota_felicidade_equipe ?? null,

      // Tempos: gold em SEGUNDOS -> front em MINUTOS. Filtra clamp 9999 (outliers).
      tempo_saida_bar: tempoDrinks !== null && tempoDrinks < 9999 ? Math.round(tempoDrinks / 60 * 100) / 100 : null,
      tempo_saida_cozinha: tempoCozinha !== null && tempoCozinha < 9999 ? Math.round(tempoCozinha / 60 * 100) / 100 : null,

      // Atrasos: rename gold -> front
      atrasinhos_bar: toNum(g.atrasinho_drinks),
      atrasos_bar: toNum(g.atrasao_drinks),
      atrasos_bar_perc: toNum(g.atrasos_drinks_perc),
      atrasinhos_cozinha: toNum(g.atrasinho_cozinha),
      atrasos_cozinha: toNum(g.atrasao_cozinha),
      atrasos_cozinha_perc: toNum(g.atrasos_comida_perc),

      // Descontos: gold tem desconto_total/desconto_percentual; front espera descontos_valor/descontos_perc
      descontos_valor: descontoTotal,
      descontos_perc: faturamentoTotal > 0 ? (descontoTotal / faturamentoTotal) * 100 : 0,

      // Cancelamentos: gold cancelamentos_total -> front cancelamentos
      cancelamentos: toNum(g.cancelamentos_total) ?? toNum(g.cancelamentos),

      // Meta Ads: front exibe key 'm_cpc', gold tem coluna 'm_custo_por_clique'
      m_cpc: toNum(g.m_custo_por_clique),

      // Google Ads e Google Meu Negocio: gold nao tem essas colunas — agrega de meta.marketing_semanal
      g_valor_investido: mkt?.g_valor_investido ?? 0,
      g_impressoes: mkt?.g_impressoes ?? 0,
      g_cliques: mkt?.g_cliques ?? 0,
      g_ctr: mkt && mkt.g_ctr_n > 0 ? mkt.g_ctr_sum / mkt.g_ctr_n : 0,
      g_solicitacoes_rotas: mkt?.g_solicitacoes_rotas ?? 0,
      gmn_total_visualizacoes: mkt?.gmn_total_visualizacoes ?? 0,
      gmn_total_acoes: mkt?.gmn_total_acoes ?? 0,
      gmn_solicitacoes_rotas: mkt?.gmn_solicitacoes_rotas ?? 0,
      gmn_visu_pesquisa: mkt?.gmn_visu_pesquisa ?? 0,
      gmn_visu_maps: mkt?.gmn_visu_maps ?? 0,
      gmn_cliques_website: mkt?.gmn_cliques_website ?? 0,
      gmn_ligacoes: mkt?.gmn_ligacoes ?? 0,
      gmn_menu_views: mkt?.gmn_menu_views ?? 0,
    };
  }) as DadosSemana[];
}

// REMOVIDO: getDadosMensais e helpers de agregação JS
// Gold já tem granularidade mensal pré-calculada
