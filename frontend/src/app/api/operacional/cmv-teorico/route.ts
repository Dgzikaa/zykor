import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { paginate } from '@/lib/supabase/paginate';

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
    const ddmm = (s: string) => s.split('-').reverse().slice(0, 2).join('/');
    const gran = sp.get('gran') || 'semana';
    // período B = comparado. Explícito (?pini&pfim, escolhido pelo usuário) ou derivado (imediatamente anterior).
    let pi = sp.get('pini') || '', pf = sp.get('pfim') || '';
    if (!pi || !pf) {
      const di = new Date(ini + 'T00:00:00'); const df = new Date(fim + 'T00:00:00');
      let pIni: Date, pFim: Date;
      if (gran === 'mes') { pIni = new Date(di.getFullYear(), di.getMonth() - 1, 1); pFim = new Date(di.getFullYear(), di.getMonth(), 0); }
      else { const dias = Math.round((df.getTime() - di.getTime()) / 86400000) + 1; pIni = new Date(di); pIni.setDate(di.getDate() - dias); pFim = new Date(df); pFim.setDate(df.getDate() - dias); }
      pi = isoD(pIni); pf = isoD(pFim);
    }
    // 3 cenários POR PRODUTO (1 função só): A@precoA, A@precoB (congela preço = efeito mix), B@precoB.
    const prod = async (i: string, f: string, ref: string) => {
      const { data } = await gold.rpc('fn_cmv_teorico_produto_preco', { p_bar: barId, p_ini: i, p_fim: f, p_ref: ref });
      return (data || []) as any[];
    };
    const P11 = await prod(ini, fim, fim);   // período A, preço A
    const P10 = await prod(ini, fim, pf);    // período A, preço B → CMV de A com preço de B (efeito mix)
    const P00 = await prod(pi, pf, pf);      // período B, preço B
    const ct = (r: any) => num(r.qtd) * num(r.custo_unit);
    const catAgg = (rows: any[]) => {
      const m = new Map<string, any>(); let fat = 0, custo = 0;
      for (const r of rows) { const c = ct(r); fat += num(r.faturamento); custo += c; const e = m.get(r.categoria) || { categoria: r.categoria, faturamento: 0, custo_total: 0 }; e.faturamento += num(r.faturamento); e.custo_total += c; m.set(r.categoria, e); }
      const categorias = Array.from(m.values()).map((c: any) => ({ ...c, faturamento: Number(c.faturamento.toFixed(2)), custo_total: Number(c.custo_total.toFixed(2)), cmv_pct: c.faturamento > 0 ? Number((c.custo_total / c.faturamento * 100).toFixed(2)) : null })).sort((a, b) => b.faturamento - a.faturamento);
      return { faturamento: Number(fat.toFixed(2)), custo_total: Number(custo.toFixed(2)), cmv_pct: fat > 0 ? Number((custo / fat * 100).toFixed(2)) : null, categorias };
    };
    const A = catAgg(P11), B = catAgg(P00), Acong = catAgg(P10);
    const atual = { ini, fim, ...A }, anterior = { ini: pi, fim: pf, ...B };
    const r2 = (v: number) => Number(v.toFixed(2));
    const cmv = (p: any) => p.cmv_pct ?? 0;
    // decomposição: mix (entre categorias) + intramix (dentro) usando preço B; preço = A − Acong.
    const byCat = (agg: any) => { const m = new Map<string, any>(); for (const c of agg.categorias) m.set(c.categoria, { fat: c.faturamento, custo: c.custo_total }); return m; };
    const m0 = byCat(B), m1 = byCat(Acong);
    const fat0 = B.faturamento, fat1 = Acong.faturamento;
    let mixFrac = 0, intraFrac = 0;
    for (const k of new Set([...m0.keys(), ...m1.keys()])) {
      const f0 = m0.get(k)?.fat || 0, c0 = m0.get(k)?.custo || 0, f1 = m1.get(k)?.fat || 0, c1 = m1.get(k)?.custo || 0;
      const sh0 = fat0 > 0 ? f0 / fat0 : 0, sh1 = fat1 > 0 ? f1 / fat1 : 0, cmv0 = f0 > 0 ? c0 / f0 : 0, cmv1 = f1 > 0 ? c1 / f1 : 0;
      mixFrac += (sh1 - sh0) * cmv0; intraFrac += sh1 * (cmv1 - cmv0);
    }
    const decomposicao = {
      cmv_atual: A.cmv_pct, cmv_anterior: B.cmv_pct,
      delta: A.cmv_pct != null && B.cmv_pct != null ? r2(A.cmv_pct - B.cmv_pct) : null,
      efeito_preco: r2(cmv(A) - cmv(Acong)), efeito_mix: r2(mixFrac * 100), efeito_intramix: r2(intraFrac * 100),
    };
    // drill por produto (reusa os 3 cenários)
    const idx = (rows: any[]) => { const m = new Map<string, any>(); for (const r of rows) m.set(r.codigo, r); return m; };
    const m11 = idx(P11), m10 = idx(P10), m00 = idx(P00);
    const drivers: any[] = [];
    for (const cod of new Set([...m11.keys(), ...m00.keys()])) {
      const a = m11.get(cod), a0 = m10.get(cod), b = m00.get(cod);
      const pv1 = num(a?.preco_venda), pv0 = num(b?.preco_venda);
      const share1 = A.faturamento > 0 ? num(a?.faturamento) / A.faturamento : 0, share0 = B.faturamento > 0 ? num(b?.faturamento) / B.faturamento : 0;
      const cmv1 = pv1 > 0 ? num(a?.custo_unit) / pv1 : 0, cmv1p0 = pv1 > 0 ? num(a0?.custo_unit) / pv1 : 0, cmv0 = pv0 > 0 ? num(b?.custo_unit) / pv0 : 0;
      const preco = share1 * (cmv1 - cmv1p0) * 100, volume = (share1 - share0) * cmv0 * 100;
      if (Math.abs(preco) > 0.005 || Math.abs(volume) > 0.005) drivers.push({ codigo: cod, nome: a?.nome || b?.nome || cod, categoria: a?.categoria || b?.categoria || '—', preco: r2(preco), volume: r2(volume) });
    }
    const topVolume = [...drivers].sort((x, y) => Math.abs(y.volume) - Math.abs(x.volume)).slice(0, 8);
    const topPreco = [...drivers].sort((x, y) => Math.abs(y.preco) - Math.abs(x.preco)).slice(0, 8);
    const ppTxt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}pp`;
    const efs = [{ k: 'preço', v: decomposicao.efeito_preco, list: topPreco, campo: 'preco' }, { k: 'mix', v: decomposicao.efeito_mix, list: topVolume, campo: 'volume' }, { k: 'intramix', v: decomposicao.efeito_intramix, list: topVolume, campo: 'volume' }];
    const dom = [...efs].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
    const subiu = (decomposicao.delta ?? 0) >= 0;
    let narrativa = `CMV ${subiu ? 'subiu' : 'caiu'} ${ppTxt(decomposicao.delta ?? 0)} (${ddmm(ini)} vs ${ddmm(pi)}) — efeito dominante: ${dom.k} (${ppTxt(dom.v)}).`;
    const topItem = dom.list.filter((d: any) => Math.sign(d[dom.campo]) === Math.sign(dom.v))[0];
    if (topItem) narrativa += ` Maior item: ${topItem.nome}${topItem.categoria ? ` (${topItem.categoria})` : ''} ${ppTxt(topItem[dom.campo])}.`;

    return NextResponse.json({ success: true, modo: 'comparativo', gran, atual, anterior, decomposicao, drivers: { volume: topVolume, preco: topPreco }, narrativa });
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
    // SEM FICHA (itens_ficha = 0): NÃO entra no CMV — nem faturamento, nem custo.
    // Sem receita cadastrada o custo seria 0 e só diluiria o CMV pra baixo; então
    // fica FORA da base. Continua no aviso e na tabela de produtos (p/ cadastrar).
    const semFicha = lista.filter((r: any) => num(r.itens_ficha) === 0);
    // FICHA SEM PREÇO: tem receita, mas insumo sem preço (custo 0). CONTINUA na base
    // (é precificável) — entra sem custo ainda, medido pela cobertura.
    const fichaSemPreco = lista.filter((r: any) => num(r.itens_ficha) > 0 && (!r.custo_unit || num(r.custo_unit) === 0));
    // base efetivamente considerada no CMV = produtos COM ficha técnica
    const considerados = lista.filter((r: any) => num(r.itens_ficha) > 0);

    const fat = considerados.reduce((s, r) => s + num(r.faturamento), 0);
    const custo = considerados.reduce((s, r) => s + num(r.custo_total), 0);
    const qtdCortesia = considerados.reduce((s, r) => s + Math.max(num(r.qtd_consumo) - num(r.qtd), 0), 0);
    const custoCortesia = considerados.reduce((s, r) => s + Math.max(num(r.qtd_consumo) - num(r.qtd), 0) * num(r.custo_unit), 0);
    const fatSum = (arr: any[]) => Number(arr.reduce((s: number, r: any) => s + num(r.faturamento), 0).toFixed(2));
    const fichaSemPrecoFat = fatSum(fichaSemPreco); // dentro da base, mas sem custo (cobertura)
    const headline = {
      faturamento: fat, custo_total: custo, margem: fat - custo,
      cmv_pct: fat > 0 ? Number((custo / fat * 100).toFixed(2)) : null,
      n_produtos: considerados.length, qtd: considerados.reduce((s, r) => s + num(r.qtd), 0),
      qtd_cortesia: qtdCortesia, custo_cortesia: Number(custoCortesia.toFixed(2)),
      sem_ficha_n: semFicha.length,
      sem_ficha_fat: fatSum(semFicha),
      ficha_sem_preco_n: fichaSemPreco.length,
      ficha_sem_preco_fat: fichaSemPrecoFat,
      cobertura_pct: fat > 0 ? Number(((fat - fichaSemPrecoFat) / fat * 100).toFixed(1)) : null,
    };
    const catMap = new Map<string, any>();
    for (const r of considerados) {
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

    // produtos vendidos no ContaHub SEM código interno / ficha técnica → invisíveis no CMV.
    // fn_depara_sugestoes = mesma lista, já com a sugestão de vínculo por nome (prefixo respeitado).
    const { data: foraDp } = await gold.rpc('fn_depara_sugestoes', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    const foraLista = (foraDp || []) as any[];
    (headline as any).fora_depara_n = foraLista.length;
    (headline as any).fora_depara_fat = Number(foraLista.reduce((s: number, r: any) => s + num(r.valor), 0).toFixed(2));

    // Mesmo aviso pra Yuzer: produtos vendidos no Yuzer sem mapeamento em produto_yuzer_map.
    const { data: foraYz } = await gold.rpc('fn_yuzer_sem_mapeamento', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    const foraYzLista = (foraYz || []) as any[];
    (headline as any).fora_yuzer_n = foraYzLista.length;
    (headline as any).fora_yuzer_fat = Number(foraYzLista.reduce((s: number, r: any) => s + num(r.valor), 0).toFixed(2));

    // comparativo Mix × Compras vs o período anterior (dia→ontem, semana→sem. anterior, mês→mês anterior)
    const gran = sp.get('gran') || 'dia';
    const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const di = new Date(ini + 'T00:00:00'); const df = new Date(fim + 'T00:00:00');
    let pIni: Date, pFim: Date;
    if (gran === 'mes') { pIni = new Date(di.getFullYear(), di.getMonth() - 1, 1); pFim = new Date(di.getFullYear(), di.getMonth(), 0); }
    else { const dias = Math.round((df.getTime() - di.getTime()) / 86400000) + 1; pIni = new Date(di); pIni.setDate(di.getDate() - dias); pFim = new Date(df); pFim.setDate(df.getDate() - dias); }
    const { data: cmp } = await gold.rpc('fn_cmv_teorico_comparativo', { p_bar: barId, p_ini: ini, p_fim: fim, p_ini_ant: isoD(pIni), p_fim_ant: isoD(pFim) });
    if (cmp && cmp[0]) (headline as any).comparativo = { ...cmp[0], gran, ini_ant: isoD(pIni), fim_ant: isoD(pFim) };

    // ORIGENS por produto: a saída do período quebrada por CÓDIGO de origem (ContaHub prd +
    // Yuzer cod_yuzer). Reconcilia com `lista` por (codigo, fonte). Permite expandir o produto
    // na tabela e ver qtd/preço/custo/CMV de cada código separadamente (igual à aba Cardápio).
    const { data: origemRows } = await gold.rpc('fn_cmv_teorico_periodo_origem', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    const origens = ((origemRows || []) as any[]).map((o: any) => {
      const qtd = num(o.qtd), valor = num(o.valor), cu = o.custo_unit == null ? null : num(o.custo_unit);
      const custoTotal = cu == null ? null : Number((qtd * cu).toFixed(2));
      return {
        codigo: o.codigo, fonte: o.fonte, cod_origem: o.cod_origem, nome_origem: o.nome_origem,
        qtd, faturamento: Number(valor.toFixed(2)), custo_unit: cu,
        preco_efetivo: qtd > 0 ? Number((valor / qtd).toFixed(2)) : null,
        custo_total: custoTotal,
        margem: custoTotal == null ? null : Number((valor - custoTotal).toFixed(2)),
        cmv_pct: (custoTotal != null && valor > 0) ? Number((custoTotal / valor * 100).toFixed(2)) : null,
      };
    }).sort((a, b) => b.faturamento - a.faturamento);

    return NextResponse.json({ success: true, modo: 'periodo', headline, categorias, produtos: lista, origens, fora_depara: foraLista, fora_yuzer: foraYzLista });
  }

  // MODO TEÓRICO × REAL: ?vs_real=ano → compara nosso CMV teórico (fichas×vendas) com o CMV real (financial.cmv_mensal)
  const vsReal = sp.get('vs_real');
  if (vsReal) {
    const { data: meses, error: errV } = await gold.rpc('fn_cmv_teorico_vs_real', { p_bar_id: barId, p_ano: Number(vsReal) });
    if (errV) return NextResponse.json({ success: false, error: errV.message }, { status: 500 });
    return NextResponse.json({ success: true, modo: 'vs_real', meses: meses || [] });
  }

  const data = await paginate<any>(
    () => gold.from('produto_cmv').select('*').eq('bar_id', barId).order('cmv_pct', { ascending: false, nullsFirst: false }).order('codigo'),
    { label: 'gold.produto_cmv' },
  );

  // snapshot anterior (data_ref mais recente antes de hoje) p/ comparativo
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: datasHist } = await gold.from('produto_cmv_historico').select('data_ref').eq('bar_id', barId).lt('data_ref', hoje).order('data_ref', { ascending: false }).limit(1);
  const dataAnterior = datasHist?.[0]?.data_ref || null;
  const prevMap = new Map<number, any>();
  if (dataAnterior) {
    const { data: prev } = await gold.from('produto_cmv_historico').select('produto_id, custo, preco_venda, cmv_pct').eq('bar_id', barId).eq('data_ref', dataAnterior);
    (prev || []).forEach((p: any) => prevMap.set(p.produto_id, p));
  }

  // ---- Origens do produto: cada código ContaHub (prd/prd_desc) e Yuzer (cod_yuzer/nome) que
  // aponta pro mesmo cod_interno, com preço e CMV próprios (CH = preço do mapa; Yuzer = preço
  // efetivo da view gold.produto_preco_yuzer). O custo é o da ficha do produto (único). Assim o
  // Cardápio expande o produto interno mostrando o NOME CRU de cada origem, sem eleger 1 preço.
  const [chMaps, yzMaps] = await Promise.all([
    paginate<any>(() => admin.from('produto_contahub_map').select('cod_interno, prd, prd_desc, preco_venda').eq('bar_id', barId).order('prd'), { label: 'produto_contahub_map' }),
    paginate<any>(() => admin.from('produto_yuzer_map').select('cod_interno, cod_yuzer, nome').eq('bar_id', barId).order('cod_yuzer'), { label: 'produto_yuzer_map' }),
  ]);
  const { data: yzPrecos } = await gold.from('produto_preco_yuzer').select('cod_interno, preco_yuzer').eq('bar_id', barId);
  const precoYzByCod = new Map<string, number>((yzPrecos || []).map((r: any) => [r.cod_interno, Number(r.preco_yuzer)]));
  const chByCod = new Map<string, any[]>();
  for (const m of chMaps) { const a = chByCod.get(m.cod_interno) || []; a.push(m); chByCod.set(m.cod_interno, a); }
  const yzByCod = new Map<string, any[]>();
  for (const m of yzMaps) { const a = yzByCod.get(m.cod_interno) || []; a.push(m); yzByCod.set(m.cod_interno, a); }
  const r2 = (v: number) => Number(v.toFixed(2));
  const mkOrigem = (tipo: 'ch' | 'yuzer', codigo: any, nome: any, preco: any, custo: any) => {
    const p = preco != null && Number(preco) > 0 ? Number(preco) : null;
    const c = custo != null ? Number(custo) : null;
    return {
      tipo, codigo: String(codigo ?? ''), nome: nome || null, preco: p,
      cmv_pct: (p != null && c != null) ? r2(c / p * 100) : null,
      margem: (p != null && c != null) ? r2(p - c) : null,
    };
  };

  const produtos = data.map((p: any) => {
    const prev = prevMap.get(p.produto_id);
    const ch = (chByCod.get(p.codigo) || []).map((m: any) => mkOrigem('ch', m.prd, m.prd_desc, m.preco_venda, p.custo));
    const yz = (yzByCod.get(p.codigo) || []).map((m: any) => mkOrigem('yuzer', m.cod_yuzer, m.nome, precoYzByCod.get(p.codigo) ?? null, p.custo));
    return {
      ...p,
      cmv_pct_anterior: prev?.cmv_pct ?? null,
      delta_cmv: (prev?.cmv_pct != null && p.cmv_pct != null) ? Number((p.cmv_pct - prev.cmv_pct).toFixed(2)) : null,
      origens: [...ch, ...yz],
      n_ch: ch.length,
      n_yuzer: yz.length,
      tem_yuzer: yz.length > 0,
    };
  });
  return NextResponse.json({ success: true, produtos, data_anterior: dataAnterior });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const admin = await getAdminClient();
  const gold = (admin as any).schema('gold');

  // ----- VINCULAR de-para: mapeia prd(ContaHub) → cod_interno e refresca na hora -----
  // (a lista "fora do de-para" lê o matview silver.vendas_produto_dia; sem refresh o
  //  item só sumiria no cron horário — por isso refrescamos aqui).
  if (body.action === 'vincular_depara') {
    const pares = (Array.isArray(body.pares) ? body.pares : [])
      .map((p: any) => ({ prd: Number(p.prd), cod_interno: String(p.cod_interno || '').trim() }))
      .filter((p: any) => Number.isFinite(p.prd) && p.prd > 0 && p.cod_interno);
    if (!pares.length) return NextResponse.json({ success: false, error: 'nenhum par (prd → código) válido' }, { status: 400 });
    // valida que os códigos existem no cardápio do bar (não criar fantasma)
    const codigos = Array.from(new Set(pares.map((p: any) => p.cod_interno)));
    const { data: existe } = await admin.from('produto_cardapio').select('codigo').eq('bar_id', barId).in('codigo', codigos);
    const okCod = new Set((existe || []).map((r: any) => r.codigo));
    const invalidos = pares.filter((p: any) => !okCod.has(p.cod_interno));
    if (invalidos.length) return NextResponse.json({ success: false, error: `código(s) inexistente(s) no cardápio: ${invalidos.map((p: any) => p.cod_interno).join(', ')}` }, { status: 400 });
    for (const p of pares) {
      const { error } = await admin.from('produto_contahub_map').upsert({ bar_id: barId, prd: p.prd, cod_interno: p.cod_interno }, { onConflict: 'bar_id,prd' });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    // Refresh da matview é BEST-EFFORT: o vínculo já está gravado. Se estourar o timeout,
    // NÃO falha a request — a tela remove o item na hora (otimista) e o cron atualiza a matview.
    const { error: rErr } = await (admin as any).schema('silver').rpc('fn_refresh_vendas_depara');
    return NextResponse.json({ success: true, vinculados: pares.length, refresh_ok: !rErr, ...(rErr ? { warning: 'refresh adiado — atualiza no próximo cron' } : {}) });
  }

  // ----- CADASTRAR: o item vendido NÃO existe no cardápio (nome parecido é outro produto,
  //        já mapeado) → cria o produto novo + mapeia o prd + refresca. -----
  if (body.action === 'cadastrar_depara') {
    const prd = Number(body.prd);
    const nome = String(body.prd_desc || body.nome || '').trim();
    const prefixo = ['b', 'c', 'd', 'o'].includes(String(body.prefixo)) ? String(body.prefixo) : null;
    if (!Number.isFinite(prd) || prd <= 0) return NextResponse.json({ success: false, error: 'prd inválido' }, { status: 400 });
    if (!nome) return NextResponse.json({ success: false, error: 'nome obrigatório' }, { status: 400 });
    if (!prefixo) return NextResponse.json({ success: false, error: 'categoria (b/c/d/o) obrigatória' }, { status: 400 });
    const catDe: Record<string, string> = { b: 'Bebida', c: 'Comida', d: 'Drink', o: 'Outros' };
    // gera o próximo código do prefixo
    const { data: existts } = await admin.from('produto_cardapio').select('codigo').eq('bar_id', barId).ilike('codigo', `${prefixo}%`);
    const maxn = (existts || []).reduce((m: number, r: any) => Math.max(m, Number(String(r.codigo).replace(/\D/g, '')) || 0), 0);
    const codigo = `${prefixo}${String(maxn + 1).padStart(4, '0')}`;
    const { data: novo, error: eNovo } = await admin.from('produto_cardapio')
      .insert({ bar_id: barId, codigo, nome, categoria: catDe[prefixo], ativo: true, origem: 'contahub' }).select().single();
    if (eNovo) return NextResponse.json({ success: false, error: eNovo.message }, { status: 500 });
    const { error: eMap } = await admin.from('produto_contahub_map').upsert({ bar_id: barId, prd, cod_interno: codigo }, { onConflict: 'bar_id,prd' });
    if (eMap) return NextResponse.json({ success: false, error: eMap.message }, { status: 500 });
    // ficha modelo opcional (copia a receita de um produto parecido)
    if (body.modelo_id && novo?.id) {
      const { data: src } = await admin.from('producao_ficha_item').select('*').eq('produto_id', Number(body.modelo_id));
      const itens = (src || []).map((it: any) => { const { id, created_at, updated_at, ...rest } = it; void id; void created_at; void updated_at; return { ...rest, produto_id: novo.id, producao_id: null }; });
      if (itens.length) await admin.from('producao_ficha_item').insert(itens);
    }
    // Refresh best-effort (ver vincular): cadastro já gravado; timeout não falha a request.
    const { error: rErr } = await (admin as any).schema('silver').rpc('fn_refresh_vendas_depara');
    return NextResponse.json({ success: true, codigo, refresh_ok: !rErr, ...(rErr ? { warning: 'refresh adiado — atualiza no próximo cron' } : {}) });
  }

  // ----- IGNORAR: prd que não é produto de cardápio (ingresso, vale, taxa, embalagem…) -----
  if (body.action === 'ignorar_depara') {
    const rows = (Array.isArray(body.prds) ? body.prds : [])
      .map((p: any) => ({ bar_id: barId, prd: Number(p.prd), prd_desc: p.prd_desc ? String(p.prd_desc) : null, motivo: p.motivo ? String(p.motivo) : 'não é produto de cardápio' }))
      .filter((p: any) => Number.isFinite(p.prd) && p.prd > 0);
    if (!rows.length) return NextResponse.json({ success: false, error: 'nenhum prd válido' }, { status: 400 });
    // a lista lê a tabela de ignorados ao vivo → some no próximo GET, sem refresh de matview
    const { error } = await admin.from('produto_contahub_ignorar').upsert(rows, { onConflict: 'bar_id,prd' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, ignorados: rows.length });
  }

  if (body.action !== 'recalcular') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });

  const { error } = await gold.rpc('fn_cmv_teorico', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Recalcular também REFRESCA a matview de vendas (de-para prd→cod_interno). Sem isso, mudanças
  // de vínculo na ficha (remover/trocar código ContaHub) não refletem no CMV do PERÍODO por mais
  // que se recalcule o custo — o período lê silver.vendas_produto_dia, não gold.produto_cmv.
  // Best-effort: se estourar o timeout, não derruba o recálculo (o cron horário é backstop).
  let refreshOk = true;
  try { const { error: rErr } = await (admin as any).schema('silver').rpc('fn_refresh_vendas_depara'); refreshOk = !rErr; }
  catch { refreshOk = false; }

  // snapshot do dia (atualiza se já existir)
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: atual } = await gold.from('produto_cmv').select('produto_id, codigo, nome, custo, preco_venda, cmv_pct').eq('bar_id', barId);
  if (atual?.length) {
    await gold.from('produto_cmv_historico').upsert(
      atual.map((p: any) => ({ bar_id: barId, produto_id: p.produto_id, data_ref: hoje, codigo: p.codigo, nome: p.nome, custo: p.custo, preco_venda: p.preco_venda, cmv_pct: p.cmv_pct })),
      { onConflict: 'bar_id,produto_id,data_ref' },
    );
  }
  return NextResponse.json({ success: true, refresh_ok: refreshOk, ...(refreshOk ? {} : { warning: 'Custo recalculado. A atualização das vendas por código estourou o tempo — reflete no próximo cron (horário).' }) });
}
