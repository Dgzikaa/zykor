import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// Campos consumidos de gold.planejamento por evento
const CAMPOS = [
  'id',
  'bar_id',
  'data_evento',
  'dia_semana',
  'semana',
  'nome',
  'artista',
  'genero',
  'nome_evento',
  'm1_r',
  'cl_plan',
  'cl_real',
  'publico_real',
  'publico_real_consolidado',
  'res_tot',
  'res_p',
  'real_r',
  'faturamento_total_consolidado',
  'faturamento_liquido',
  'faturamento_couvert',
  'faturamento_couvert_manual',
  'faturamento_bar',
  'faturamento_bar_manual',
  'faturamento_entrada',
  'te_real',
  'tb_real',
  't_medio',
  'c_art',
  'c_prod',
  'c_artistico_plan',
  'percent_art_fat',
  'percent_b',
  'percent_d',
  'percent_c',
  'percent_happy_hour',
  'percent_stockout',
  'stockout_bebidas_perc',
  'stockout_comidas_perc',
  'stockout_drinks_perc',
  't_coz',
  't_bar',
  'atrasinho_cozinha',
  'atrasinho_bar',
  'atrasao_cozinha',
  'atrasao_bar',
  'cancelamentos',
  'descontos',
  'fat_19h',
  'fat_19h_percent',
  // fat_20h, fat_20h_percent, pessoas_ate_19h, pessoas_ate_20h NÃO existem em
  // gold.planejamento (pediam e quebravam a query com 500). Vêm do eventos_base
  // ao vivo logo abaixo (Object.assign dos "cortes por hora").
  'capacidade_estimada',
  'observacoes',
].join(', ');

const DIAS_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type Row = Record<string, any>;
type Gran = 'dia' | 'semana' | 'mes';

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);

function faturamentoDe(e: Row): number {
  return num(e.faturamento_total_consolidado) || num(e.real_r);
}
function publicoDe(e: Row): number {
  return num(e.publico_real_consolidado) || num(e.publico_real) || num(e.cl_real);
}
function couvertDe(e: Row): number {
  return num(e.faturamento_couvert_manual) || num(e.faturamento_couvert);
}
function barDe(e: Row): number {
  const direto = num(e.faturamento_bar_manual) || num(e.faturamento_bar);
  if (direto > 0) return direto;
  // gold.planejamento muitas vezes só guarda o couvert por evento; o bar é o resto
  const resto = faturamentoDe(e) - couvertDe(e);
  return resto > 0 ? resto : 0;
}
function ticketDe(e: Row): number {
  const t = num(e.t_medio);
  if (t > 0) return t;
  const pub = publicoDe(e);
  return pub > 0 ? faturamentoDe(e) / pub : 0;
}
function custoTotalDe(e: Row): number {
  return num(e.c_art) + num(e.c_prod);
}
function resultadoDe(e: Row): number {
  return faturamentoDe(e) - custoTotalDe(e);
}
function atrasosTotalDe(e: Row): number {
  return num(e.atrasao_cozinha) + num(e.atrasao_bar);
}

interface Metricas {
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

function metricas(e: Row): Metricas {
  return {
    faturamento: faturamentoDe(e),
    publico: publicoDe(e),
    couvert: couvertDe(e),
    bar: barDe(e),
    ticket: ticketDe(e),
    c_art: num(e.c_art),
    c_prod: num(e.c_prod),
    custo_total: custoTotalDe(e),
    resultado: resultadoDe(e),
    percent_comida: num(e.percent_c),
    percent_bebida: num(e.percent_b),
    percent_drink: num(e.percent_d),
    percent_stockout: num(e.percent_stockout),
    atrasos: atrasosTotalDe(e),
    res_tot: num(e.res_tot),
  };
}

// Contexto bruto (stockout/atrasos) usado nas frases do diagnóstico
interface Ctx {
  stockout_bebidas_perc: number;
  stockout_comidas_perc: number;
  stockout_drinks_perc: number;
  atrasao_cozinha: number;
  atrasao_bar: number;
}
function ctxDe(e: Row): Ctx {
  return {
    stockout_bebidas_perc: num(e.stockout_bebidas_perc),
    stockout_comidas_perc: num(e.stockout_comidas_perc),
    stockout_drinks_perc: num(e.stockout_drinks_perc),
    atrasao_cozinha: num(e.atrasao_cozinha),
    atrasao_bar: num(e.atrasao_bar),
  };
}

// Agregação de um conjunto de eventos (semana/mês)
function agregar(eventos: Row[]): { m: Metricas; ctx: Ctx; extras: Row } {
  const ms = eventos.map(metricas);
  const fat = ms.reduce((s, x) => s + x.faturamento, 0);
  const publico = ms.reduce((s, x) => s + x.publico, 0);
  const wavg = (sel: (x: Metricas) => number) =>
    fat > 0 ? ms.reduce((s, x) => s + sel(x) * x.faturamento, 0) / fat : 0;
  const sum = (sel: (x: Metricas) => number) => ms.reduce((s, x) => s + sel(x), 0);

  const m: Metricas = {
    faturamento: fat,
    publico,
    couvert: sum((x) => x.couvert),
    bar: sum((x) => x.bar),
    ticket: publico > 0 ? fat / publico : 0,
    c_art: sum((x) => x.c_art),
    c_prod: sum((x) => x.c_prod),
    custo_total: sum((x) => x.custo_total),
    resultado: sum((x) => x.resultado),
    percent_comida: wavg((x) => x.percent_comida),
    percent_bebida: wavg((x) => x.percent_bebida),
    percent_drink: wavg((x) => x.percent_drink),
    percent_stockout: wavg((x) => x.percent_stockout),
    atrasos: sum((x) => x.atrasos),
    res_tot: sum((x) => x.res_tot),
  };

  const sumRaw = (k: string) => eventos.reduce((s, e) => s + num(e[k]), 0);
  const wavgRaw = (k: string) =>
    fat > 0
      ? eventos.reduce((s, e) => s + num(e[k]) * faturamentoDe(e), 0) / fat
      : 0;

  const ctx: Ctx = {
    stockout_bebidas_perc: wavgRaw('stockout_bebidas_perc'),
    stockout_comidas_perc: wavgRaw('stockout_comidas_perc'),
    stockout_drinks_perc: wavgRaw('stockout_drinks_perc'),
    atrasao_cozinha: sumRaw('atrasao_cozinha'),
    atrasao_bar: sumRaw('atrasao_bar'),
  };

  const extras: Row = {
    atrasao_cozinha: sumRaw('atrasao_cozinha'),
    atrasao_bar: sumRaw('atrasao_bar'),
    atrasinho_cozinha: sumRaw('atrasinho_cozinha'),
    atrasinho_bar: sumRaw('atrasinho_bar'),
    stockout_bebidas_perc: ctx.stockout_bebidas_perc,
    stockout_comidas_perc: ctx.stockout_comidas_perc,
    stockout_drinks_perc: ctx.stockout_drinks_perc,
    t_coz: wavgRaw('t_coz'),
    t_bar: wavgRaw('t_bar'),
    res_tot: sumRaw('res_tot'),
    res_p: sumRaw('res_p'),
    cancelamentos: sumRaw('cancelamentos'),
    descontos: sumRaw('descontos'),
  };

  return { m, ctx, extras };
}

// Custo artístico/produção direto do Conta Azul (regime de competência) para o período.
// Fonte autoritativa do P&L; o gold por-evento subconta (atribui só a dias com evento).
async function custosCA(
  barId: number,
  inicio: string,
  fim: string
): Promise<{ c_art: number; c_prod: number }> {
  const bronze = (supabase as any).schema('bronze');
  const { data } = await bronze
    .from('bronze_contaazul_lancamentos')
    .select('valor_bruto, categoria_nome')
    .eq('bar_id', barId)
    .is('excluido_em', null)
    .gte('data_competencia', inicio)
    .lte('data_competencia', fim)
    .in('categoria_nome', ['Atrações Programação', 'Produção Eventos']);
  let c_art = 0;
  let c_prod = 0;
  for (const r of (data || []) as Row[]) {
    const v = num(r.valor_bruto);
    if (r.categoria_nome === 'Atrações Programação') c_art += v;
    else if (r.categoria_nome === 'Produção Eventos') c_prod += v;
  }
  return { c_art, c_prod };
}

// Fonte canônica de semana/mês: gold.desempenho (mesma que a tela de Desempenho usa).
// Resolve a divergência do gold.planejamento por-evento (atrasos inflados por fan-out +
// contar bebida). Aqui só DRINK conta como bar, igual à apresentação.
async function lerDesempenho(
  barId: number,
  gran: Gran,
  inicio: string
): Promise<Row | null> {
  const goldD = (supabase as any).schema('gold');
  let q = goldD.from('desempenho').select('*').eq('bar_id', barId);
  if (gran === 'mes')
    q = q.eq('granularidade', 'mensal').eq('periodo', inicio.slice(0, 7));
  else q = q.eq('granularidade', 'semanal').eq('data_inicio', inicio);
  const { data } = await q.limit(1);
  return data && data.length ? (data[0] as Row) : null;
}

function fromDesempenho(d: Row): {
  m: Metricas;
  ctx: Ctx;
  extras: Row;
  nps: Row;
} {
  const fat = num(d.faturamento_total);
  const publico = num(d.clientes_atendidos);
  // couvert real vem de couvert_atracoes (faturamento_entrada vem 0 no mensal);
  // bar = o que sobra do faturamento (couvert e bar são as únicas receitas)
  const couvert = num(d.couvert_atracoes);
  const m: Metricas = {
    faturamento: fat,
    publico,
    couvert,
    bar: Math.max(0, fat - couvert),
    ticket: num(d.ticket_medio) || (publico > 0 ? fat / publico : 0),
    c_art: 0,
    c_prod: 0,
    custo_total: 0,
    resultado: 0,
    percent_comida: num(d.perc_comida),
    percent_bebida: num(d.perc_bebidas),
    percent_drink: num(d.perc_drinks),
    percent_stockout: num(d.stockout_total_perc),
    atrasos: num(d.atrasao_cozinha) + num(d.atrasao_drinks),
    res_tot: num(d.reservas_totais_quantidade) || num(d.reservas_totais),
  };
  const ctx: Ctx = {
    stockout_bebidas_perc: num(d.stockout_bar_perc),
    stockout_comidas_perc: num(d.stockout_comidas_perc),
    stockout_drinks_perc: num(d.stockout_drinks_perc),
    atrasao_cozinha: num(d.atrasao_cozinha),
    atrasao_bar: num(d.atrasao_drinks),
  };
  const extras: Row = {
    atrasao_cozinha: num(d.atrasao_cozinha),
    atrasao_bar: num(d.atrasao_drinks),
    atrasinho_cozinha: num(d.atrasinho_cozinha),
    atrasinho_bar: num(d.atrasinho_drinks),
    stockout_bebidas_perc: num(d.stockout_bar_perc),
    stockout_comidas_perc: num(d.stockout_comidas_perc),
    stockout_drinks_perc: num(d.stockout_drinks_perc),
    t_coz: num(d.tempo_cozinha), // segundos
    t_bar: num(d.tempo_drinks), // segundos (drinks, como na apresentação)
    res_tot: num(d.reservas_totais_quantidade) || num(d.reservas_totais),
    res_p: num(d.reservas_presentes_quantidade) || num(d.reservas_presentes),
    cancelamentos: num(d.cancelamentos_total),
    cancelamentos_qtd: num(d.cancelamentos_qtd),
    conta_assinada: num(d.conta_assinada_valor),
    conta_assinada_perc: num(d.conta_assinada_perc),
    descontos: num(d.desconto_total),
    reservas_quebra_pct: num(d.reservas_quebra_pct),
    mesas_totais: num(d.mesas_totais),
    mesas_presentes: num(d.mesas_presentes),
    clientes_ativos: num(d.clientes_ativos),
    perc_clientes_novos: num(d.perc_clientes_novos),
  };
  const nps: Row = {
    geral: d.nps_geral,
    respostas: num(d.nps_respostas),
    comida: d.nps_comida,
    drink: d.nps_drink,
    atendimento: d.nps_atendimento,
    ambiente: d.nps_ambiente,
    musica: d.nps_musica,
    preco: d.nps_preco,
    limpeza: d.nps_limpeza,
  };
  return { m, ctx, extras, nps };
}

// NPS por dia (silver.nps_diario) — para o gráfico de NPS diário
async function lerNpsDiario(
  barId: number,
  inicio: string,
  fim: string
): Promise<Array<{ data: string; score: number; respostas: number }>> {
  const silver = (supabase as any).schema('silver');
  const { data } = await silver
    .from('nps_diario')
    .select('data_referencia, nps_score, total_respostas')
    .eq('bar_id', barId)
    .gte('data_referencia', inicio)
    .lte('data_referencia', fim)
    .order('data_referencia', { ascending: true });
  return ((data || []) as Row[]).map((r) => ({
    data: r.data_referencia,
    score: num(r.nps_score),
    respostas: num(r.total_respostas),
  }));
}

// Cancelamentos por dia (bronze_contahub_avendas_cancelamentos) — mesma fonte do desempenho.
// gold.planejamento.cancelamentos NÃO é populado pelo ETL, por isso buscamos direto.
async function lerCancelamentosPorDia(
  barId: number,
  inicio: string,
  fim: string
): Promise<Record<string, number>> {
  const bronze = (supabase as any).schema('bronze');
  const { data } = await bronze
    .from('bronze_contahub_avendas_cancelamentos')
    .select('dt_gerencial, custototal')
    .eq('bar_id', barId)
    .gte('dt_gerencial', inicio)
    .lte('dt_gerencial', fim);
  const mapa: Record<string, number> = {};
  for (const r of (data || []) as Row[]) {
    const dia = r.dt_gerencial as string;
    mapa[dia] = (mapa[dia] || 0) + num(r.custototal);
  }
  return mapa;
}

// Conta assinada por dia (bronze pagamentos, meio = 'Conta Assinada') — fonte do desempenho.
async function lerContaAssinadaPorDia(
  barId: number,
  inicio: string,
  fim: string
): Promise<Record<string, number>> {
  const bronze = (supabase as any).schema('bronze');
  const { data } = await bronze
    .from('bronze_contahub_financeiro_pagamentosrecebidos')
    .select('dt_gerencial, valor')
    .eq('bar_id', barId)
    .eq('meio', 'Conta Assinada')
    .gte('dt_gerencial', inicio)
    .lte('dt_gerencial', fim);
  const mapa: Record<string, number> = {};
  for (const r of (data || []) as Row[]) {
    const dia = r.dt_gerencial as string;
    mapa[dia] = (mapa[dia] || 0) + num(r.valor);
  }
  return mapa;
}

const somaMapa = (m: Record<string, number>) =>
  Object.values(m).reduce((s, v) => s + v, 0);

// ---------------------------------------------------------------------------
// Planejado vs Realizado — lê as "fotos" do plano (operations.evento_plano_snapshots)
// e a view consolidada por evento. Plano = foto inicial (meta + projeção congeladas);
// Realizado = foto final (real_r + custos do Conta Azul). Funciona pra dia/semana/mês
// somando todos os eventos do período. No dia (inicio===fim) traz a linha do tempo
// completa de snapshots (inicial -> revisões -> final).
// ---------------------------------------------------------------------------
interface PlanoLado {
  faturamento: number; c_art: number; c_prod: number;
  pct_art_fat: number | null; pct_prod_fat: number | null;
}
interface PlanoBloco {
  plano: PlanoLado;
  realizado: PlanoLado;
  delta: { faturamento: number; faturamento_pct: number | null; c_art: number; c_prod: number };
  n_eventos: number;
  n_realizados: number;
  eventos: Row[];
  snapshots: Row[];
  contexto_datas: Row[];
}
async function lerPlanoVsReal(barId: number, inicio: string, fim: string): Promise<PlanoBloco> {
  const ops = (supabase as any).schema('operations');
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

  const { data: vRows } = await ops
    .from('v_evento_plano_vs_real')
    .select(
      'evento_id, data_evento, nome, fat_planejado, c_art_planejado, c_prod_planejado, ' +
        'pct_art_planejado, fat_realizado, c_art_realizado, c_prod_realizado, ' +
        'pct_art_realizado, delta_fat_pct, n_revisoes'
    )
    .eq('bar_id', barId)
    .gte('data_evento', inicio)
    .lte('data_evento', fim)
    .order('data_evento', { ascending: true });

  const eventos = (vRows || []) as Row[];
  let planoFat = 0, planoArt = 0, planoProd = 0, realFat = 0, realArt = 0, realProd = 0;
  let nPlan = 0, nReal = 0;
  for (const e of eventos) {
    if (e.fat_planejado != null) {
      planoFat += num(e.fat_planejado); planoArt += num(e.c_art_planejado); planoProd += num(e.c_prod_planejado); nPlan++;
    }
    if (e.fat_realizado != null) {
      realFat += num(e.fat_realizado); realArt += num(e.c_art_realizado); realProd += num(e.c_prod_realizado); nReal++;
    }
  }

  const plano: PlanoLado = {
    faturamento: planoFat, c_art: planoArt, c_prod: planoProd,
    pct_art_fat: pct(planoArt, planoFat), pct_prod_fat: pct(planoProd, planoFat),
  };
  const realizado: PlanoLado = {
    faturamento: realFat, c_art: realArt, c_prod: realProd,
    pct_art_fat: pct(realArt, realFat), pct_prod_fat: pct(realProd, realFat),
  };
  const delta = {
    faturamento: realFat - planoFat,
    faturamento_pct: planoFat > 0 ? Math.round(((realFat - planoFat) / planoFat) * 1000) / 10 : null,
    c_art: realArt - planoArt,
    c_prod: realProd - planoProd,
  };

  // Linha do tempo de snapshots (só detalha quando é um único dia)
  let snapshots: Row[] = [];
  if (inicio === fim) {
    const { data: snapRows } = await ops
      .from('evento_plano_snapshots')
      .select('tipo, versao, faturamento, c_art, c_prod, pct_art_fat, pct_prod_fat, fonte, criado_em')
      .eq('bar_id', barId)
      .eq('data_evento', inicio)
      .order('criado_em', { ascending: true });
    snapshots = (snapRows || []) as Row[];
  }

  // Contexto de datas: feriados/datas especiais no período, com o fator de ajuste
  // histórico do bar (derivado de backtest) — ajuda a avaliar se a meta foi
  // otimista para a data (ex.: Dia das Mães o Ordinário costuma faturar menos).
  const { data: ferRows } = await ops
    .from('feriados_eventos')
    .select('data, nome, tipo, ajuste_ord, ajuste_deb, observacao')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: true });
  const contexto_datas: Row[] = (ferRows || []).map((r: Row) => ({
    data: r.data,
    nome: r.nome,
    tipo: r.tipo,
    ajuste: num(barId === 4 ? r.ajuste_deb : r.ajuste_ord),
    observacao: r.observacao,
  }));

  return { plano, realizado, delta, n_eventos: nPlan, n_realizados: nReal, eventos, snapshots, contexto_datas };
}

// Breakdown consolidado (ContaHub + Yuzer + Sympla) por evento.
// gold.planejamento guarda só o total consolidado (faturamento_total_consolidado);
// a separação entrada/couvert/bar e o ticket corretos vivem em operations.eventos_base,
// preenchidos pelo calculate_evento_metrics (gated em usa_yuzer/usa_sympla). Para eventos
// marcados como Yuzer/Sympla, sobrepomos esse breakdown para os gráficos baterem 100%.
interface ConsolidadoEB {
  usa_yuzer: boolean;
  usa_sympla: boolean;
  real_r: number;
  faturamento_entrada: number;
  faturamento_couvert: number;
  faturamento_bar: number;
  yuzer_ingressos: number;
  yuzer_liquido: number;
  sympla_liquido: number;
  sympla_checkins: number;
  cl_real: number;
  t_medio: number;
}
async function lerConsolidadoEventoBase(
  barId: number,
  data: string
): Promise<ConsolidadoEB | null> {
  const ops = (supabase as any).schema('operations');
  const { data: rows } = await ops
    .from('eventos_base')
    .select(
      'usa_yuzer, usa_sympla, real_r, faturamento_entrada, faturamento_couvert, faturamento_bar, yuzer_ingressos, yuzer_liquido, sympla_liquido, sympla_checkins, cl_real, t_medio'
    )
    .eq('bar_id', barId)
    .eq('data_evento', data)
    .limit(1);
  if (!rows || !rows.length) return null;
  const r = rows[0] as Row;
  return {
    usa_yuzer: !!r.usa_yuzer,
    usa_sympla: !!r.usa_sympla,
    real_r: num(r.real_r),
    faturamento_entrada: num(r.faturamento_entrada),
    faturamento_couvert: num(r.faturamento_couvert),
    faturamento_bar: num(r.faturamento_bar),
    yuzer_ingressos: num(r.yuzer_ingressos),
    yuzer_liquido: num(r.yuzer_liquido),
    sympla_liquido: num(r.sympla_liquido),
    sympla_checkins: num(r.sympla_checkins),
    cl_real: num(r.cl_real),
    t_medio: num(r.t_medio),
  };
}

function media(eventos: Row[]): Metricas | null {
  if (!eventos.length) return null;
  const ms = eventos.map(metricas);
  const out: any = {};
  for (const k of Object.keys(ms[0])) {
    out[k] = ms.reduce((s, x) => s + (x as any)[k], 0) / ms.length;
  }
  return out as Metricas;
}

function pct(atual: number, base: number): number | null {
  if (!base) return null;
  return ((atual - base) / base) * 100;
}

// Janela de período a partir de uma data âncora
function periodoDe(data: string, gran: Gran) {
  const [y, mo, d] = data.split('-').map(Number);
  const iso = (dt: Date) => dt.toISOString().split('T')[0];
  if (gran === 'mes') {
    const inicio = new Date(Date.UTC(y, mo - 1, 1));
    const fim = new Date(Date.UTC(y, mo, 0));
    const pIni = new Date(Date.UTC(y, mo - 2, 1));
    const pFim = new Date(Date.UTC(y, mo - 1, 0));
    return {
      inicio: iso(inicio),
      fim: iso(fim),
      prevInicio: iso(pIni),
      prevFim: iso(pFim),
      label: `${MESES[mo - 1]} ${y}`,
      compLabel: 'o mês anterior',
      unidade: 'mês' as const,
    };
  }
  // semana ISO (segunda a domingo) contendo a data
  const base = new Date(Date.UTC(y, mo - 1, d));
  const dow = base.getUTCDay(); // 0=dom
  const diffSeg = dow === 0 ? -6 : 1 - dow;
  const seg = new Date(base);
  seg.setUTCDate(base.getUTCDate() + diffSeg);
  const dom = new Date(seg);
  dom.setUTCDate(seg.getUTCDate() + 6);
  const pSeg = new Date(seg);
  pSeg.setUTCDate(seg.getUTCDate() - 7);
  const pDom = new Date(pSeg);
  pDom.setUTCDate(pSeg.getUTCDate() + 6);
  return {
    inicio: iso(seg),
    fim: iso(dom),
    prevInicio: iso(pSeg),
    prevFim: iso(pDom),
    label: `Semana de ${iso(seg).split('-').reverse().slice(0, 2).join('/')} a ${iso(dom).split('-').reverse().slice(0, 2).join('/')}`,
    compLabel: 'a semana anterior',
    unidade: 'semana' as const,
  };
}

// ---------------------------------------------------------------------------
// Motor de diagnóstico determinístico
// ---------------------------------------------------------------------------
interface Insight {
  tipo: 'positivo' | 'atencao' | 'info';
  dimensao: string;
  titulo: string;
  descricao: string;
  delta_pct?: number | null;
}

function r1(v: number) {
  return Math.round(v * 10) / 10;
}
function moeda(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function diagnosticar(
  m: Metricas,
  base: Metricas | null,
  ctx: Ctx,
  comp = 'a média das últimas 4 datas'
) {
  const insights: Insight[] = [];
  let veredito: 'bom' | 'regular' | 'ruim' = 'regular';

  if (!base) {
    insights.push({
      tipo: 'info',
      dimensao: 'baseline',
      titulo: 'Sem histórico comparável',
      descricao:
        'Não há período anterior suficiente para comparar. Indicadores mostrados sem baseline.',
    });
    return { veredito, insights };
  }

  const dFat = pct(m.faturamento, base.faturamento);
  const dPub = pct(m.publico, base.publico);
  const dTicket = pct(m.ticket, base.ticket);
  const dCart = pct(m.c_art, base.c_art);

  if (dFat !== null) {
    if (dFat >= 8) veredito = 'bom';
    else if (dFat <= -10) veredito = 'ruim';
    else veredito = 'regular';
  }

  if (dFat !== null && Math.abs(dFat) >= 8) {
    let causa = '';
    if (dFat < 0) {
      if (dPub !== null && dPub <= -8 && (dTicket === null || dTicket > -5)) {
        causa = ` Causa provável: ${r1(Math.abs(dPub))}% menos pessoas, com ticket médio estável.`;
      } else if (dTicket !== null && dTicket <= -5 && (dPub === null || dPub > -5)) {
        causa = ` Público estável, mas ticket médio caiu ${r1(Math.abs(dTicket))}%: consumo por pessoa menor.`;
      } else if (dPub !== null && dTicket !== null && dPub < 0 && dTicket < 0) {
        causa = ` Caiu nas duas pontas: ${r1(Math.abs(dPub))}% menos pessoas e ticket ${r1(Math.abs(dTicket))}% menor.`;
      }
    }
    insights.push({
      tipo: dFat >= 0 ? 'positivo' : 'atencao',
      dimensao: 'faturamento',
      titulo:
        dFat >= 0
          ? `Faturamento ${r1(dFat)}% acima`
          : `Faturamento ${r1(Math.abs(dFat))}% abaixo`,
      descricao: `${moeda(m.faturamento)} vs ${moeda(base.faturamento)} (${comp}).${causa}`,
      delta_pct: dFat,
    });
  }

  if (dPub !== null && Math.abs(dPub) >= 10) {
    insights.push({
      tipo: dPub >= 0 ? 'positivo' : 'atencao',
      dimensao: 'publico',
      titulo:
        dPub >= 0 ? `Público ${r1(dPub)}% acima` : `Público ${r1(Math.abs(dPub))}% abaixo`,
      descricao: `${Math.round(m.publico)} pessoas vs ${Math.round(base.publico)}.`,
      delta_pct: dPub,
    });
  }

  if (dTicket !== null && Math.abs(dTicket) >= 8) {
    insights.push({
      tipo: dTicket >= 0 ? 'positivo' : 'atencao',
      dimensao: 'ticket',
      titulo:
        dTicket >= 0
          ? `Ticket médio ${r1(dTicket)}% maior`
          : `Ticket médio ${r1(Math.abs(dTicket))}% menor`,
      descricao: `${moeda(m.ticket)} por pessoa vs ${moeda(base.ticket)}.`,
      delta_pct: dTicket,
    });
  }

  if (dCart !== null && m.c_art > 0 && Math.abs(dCart) >= 15) {
    insights.push({
      tipo: dCart > 0 ? 'atencao' : 'info',
      dimensao: 'custo_artistico',
      titulo:
        dCart > 0
          ? `Custo artístico ${r1(dCart)}% acima`
          : `Custo artístico ${r1(Math.abs(dCart))}% abaixo`,
      descricao: `${moeda(m.c_art)} vs ${moeda(base.c_art)} (${moeda(m.c_art - base.c_art)} de diferença).`,
      delta_pct: dCart,
    });
  }

  const percArt = m.faturamento > 0 ? (m.c_art / m.faturamento) * 100 : 0;
  if (percArt >= 20 && m.c_art > 0) {
    insights.push({
      tipo: percArt >= 30 ? 'atencao' : 'info',
      dimensao: 'percent_art_fat',
      titulo: `Atração consumiu ${r1(percArt)}% do faturamento`,
      descricao:
        percArt >= 30
          ? 'Acima do saudável: a atração comeu boa parte da receita.'
          : 'Dentro de uma faixa de atenção. Vale acompanhar o retorno da atração.',
    });
  }

  const dComida = m.percent_comida - base.percent_comida;
  const dDrink = m.percent_drink - base.percent_drink;
  const dBebida = m.percent_bebida - base.percent_bebida;
  if (Math.abs(dComida) >= 5 || Math.abs(dDrink) >= 5 || Math.abs(dBebida) >= 5) {
    const partes: string[] = [];
    if (Math.abs(dComida) >= 5) partes.push(`comida ${dComida >= 0 ? '+' : ''}${r1(dComida)}pp`);
    if (Math.abs(dDrink) >= 5) partes.push(`drinks ${dDrink >= 0 ? '+' : ''}${r1(dDrink)}pp`);
    if (Math.abs(dBebida) >= 5) partes.push(`bebidas ${dBebida >= 0 ? '+' : ''}${r1(dBebida)}pp`);
    insights.push({
      tipo: 'info',
      dimensao: 'mix',
      titulo: 'Mix de consumo mudou',
      descricao: `Em relação ao comparativo: ${partes.join(', ')}. Mix: ${r1(m.percent_comida)}% comida / ${r1(m.percent_bebida)}% bebida / ${r1(m.percent_drink)}% drink.`,
    });
  }

  if (m.percent_stockout >= 15) {
    insights.push({
      tipo: m.percent_stockout >= 25 ? 'atencao' : 'info',
      dimensao: 'stockout',
      titulo: `Stockout de ${r1(m.percent_stockout)}%`,
      descricao: `Produtos em falta podem ter limitado vendas. Bebidas ${r1(ctx.stockout_bebidas_perc)}%, comidas ${r1(ctx.stockout_comidas_perc)}%, drinks ${r1(ctx.stockout_drinks_perc)}%.`,
    });
  }

  if (m.atrasos > 0 && base.atrasos >= 0) {
    const dAtraso = pct(m.atrasos, base.atrasos);
    if (m.atrasos >= 5 && (dAtraso === null || dAtraso > 20)) {
      insights.push({
        tipo: 'atencao',
        dimensao: 'atrasos',
        titulo: `${Math.round(m.atrasos)} atrasos no atendimento`,
        descricao: `${ctx.atrasao_cozinha} na cozinha e ${ctx.atrasao_bar} no bar${
          base.atrasos > 0 ? ` (referência ${r1(base.atrasos)}).` : '.'
        } Pode ter pesado na experiência e no NPS.`,
        delta_pct: dAtraso,
      });
    }
  }

  const dResultado = pct(m.resultado, base.resultado);
  if (dResultado !== null && Math.abs(dResultado) >= 12) {
    insights.push({
      tipo: dResultado >= 0 ? 'positivo' : 'atencao',
      dimensao: 'resultado',
      titulo: `Resultado ${dResultado >= 0 ? r1(dResultado) + '% acima' : r1(Math.abs(dResultado)) + '% abaixo'}`,
      descricao: `${moeda(m.resultado)} (faturamento menos custo artístico e de produção) vs ${moeda(base.resultado)}.`,
      delta_pct: dResultado,
    });
  }

  if (!insights.length) {
    insights.push({
      tipo: 'info',
      dimensao: 'geral',
      titulo: 'Dentro do esperado',
      descricao: `Nenhum indicador se desviou de forma relevante de ${comp}.`,
    });
  }

  return { veredito, insights };
}

function deltasDe(m: Metricas, base: Metricas | null) {
  if (!base) return null;
  return Object.fromEntries(
    Object.keys(m).map((k) => [k, pct((m as any)[k], (base as any)[k])])
  );
}

// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    const barIdParam = searchParams.get('bar_id');
    const gran = (searchParams.get('gran') || 'dia') as Gran;

    if (!data || !barIdParam) {
      return NextResponse.json(
        { success: false, error: 'data e bar_id são obrigatórios' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);
    const gold = (supabase as any).schema('gold');

    // ---------------- DIA ----------------
    if (gran === 'dia') {
      const { data: eventoRows, error: eventoErr } = await gold
        .from('planejamento')
        .select(CAMPOS)
        .eq('bar_id', barId)
        .eq('data_evento', data)
        .order('id', { ascending: true });

      if (eventoErr) {
        return NextResponse.json(
          { success: false, error: 'Erro ao buscar evento', details: eventoErr.message },
          { status: 500 }
        );
      }
      const evento: Row | null = eventoRows && eventoRows.length ? eventoRows[0] : null;
      if (!evento) {
        return NextResponse.json({
          success: true,
          encontrado: false,
          gran,
          data_evento: data,
          motivo: 'Nenhum evento encontrado para esta data.',
        });
      }

      // Cortes por hora (fat/pessoas até 19h e 20h) vêm do eventos_base ao vivo —
      // o snapshot gold.planejamento ainda não carrega fat_20h/pessoas_ate_*.
      {
        const { data: cortesRows } = await (supabase as any)
          .schema('operations')
          .from('eventos_base')
          .select('fat_19h, fat_19h_percent, fat_20h, fat_20h_percent, pessoas_ate_19h, pessoas_ate_20h')
          .eq('bar_id', barId)
          .eq('data_evento', data)
          .order('id', { ascending: true })
          .limit(1);
        if (cortesRows && cortesRows.length) Object.assign(evento, cortesRows[0]);
      }

      const { data: baselineRows } = await gold
        .from('planejamento')
        .select(CAMPOS)
        .eq('bar_id', barId)
        .eq('dia_semana', evento.dia_semana)
        .eq('ativo', true)
        .lt('data_evento', data)
        .order('data_evento', { ascending: false })
        .limit(4);

      const baseline: Row[] = (baselineRows || []).filter(
        (e: Row) => faturamentoDe(e) > 0 && publicoDe(e) > 0
      );
      const baseMedia = media(baseline);
      const m = metricas(evento);

      // Eventos Yuzer/Sympla: sobrepõe o breakdown consolidado de eventos_base
      // (gold.planejamento só tem o total; entrada/couvert/bar e ticket vêm 0/errados).
      const consolidado = await lerConsolidadoEventoBase(barId, data);
      if (consolidado && (consolidado.usa_yuzer || consolidado.usa_sympla)) {
        m.faturamento = consolidado.real_r || m.faturamento;
        m.couvert = consolidado.faturamento_couvert || consolidado.faturamento_entrada;
        m.bar = consolidado.faturamento_bar || Math.max(0, m.faturamento - m.couvert);
        if (consolidado.cl_real > 0) m.publico = consolidado.cl_real;
        m.ticket =
          consolidado.t_medio > 0
            ? consolidado.t_medio
            : m.publico > 0
              ? m.faturamento / m.publico
              : 0;
        m.custo_total = m.c_art + m.c_prod;
        m.resultado = m.faturamento - m.custo_total;
        evento.faturamento_entrada = consolidado.faturamento_entrada;
        evento.faturamento_couvert = consolidado.faturamento_couvert;
        evento.faturamento_bar = consolidado.faturamento_bar;
        evento.yuzer_ingressos = consolidado.yuzer_ingressos;
        evento.yuzer_liquido = consolidado.yuzer_liquido;
        evento.sympla_liquido = consolidado.sympla_liquido;
        evento.sympla_checkins = consolidado.sympla_checkins;

        // Eco copo (indicador à parte) — vem da cesta Yuzer
        if (consolidado.usa_yuzer) {
          const { data: cestaRows } = await (supabase as any).rpc('yuzer_cesta_evento', {
            p_bar_id: barId,
            p_data: data,
          });
          const cesta = cestaRows && cestaRows.length ? (cestaRows[0] as Row) : null;
          if (cesta) {
            evento.eco_copo_valor = num(cesta.eco_copo_valor);
            evento.eco_copo_qtd = num(cesta.eco_copo_qtd);
          }
        }
      }

      // Mix de consumo: calcula da MESMA fonte do modal (evento_cesta_detalhe = ContaHub
      // por grupo + Yuzer), pra a barrinha bater 100% com o detalhe em qualquer data.
      {
        const { data: cestaDet } = await (supabase as any).rpc('evento_cesta_detalhe', {
          p_bar_id: barId,
          p_data: data,
        });
        let cC = 0, cB = 0, cD = 0;
        for (const r of (cestaDet || []) as Row[]) {
          const v = num(r.valor);
          if (r.categoria === 'comida') cC += v;
          else if (r.categoria === 'bebida') cB += v;
          else if (r.categoria === 'drink') cD += v;
        }
        const totCesta = cC + cB + cD;
        if (totCesta > 0) {
          m.percent_comida = (cC / totCesta) * 100;
          m.percent_bebida = (cB / totCesta) * 100;
          m.percent_drink = (cD / totCesta) * 100;
        }
      }

      // Consumação Artistas do dia (ContaHub: descontos motivo='Artistas')
      {
        const { data: consRows } = await (supabase as any)
          .schema('silver')
          .from('consumacao_artistas')
          .select('valor')
          .eq('bar_id', barId)
          .eq('data', data);
        evento.consumacao_artistas = (consRows || []).reduce(
          (s: number, r: Row) => s + num(r.valor), 0);
      }

      // Perfil de clientes do dia: novos x recorrentes + taxa de retorno (silver.cliente_visitas)
      let clientesPerfil: {
        total: number; novos: number; recorrentes: number;
        retorno_30d: number; retorno_60d: number; ticket_medio: number;
      } | null = null;
      {
        const { data: cpRows } = await (supabase as any).rpc('evento_clientes_perfil', {
          p_bar_id: barId, p_data: data,
        });
        const cp = Array.isArray(cpRows) ? cpRows[0] : cpRows;
        if (cp && Number(cp.total_identificados) > 0) {
          clientesPerfil = {
            total: Number(cp.total_identificados) || 0,
            novos: Number(cp.novos) || 0,
            recorrentes: Number(cp.recorrentes) || 0,
            retorno_30d: Number(cp.retornaram_30d) || 0,
            retorno_60d: Number(cp.retornaram_60d) || 0,
            ticket_medio: Number(cp.ticket_medio) || 0,
          };
        }
      }

      const deltas = deltasDe(m, baseMedia);
      const { veredito, insights } = diagnosticar(m, baseMedia, ctxDe(evento));

      const [dy, dmo, dd] = data.split('-').map(Number);
      const diaLabel = DIAS_SEMANA[new Date(Date.UTC(dy, dmo - 1, dd)).getUTCDay()];

      // Cancelamento e conta assinada DO DIA (fonte autoritativa, não do gold que vem 0)
      const [cancelDiaMapa, contaDiaMapa, planejado] = await Promise.all([
        lerCancelamentosPorDia(barId, data, data),
        lerContaAssinadaPorDia(barId, data, data),
        lerPlanoVsReal(barId, data, data),
      ]);

      return NextResponse.json({
        success: true,
        encontrado: true,
        gran,
        periodo: { inicio: data, fim: data, label: diaLabel },
        planejado,
        evento: {
          ...evento,
          cancelamentos: cancelDiaMapa[data] || 0,
          conta_assinada: contaDiaMapa[data] || 0,
          dia_semana_label: diaLabel,
          _faturamento: m.faturamento,
          _publico: m.publico,
          _couvert: m.couvert,
          _bar: m.bar,
          _ticket: m.ticket,
          _custo_total: m.custo_total,
          _resultado: m.resultado,
        },
        metricas: m,
        baseline: {
          n: baseline.length,
          media: baseMedia,
          eventos: baseline.map((e) => ({
            data_evento: e.data_evento,
            nome: e.nome || e.artista || e.nome_evento,
            ...metricas(e),
          })),
        },
        deltas,
        diagnostico: { veredito, insights },
        clientes_perfil: clientesPerfil,
      });
    }

    // ---------------- SEMANA / MÊS ----------------
    const p = periodoDe(data, gran);

    const [{ data: rowsAtual }, { data: rowsPrev }] = await Promise.all([
      gold
        .from('planejamento')
        .select(CAMPOS)
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', p.inicio)
        .lte('data_evento', p.fim)
        .order('data_evento', { ascending: true }),
      gold
        .from('planejamento')
        .select(CAMPOS)
        .eq('bar_id', barId)
        .eq('ativo', true)
        .gte('data_evento', p.prevInicio)
        .lte('data_evento', p.prevFim)
        .order('data_evento', { ascending: true }),
    ]);

    const eventosAtual: Row[] = (rowsAtual || []).filter((e: Row) => faturamentoDe(e) > 0);
    const eventosPrev: Row[] = (rowsPrev || []).filter((e: Row) => faturamentoDe(e) > 0);

    if (!eventosAtual.length) {
      return NextResponse.json({
        success: true,
        encontrado: false,
        gran,
        periodo: { inicio: p.inicio, fim: p.fim, label: p.label },
        motivo: `Nenhum evento com movimento entre ${p.inicio} e ${p.fim}.`,
      });
    }

    // Fonte canônica: gold.desempenho (mensal/semanal). Cai pra agregação do
    // planejamento só se a linha de desempenho ainda não existir (período em aberto).
    const [despAtual, despPrev] = await Promise.all([
      lerDesempenho(barId, gran, p.inicio),
      lerDesempenho(barId, gran, p.prevInicio),
    ]);

    let m: Metricas;
    let ctx: Ctx;
    let extras: Row;
    let baseMedia: Metricas | null;
    let nps: Row | null = null;
    let fonte: string;

    if (despAtual) {
      const a = fromDesempenho(despAtual);
      m = a.m;
      ctx = a.ctx;
      extras = a.extras;
      nps = a.nps;
      baseMedia = despPrev ? fromDesempenho(despPrev).m : null;
      fonte = 'gold.desempenho';
    } else {
      const a = agregar(eventosAtual);
      m = a.m;
      ctx = a.ctx;
      extras = a.extras;
      baseMedia = eventosPrev.length ? agregar(eventosPrev).m : null;
      fonte = 'gold.planejamento (período em aberto)';
    }

    // c_art/c_prod do período = 100% conforme Conta Azul (split que o desempenho não tem)
    const caAtual = await custosCA(barId, p.inicio, p.fim);
    m.c_art = caAtual.c_art;
    m.c_prod = caAtual.c_prod;
    m.custo_total = m.c_art + m.c_prod;
    m.resultado = m.faturamento - m.custo_total;
    extras.c_art = caAtual.c_art;
    extras.c_prod = caAtual.c_prod;
    if (baseMedia) {
      const caPrev = await custosCA(barId, p.prevInicio, p.prevFim);
      baseMedia.c_art = caPrev.c_art;
      baseMedia.c_prod = caPrev.c_prod;
      baseMedia.custo_total = caPrev.c_art + caPrev.c_prod;
      baseMedia.resultado = baseMedia.faturamento - baseMedia.custo_total;
    }

    const deltas = deltasDe(m, baseMedia);
    const { veredito, insights } = diagnosticar(m, baseMedia, ctx, p.compLabel);
    const [npsDiario, cancelMapa, contaMapa, planejado] = await Promise.all([
      lerNpsDiario(barId, p.inicio, p.fim),
      lerCancelamentosPorDia(barId, p.inicio, p.fim),
      lerContaAssinadaPorDia(barId, p.inicio, p.fim),
      lerPlanoVsReal(barId, p.inicio, p.fim),
    ]);
    // cancelamento/conta assinada do PERÍODO inteiro, da fonte autoritativa
    extras.cancelamentos = somaMapa(cancelMapa);
    extras.conta_assinada = somaMapa(contaMapa);

    return NextResponse.json({
      success: true,
      encontrado: true,
      gran,
      fonte,
      periodo: { inicio: p.inicio, fim: p.fim, label: p.label },
      planejado,
      evento: {
        ...extras,
        dia_semana_label: p.label,
        nome: `${eventosAtual.length} eventos`,
        artista: `${eventosAtual.length} eventos no período`,
        genero: null,
        observacoes: null,
        _faturamento: m.faturamento,
        _publico: m.publico,
        _couvert: m.couvert,
        _bar: m.bar,
        _ticket: m.ticket,
        _custo_total: m.custo_total,
        _resultado: m.resultado,
      },
      metricas: m,
      nps,
      nps_diario: npsDiario,
      baseline: {
        n: baseMedia ? 1 : 0,
        media: baseMedia,
        // série = eventos DO período (para visualizar como cada evento foi)
        eventos: eventosAtual.map((e) => ({
          data_evento: e.data_evento,
          nome: e.nome || e.artista || e.nome_evento,
          ...metricas(e),
          cancelamentos: cancelMapa[e.data_evento] || 0,
          conta_assinada: contaMapa[e.data_evento] || 0,
        })),
      },
      deltas,
      diagnostico: { veredito, insights },
    });
  } catch (error) {
    console.error('❌ Erro na API de evento:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'desconhecido',
      },
      { status: 500 }
    );
  }
}
