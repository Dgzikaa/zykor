import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * CMV Teórico do cardápio (gold.produto_cmv): custo da ficha (último preço) × preço de venda (CH).
 * GET ?bar_id → lista + Δ vs o snapshot anterior (gold.produto_cmv_historico).
 * POST { action:'recalcular' } → roda gold.fn_cmv_teorico + grava snapshot do dia.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const admin = await getAdminClient();
  const gold = (admin as any).schema('gold');

  // MODO PERÍODO: ?ini&fim → CMV teórico ponderado pelas vendas do período (por produto + por categoria)
  const sp = new URL(request.url).searchParams;
  const ini = sp.get('ini'); const fim = sp.get('fim');

  // MODO COMPARATIVO: ?comparativo=1&ini&fim&gran=semana|mes → CMV teórico por categoria, período atual × anterior.
  // custo é o atual (produto_cmv) nos dois → a variação isola o efeito MIX/volume (preço congelado).
  if (sp.get('comparativo') === '1' && ini && fim) {
    const num = (v: any) => Number(v || 0);
    const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const gran = sp.get('gran') || 'semana';
    const di = new Date(ini + 'T00:00:00'); const df = new Date(fim + 'T00:00:00');
    let pIni: Date, pFim: Date;
    if (gran === 'mes') { pIni = new Date(di.getFullYear(), di.getMonth() - 1, 1); pFim = new Date(di.getFullYear(), di.getMonth(), 0); }
    else { const dias = Math.round((df.getTime() - di.getTime()) / 86400000) + 1; pIni = new Date(di); pIni.setDate(di.getDate() - dias); pFim = new Date(df); pFim.setDate(df.getDate() - dias); }
    const pi = isoD(pIni), pf = isoD(pFim);
    // 3 cenários para decompor a variação do CMV (Laspeyres): preço × mix × intramix.
    //  Q1P1 = vendas atuais × preço atual (real atual) · Q1P0 = vendas atuais × preço antigo (congela preço)
    //  Q0P0 = vendas antigas × preço antigo (real anterior). p_ref = fim do período = "preço daquele período".
    const cenario = async (i: string, f: string, ref: string) => {
      const { data } = await gold.rpc('fn_cmv_teorico_periodo_preco', { p_bar: barId, p_ini: i, p_fim: f, p_ref: ref });
      return (data || []) as any[];
    };
    const q1p1 = await cenario(ini, fim, fim);
    const q1p0 = await cenario(ini, fim, pf);
    const q0p0 = await cenario(pi, pf, pf);
    const pack = (rows: any[], i: string, f: string) => {
      const fat = rows.reduce((s, r) => s + num(r.faturamento), 0);
      const custo = rows.reduce((s, r) => s + num(r.custo_total), 0);
      const categorias = rows.map((r: any) => ({ categoria: r.categoria, faturamento: num(r.faturamento), custo_total: num(r.custo_total), cmv_pct: r.cmv_pct == null ? null : num(r.cmv_pct) })).sort((a, b) => b.faturamento - a.faturamento);
      return { ini: i, fim: f, faturamento: Number(fat.toFixed(2)), custo_total: Number(custo.toFixed(2)), cmv_pct: fat > 0 ? Number((custo / fat * 100).toFixed(2)) : null, categorias };
    };
    const atual = pack(q1p1, ini, fim), anterior = pack(q0p0, pi, pf), congeladoPreco = pack(q1p0, ini, fim);
    // decomposição (em pontos percentuais)
    const cmv = (p: any) => p.cmv_pct ?? 0;
    const byCat = (rows: any[]) => { const m = new Map<string, any>(); for (const r of rows) m.set(r.categoria, { fat: num(r.faturamento), custo: num(r.custo_total) }); return m; };
    const m0 = byCat(q0p0), m1 = byCat(q1p0);
    const fat0 = anterior.faturamento, fat1 = congeladoPreco.faturamento;
    let mixFrac = 0, intraFrac = 0;
    for (const k of new Set([...m0.keys(), ...m1.keys()])) {
      const f0 = m0.get(k)?.fat || 0, c0 = m0.get(k)?.custo || 0;
      const f1 = m1.get(k)?.fat || 0, c1 = m1.get(k)?.custo || 0;
      const sh0 = fat0 > 0 ? f0 / fat0 : 0, sh1 = fat1 > 0 ? f1 / fat1 : 0;
      const cmv0 = f0 > 0 ? c0 / f0 : 0, cmv1 = f1 > 0 ? c1 / f1 : 0;
      mixFrac += (sh1 - sh0) * cmv0;        // troca de proporção ENTRE categorias
      intraFrac += sh1 * (cmv1 - cmv0);     // troca de composição DENTRO da categoria
    }
    const r2 = (v: number) => Number(v.toFixed(2));
    const decomposicao = {
      cmv_atual: atual.cmv_pct, cmv_anterior: anterior.cmv_pct,
      delta: atual.cmv_pct != null && anterior.cmv_pct != null ? r2(atual.cmv_pct - anterior.cmv_pct) : null,
      efeito_preco: r2(cmv(atual) - cmv(congeladoPreco)),
      efeito_mix: r2(mixFrac * 100),
      efeito_intramix: r2(intraFrac * 100),
    };
    return NextResponse.json({ success: true, modo: 'comparativo', gran, atual, anterior, decomposicao });
  }

  if (ini && fim) {
    const { data: rows, error: errP } = await gold.rpc('fn_cmv_teorico_periodo', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    if (errP) return NextResponse.json({ success: false, error: errP.message }, { status: 500 });
    const lista = (rows || []) as any[];
    const num = (v: any) => Number(v || 0);
    // categoria canônica pelo prefixo do código (b/d/c/o) — blinda contra drift de caixa/null
    // na origem (ex.: 'drink' vs 'Drink', ou categoria nula em itens 'o') que separava o relatório.
    const catDe = (r: any) => {
      const c = (r.codigo || '')[0]?.toLowerCase();
      return c === 'b' ? 'Bebida' : c === 'd' ? 'Drink' : c === 'c' ? 'Comida' : c === 'o' ? 'Outros' : (r.categoria || '—');
    };
    for (const r of lista) r.categoria = catDe(r);
    const fat = lista.reduce((s, r) => s + num(r.faturamento), 0);
    const custo = lista.reduce((s, r) => s + num(r.custo_total), 0);
    const qtdCortesia = lista.reduce((s, r) => s + Math.max(num(r.qtd_consumo) - num(r.qtd), 0), 0);
    const custoCortesia = lista.reduce((s, r) => s + Math.max(num(r.qtd_consumo) - num(r.qtd), 0) * num(r.custo_unit), 0);
    // custo não entra no CMV em 2 casos distintos:
    //  - SEM FICHA: produto sem ficha técnica (itens_ficha = 0) → precisa cadastrar receita
    //  - FICHA SEM PREÇO: tem ficha, mas insumo sem preço (custo 0) → precisa precificar o insumo (caso "item R$0")
    const semFicha = lista.filter((r: any) => num(r.itens_ficha) === 0);
    const fichaSemPreco = lista.filter((r: any) => num(r.itens_ficha) > 0 && (!r.custo_unit || num(r.custo_unit) === 0));
    const fatSum = (arr: any[]) => Number(arr.reduce((s: number, r: any) => s + num(r.faturamento), 0).toFixed(2));
    const semCustoFat = fatSum([...semFicha, ...fichaSemPreco]); // total fora do custo (cobertura)
    const headline = {
      faturamento: fat, custo_total: custo, margem: fat - custo,
      cmv_pct: fat > 0 ? Number((custo / fat * 100).toFixed(2)) : null,
      n_produtos: lista.length, qtd: lista.reduce((s, r) => s + num(r.qtd), 0),
      qtd_cortesia: qtdCortesia, custo_cortesia: Number(custoCortesia.toFixed(2)),
      sem_ficha_n: semFicha.length,
      sem_ficha_fat: fatSum(semFicha),
      ficha_sem_preco_n: fichaSemPreco.length,
      ficha_sem_preco_fat: fatSum(fichaSemPreco),
      cobertura_pct: fat > 0 ? Number(((fat - semCustoFat) / fat * 100).toFixed(1)) : null,
    };
    const catMap = new Map<string, any>();
    for (const r of lista) {
      const k = r.categoria || '—';
      const c = catMap.get(k) || { categoria: k, faturamento: 0, custo_total: 0, qtd: 0, itens: 0 };
      c.faturamento += num(r.faturamento); c.custo_total += num(r.custo_total); c.qtd += num(r.qtd); c.itens += 1;
      catMap.set(k, c);
    }
    const categorias = Array.from(catMap.values()).map((c: any) => ({
      ...c, margem: c.faturamento - c.custo_total,
      cmv_pct: c.faturamento > 0 ? Number((c.custo_total / c.faturamento * 100).toFixed(2)) : null,
    })).sort((a, b) => b.faturamento - a.faturamento);
    // dias de operação Yuzer no período (fonte da verdade = eventos_base.usa_yuzer) — indica que o CMV usa preço Yuzer nesses dias
    const { data: evtRows } = await (admin as any).schema('operations').from('eventos_base')
      .select('data_evento').eq('bar_id', barId).eq('usa_yuzer', true).gte('data_evento', ini).lte('data_evento', fim);
    (headline as any).dias_yuzer = Array.from(new Set((evtRows || []).map((r: any) => r.data_evento))).sort();

    // produtos vendidos no ContaHub FORA do de-para (sem código interno → invisíveis no CMV)
    const { data: foraDp } = await gold.rpc('fn_vendido_fora_depara', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    const foraLista = (foraDp || []) as any[];
    (headline as any).fora_depara_n = foraLista.length;
    (headline as any).fora_depara_fat = Number(foraLista.reduce((s: number, r: any) => s + num(r.valor), 0).toFixed(2));

    // comparativo Mix × Compras vs o período anterior (dia→ontem, semana→sem. anterior, mês→mês anterior)
    const gran = sp.get('gran') || 'dia';
    const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const di = new Date(ini + 'T00:00:00'); const df = new Date(fim + 'T00:00:00');
    let pIni: Date, pFim: Date;
    if (gran === 'mes') { pIni = new Date(di.getFullYear(), di.getMonth() - 1, 1); pFim = new Date(di.getFullYear(), di.getMonth(), 0); }
    else { const dias = Math.round((df.getTime() - di.getTime()) / 86400000) + 1; pIni = new Date(di); pIni.setDate(di.getDate() - dias); pFim = new Date(df); pFim.setDate(df.getDate() - dias); }
    const { data: cmp } = await gold.rpc('fn_cmv_teorico_comparativo', { p_bar: barId, p_ini: ini, p_fim: fim, p_ini_ant: isoD(pIni), p_fim_ant: isoD(pFim) });
    if (cmp && cmp[0]) (headline as any).comparativo = { ...cmp[0], gran, ini_ant: isoD(pIni), fim_ant: isoD(pFim) };

    return NextResponse.json({ success: true, modo: 'periodo', headline, categorias, produtos: lista, fora_depara: foraLista });
  }

  // MODO TEÓRICO × REAL: ?vs_real=ano → compara nosso CMV teórico (fichas×vendas) com o CMV real (financial.cmv_mensal)
  const vsReal = sp.get('vs_real');
  if (vsReal) {
    const { data: meses, error: errV } = await gold.rpc('fn_cmv_teorico_vs_real', { p_bar_id: barId, p_ano: Number(vsReal) });
    if (errV) return NextResponse.json({ success: false, error: errV.message }, { status: 500 });
    return NextResponse.json({ success: true, modo: 'vs_real', meses: meses || [] });
  }

  const { data, error } = await gold.from('produto_cmv').select('*').eq('bar_id', barId).order('cmv_pct', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // snapshot anterior (data_ref mais recente antes de hoje) p/ comparativo
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: datasHist } = await gold.from('produto_cmv_historico').select('data_ref').eq('bar_id', barId).lt('data_ref', hoje).order('data_ref', { ascending: false }).limit(1);
  const dataAnterior = datasHist?.[0]?.data_ref || null;
  const prevMap = new Map<number, any>();
  if (dataAnterior) {
    const { data: prev } = await gold.from('produto_cmv_historico').select('produto_id, custo, preco_venda, cmv_pct').eq('bar_id', barId).eq('data_ref', dataAnterior);
    (prev || []).forEach((p: any) => prevMap.set(p.produto_id, p));
  }

  const produtos = (data || []).map((p: any) => {
    const prev = prevMap.get(p.produto_id);
    return {
      ...p,
      cmv_pct_anterior: prev?.cmv_pct ?? null,
      delta_cmv: (prev?.cmv_pct != null && p.cmv_pct != null) ? Number((p.cmv_pct - prev.cmv_pct).toFixed(2)) : null,
    };
  });
  return NextResponse.json({ success: true, produtos, data_anterior: dataAnterior });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  if (body.action !== 'recalcular') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
  const admin = await getAdminClient();
  const gold = (admin as any).schema('gold');

  const { error } = await gold.rpc('fn_cmv_teorico', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // snapshot do dia (atualiza se já existir)
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: atual } = await gold.from('produto_cmv').select('produto_id, codigo, nome, custo, preco_venda, cmv_pct').eq('bar_id', barId);
  if (atual?.length) {
    await gold.from('produto_cmv_historico').upsert(
      atual.map((p: any) => ({ bar_id: barId, produto_id: p.produto_id, data_ref: hoje, codigo: p.codigo, nome: p.nome, custo: p.custo, preco_venda: p.preco_venda, cmv_pct: p.cmv_pct })),
      { onConflict: 'bar_id,produto_id,data_ref' },
    );
  }
  return NextResponse.json({ success: true });
}
