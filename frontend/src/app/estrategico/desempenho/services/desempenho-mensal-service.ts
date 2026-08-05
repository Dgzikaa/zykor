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

  // Reservas lançadas na MÃO na tela semanal (Deboche não tem GetIn). O gold mensal
  // vem 0 nessas colunas, e a linha manual de granularidade='mensal' nunca é preenchida
  // — por isso o mês exibia zero enquanto a semana mostrava os números certos.
  // Somamos as semanas manuais no mês (mesma regra de quinta-feira ISO do marketing).
  const { data: manuaisSemanaisData } = await supabase
    .schema('meta' as never)
    .from('desempenho_manual')
    .select('ano, numero_semana, reservas_totais, reservas_presentes, mesas_totais, mesas_presentes')
    .eq('bar_id', barId)
    .eq('granularidade', 'semanal')
    .gte('ano', anoInicio)
    .lte('ano', anoFim);

  // Modo da integração GetIn: 'manual' = o lançamento na mão é a fonte (bar 4).
  const { data: integConfig } = await supabase
    .schema('operations' as never)
    .from('integracoes_bar')
    .select('integracao, modo')
    .eq('bar_id', barId)
    .eq('integracao', 'getin')
    .single();
  const getinManual = integConfig?.modo === 'manual';

  // Buscar meta.marketing_semanal pra agregar campos g_* e gmn_*
  // (gold.desempenho so tem m_*, mas o front exibe Google Ads e Google Meu Negocio)
  const { data: marketingData } = await supabase
    .schema('meta' as never)
    .from('marketing_semanal')
    .select('*')
    .eq('bar_id', barId)
    .gte('ano', anoInicio)
    .lte('ano', anoFim);

  // CMV Teorico MENSAL: fonte canonical agora eh financial.cmv_mensal
  // (cmv_teorico_percentual_manual editado pelo socio na aba CMV Mensal).
  const { data: cmvMensaisData } = await supabase
    .schema('financial' as never)
    .from('cmv_mensal')
    .select('ano, mes, cmv_teorico_percentual, cmv_teorico_percentual_manual')
    .eq('bar_id', barId)
    .gte('ano', anoInicio)
    .lte('ano', anoFim);
  // CMV teórico AUTO mensal: agrega gold.cmv_teorico_dia por mês (Σcusto/Σfaturamento) — mesma
  // fonte da aba CMV Mensal. O campo persistido em financial.cmv_mensal fica defasado (0 no mês
  // corrente), então a tabela de Desempenho ficava sem o CMV teórico do mês atual.
  const autoGoldMes = new Map<string, { c: number; f: number }>();
  {
    const { data: cd } = await supabase
      .schema('gold' as never)
      .from('cmv_teorico_dia')
      .select('data, custo, faturamento')
      .eq('bar_id', barId)
      .gte('data', `${anoInicio}-01-01`)
      .lte('data', `${anoFim}-12-31`);
    (cd as any[] || []).forEach((r) => {
      const k = String(r.data).slice(0, 7);
      const cur = autoGoldMes.get(k) || { c: 0, f: 0 };
      cur.c += Number(r.custo) || 0; cur.f += Number(r.faturamento) || 0;
      autoGoldMes.set(k, cur);
    });
  }
  const autoGoldMesPct = (key: string): number | null => {
    const a = autoGoldMes.get(key);
    return a && a.f > 0 ? Number((a.c / a.f * 100).toFixed(2)) : null;
  };

  // VOLUME de novos clientes por mês — mesmo overlay do semanal (ver desempenho-service.ts).
  // O gold.desempenho só tem o %, e o volume não sai dele: o denominador do % é clientes
  // ÚNICOS do dia. Somamos o numerador na fonte, então volume e % sempre contam a mesma coisa.
  const novosMes = new Map<string, number>();
  {
    const { data: nd } = await supabase
      .schema('gold' as never)
      .from('clientes_diario')
      .select('data_referencia, novos_clientes_dia')
      .eq('bar_id', barId)
      .gte('data_referencia', `${anoInicio}-01-01`)
      .lte('data_referencia', `${anoFim}-12-31`);
    (nd as any[] || []).forEach((r) => {
      const k = String(r.data_referencia).slice(0, 7);
      novosMes.set(k, (novosMes.get(k) || 0) + (Number(r.novos_clientes_dia) || 0));
    });
  }

  const cmvMensalMap = new Map<string, { manual: number | null; auto: number | null }>();
  (cmvMensaisData as any[] || []).forEach((c) => {
    const key = `${c.ano}-${String(c.mes).padStart(2, '0')}`;
    const manual = c.cmv_teorico_percentual_manual != null
      ? parseFloat(String(c.cmv_teorico_percentual_manual))
      : null;
    // auto: prioridade pro cálculo ao vivo do gold; cai no persistido só se o gold não cobrir o mês
    const autoGold = autoGoldMesPct(key);
    const autoPersist = c.cmv_teorico_percentual != null ? parseFloat(String(c.cmv_teorico_percentual)) : null;
    const auto = autoGold != null ? autoGold : autoPersist;
    cmvMensalMap.set(key, {
      manual: manual !== null && Number.isFinite(manual) && manual > 0 ? manual : null,
      auto: auto !== null && Number.isFinite(auto) && auto > 0 ? auto : null,
    });
  });

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

  // Soma das reservas manuais semanais por mês (quinta-feira ISO decide o mês da semana,
  // mesma regra do marketing acima — cada semana entra em um mês só, sem double counting).
  type ReservasAgg = { totais: number; presentes: number; mesas_totais: number; mesas_presentes: number };
  const reservasManuaisMes = new Map<string, ReservasAgg>();
  (manuaisSemanaisData || []).forEach((m: any) => {
    const start = isoWeekStart(m.ano, m.numero_semana);
    const thursday = new Date(start);
    thursday.setUTCDate(start.getUTCDate() + 3);
    const key = `${thursday.getUTCFullYear()}-${String(thursday.getUTCMonth() + 1).padStart(2, '0')}`;
    const agg = reservasManuaisMes.get(key) ?? { totais: 0, presentes: 0, mesas_totais: 0, mesas_presentes: 0 };
    agg.totais += Number(m.reservas_totais) || 0;
    agg.presentes += Number(m.reservas_presentes) || 0;
    agg.mesas_totais += Number(m.mesas_totais) || 0;
    agg.mesas_presentes += Number(m.mesas_presentes) || 0;
    reservasManuaisMes.set(key, agg);
  });

  // Mix de Vendas — % (por VALOR) e QUANTIDADES por mes (BEBIDA/DRINK/COMIDA).
  // get_mix_por_mes combina ContaHub (dias sem Yuzer) + Yuzer (dias de evento) —
  // meses sem Yuzer ficam idênticos ao gold. Sobrescreve o perc_* do gold.
  const anosUnicos = Array.from(new Set(mesesGold.map((m: any) => parseInt(m.periodo.split('-')[0]))));
  const mixPorMes = new Map<string, {
    qtd_bebidas: number; qtd_drinks: number; qtd_comida: number;
    perc_bebidas: number; perc_drinks: number; perc_comida: number;
  }>();
  // N+1 → Promise.all: as chamadas por ano são independentes (o processamento popula
  // chaves distintas, ordem não importa). Mesmo resultado, em paralelo.
  const mixResultados = await Promise.all(
    anosUnicos.map((a) => (supabase as any).rpc('get_mix_por_mes', { p_bar_id: barId, p_ano: a }))
  );
  for (const { data: rpcRows } of mixResultados) {
    for (const r of (rpcRows || []) as any[]) {
      const vb = parseFloat(String(r.val_bebida || 0));
      const vd = parseFloat(String(r.val_drink || 0));
      const vc = parseFloat(String(r.val_comida || 0));
      const tot = vb + vd + vc;
      mixPorMes.set(`${r.ano}-${String(r.mes).padStart(2, '0')}`, {
        qtd_bebidas: parseFloat(String(r.qtd_bebida || 0)),
        qtd_drinks: parseFloat(String(r.qtd_drink || 0)),
        qtd_comida: parseFloat(String(r.qtd_comida || 0)),
        perc_bebidas: tot > 0 ? (vb / tot) * 100 : 0,
        perc_drinks: tot > 0 ? (vd / tot) * 100 : 0,
        perc_comida: tot > 0 ? (vc / tot) * 100 : 0,
      });
    }
  }

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

    const mixQtd = mixPorMes.get(g.periodo);
    return {
      ...g,
      numero_semana: parseInt(g.periodo.split('-')[1]),
      atualizado_em: manual.atualizado_em ?? g.calculado_em,
      atualizado_por_nome: manual.id ? 'Manual' : 'Sistema ETL',
      // Mix de Vendas (ContaHub + Yuzer): qtds e % (por valor). Sobrescreve perc_* do gold.
      qtd_bebidas: mixQtd?.qtd_bebidas,
      qtd_drinks:  mixQtd?.qtd_drinks,
      qtd_comida:  mixQtd?.qtd_comida,
      perc_bebidas: mixQtd?.perc_bebidas ?? toNum((g as any).perc_bebidas) ?? (g as any).perc_bebidas,
      perc_drinks:  mixQtd?.perc_drinks  ?? toNum((g as any).perc_drinks)  ?? (g as any).perc_drinks,
      perc_comida:  mixQtd?.perc_comida  ?? toNum((g as any).perc_comida)  ?? (g as any).perc_comida,
      // Fat. Bar: real_r (ContaHub) inclui couvert. UI espera "produtos vendidos no bar"
      // = real_r - couvert. Calculado on-the-fly aqui pra evitar mexer em gold.planejamento.
      faturamento_bar: Math.max(0, (toNum(g.faturamento_bar) ?? 0) - (toNum(g.couvert_atracoes) ?? 0)),

      // CMO: manual.cmo eh o % editado pelo socio. cmo_valor (R$) vem do gold.
      // cmo_percentual: se tiver manual override, usa ele; senao calcula de gold.cmo/faturamento.
      // ATENCAO: em meta.desempenho_manual o "nao preenchido" e' 0, NAO null (95 linhas, zero
      // NULLs). O `!= null` dava true pro 0 e travava o calculo do gold — mes sem override
      // exibia CMO 0,0% tendo faturamento e gold.cmo disponiveis. Trata <= 0 como ausente.
      cmo: (manual.cmo != null && Number(manual.cmo) > 0 ? Number(manual.cmo) : null),
      // null (não 0) quando o mês não tem nenhum dia calculado: 0 leria como "não entrou
      // ninguém novo", que é diferente de "ainda não processou".
      clientes_novos: novosMes.has(g.periodo) ? novosMes.get(g.periodo)! : null,
      cmo_valor: toNum(g.cmo) ?? 0,
      cmo_percentual: (manual.cmo != null && Number(manual.cmo) > 0)
        ? Number(manual.cmo)
        : (toNum(g.cmo) != null && faturamentoTotal > 0 ? (Number(g.cmo) / faturamentoTotal * 100) : 0),

      // CMV Teorico: cascata cmv_mensal.manual -> meta.desempenho_manual (legado, só se > 0) -> cmv_mensal.auto.
      // O legado manual.cmv_teorico vem 0 (NÃO null); o ?? travava no 0 e escondia o auto do gold.
      cmv_teorico: cmvMensalMap.get(g.periodo)?.manual
        ?? (manual.cmv_teorico != null && Number(manual.cmv_teorico) > 0 ? Number(manual.cmv_teorico) : null)
        ?? cmvMensalMap.get(g.periodo)?.auto
        ?? 0,
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
      // NPS unificado = Digital + Salão (ponderado por respostas = NPS real da união).
      ...(() => {
        const rd = toNum(g.nps_digital_respostas) ?? manual.nps_digital_respostas ?? 0;
        const rs = toNum(g.nps_salao_respostas) ?? manual.nps_salao_respostas ?? 0;
        const rt = rd + rs;
        const d = toNum(g.nps_digital) ?? manual.nps_digital ?? 0;
        const sa = toNum(g.nps_salao) ?? manual.nps_salao ?? 0;
        const nps = rt > 0 ? Math.round(((d * rd + sa * rs) / rt) * 10) / 10 : null;
        return { nps, nps_ds_respostas: rt };
      })(),
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

      // Reservas: mesma cascata do semanal (desempenho-service.ts). Em bar de GetIn
      // manual (Deboche) a fonte é o lançamento na mão — aqui somado das semanas, porque
      // a linha manual mensal existe mas nunca é preenchida (fica 0, e 0 = "não preenchido",
      // não "nenhuma reserva"). Em bar com API o gold ganha e nada muda.
      ...(() => {
        const rm = reservasManuaisMes.get(g.periodo);
        const mm = manuaisMap.get(g.periodo) || {};
        // > 0 e não `?? `: em meta.desempenho_manual o não preenchido é 0, não null.
        const pos = (v: unknown): number | null => {
          const n = toNum(v);
          return n !== null && n > 0 ? n : null;
        };
        const goldTotais = pos(g.reservas_totais_pessoas) ?? pos(g.reservas_totais);
        const goldPresentes = pos(g.reservas_presentes_pessoas) ?? pos(g.reservas_presentes);
        const goldMesasTotais = pos(g.reservas_totais_quantidade) ?? pos(g.mesas_totais);
        const goldMesasPresentes = pos(g.reservas_presentes_quantidade) ?? pos(g.mesas_presentes);
        const manualTotais = pos(mm.reservas_totais) ?? pos(rm?.totais);
        const manualPresentes = pos(mm.reservas_presentes) ?? pos(rm?.presentes);
        const manualMesasTotais = pos(mm.mesas_totais) ?? pos(rm?.mesas_totais);
        const manualMesasPresentes = pos(mm.mesas_presentes) ?? pos(rm?.mesas_presentes);

        const reservasTotais = (getinManual ? manualTotais ?? goldTotais : goldTotais ?? manualTotais) ?? 0;
        const reservasPresentes = (getinManual ? manualPresentes ?? goldPresentes : goldPresentes ?? manualPresentes) ?? 0;

        return {
          reservas_totais: reservasTotais,
          reservas_presentes: reservasPresentes,
          mesas_totais: (getinManual ? manualMesasTotais ?? goldMesasTotais : goldMesasTotais ?? manualMesasTotais) ?? 0,
          mesas_presentes: (getinManual ? manualMesasPresentes ?? goldMesasPresentes : goldMesasPresentes ?? manualMesasPresentes) ?? 0,
          // Quebra de reservas: (totais - presentes) / totais * 100 (fórmula do semanal)
          quebra_reservas: reservasTotais > 0
            ? ((reservasTotais - reservasPresentes) / reservasTotais) * 100
            : 0,
        };
      })(),

      // Cancelamentos: gold cancelamentos_total -> front cancelamentos
      cancelamentos: toNum(g.cancelamentos_total) ?? toNum(g.cancelamentos),

      // Meta Ads: front exibe key 'm_cpc', gold tem coluna 'm_custo_por_clique'.
      // Fallback: se a fonte vier 0 mas houve gasto + cliques, deriva investido/cliques.
      m_cpc: (() => {
        const cpc = toNum(g.m_custo_por_clique) ?? 0;
        if (cpc > 0) return cpc;
        const inv = toNum(g.m_valor_investido) ?? 0;
        const cli = toNum(g.m_cliques) ?? 0;
        return cli > 0 && inv > 0 ? Number((inv / cli).toFixed(2)) : cpc;
      })(),

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
