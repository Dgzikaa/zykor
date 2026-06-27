import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DRINK_NAOALC = new Set(['i0298', 'i0085', 'i0328', 'i0191', 'i0563']);
function areaDe(categoria: string | null, cod: string | null): string {
  const c = (categoria || '').toUpperCase();
  if (cod && DRINK_NAOALC.has((cod || '').toLowerCase())) return 'Drinks';
  if (/\(F\)/.test(c)) return 'Alimentação';
  if (/\(C\)/.test(c) || c.includes('PÃES') || c.includes('PAES') || c.includes('FEIJOADA')) return 'Comidas';
  if (/\(S\)/.test(c) || c.includes('MERCADO (S)')) return 'Salão';
  if (/\(B\)/.test(c) || ['DESTILADOS', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'PRÉ-BATCH', 'PRE-BATCH', 'OUTROS'].some((k) => c.includes(k))) return 'Drinks';
  if (['ARTESANAL', 'LATA', 'LONG NECK', 'RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS'].some((k) => c.includes(k))) return 'Salão';
  if (c.includes('ALCÓOLICOS') || c.includes('ALCOOLICOS')) return 'Salão';
  return 'Comidas';
}

const fmtRS = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Insight = { level: 'alert' | 'warn' | 'info'; texto: string };

/** Monta a "Análise de desvios": comparação vs período anterior + concentração + qualidade do dado. */
function buildAnalise(
  itens: any[], head: { perdas: number; sobras: number },
  prev: { prevDate: string | null; prevPerdas: number }, tipo: string,
): { level: 'alert' | 'warn' | 'info'; insights: Insight[]; anterior: string | null } {
  const insights: Insight[] = [];
  const labelPer = tipo === 'diaria' ? 'dia' : tipo === 'semanal' ? 'semana' : 'mês';
  const perdaAbs = Math.abs(head.perdas);

  // 1) comparação com o período anterior do mesmo tipo
  if (prev.prevDate && Math.abs(prev.prevPerdas) > 0) {
    const prevAbs = Math.abs(prev.prevPerdas);
    const delta = (perdaAbs - prevAbs) / prevAbs;
    const dir = delta > 0.05 ? `${Math.round(delta * 100)}% maior` : delta < -0.05 ? `${Math.round(Math.abs(delta) * 100)}% menor` : 'no mesmo nível';
    insights.push({ level: delta > 0.15 ? 'warn' : 'info', texto: `Perda de ${fmtRS(perdaAbs)} neste ${labelPer} — ${dir} que o período anterior (${fmtRS(prevAbs)}).` });
  } else {
    insights.push({ level: 'info', texto: `Perda de ${fmtRS(perdaAbs)} neste ${labelPer}${head.sobras > 0 ? ` · sobras de ${fmtRS(head.sobras)}` : ''}.` });
  }

  const consumoFisico = (i: any) => i.estoque_ini + i.compra - i.estoque_fim_real;

  // 2) qualidade do dado — o que distorce a perda (precisa vir antes pra contextualizar o número)
  // 2a) item sem contagem no fim (estoque real = 0) tendo estoque inicial OU compra no período → todo o saldo vira "perda"
  const semFim = itens.filter((i) => i.estoque_fim_real === 0 && (i.estoque_ini > 0 || i.compra > 0) && i.desvio_rs < 0);
  // 2b) item consumido mas sem ficha/venda que explique (saída teórica 0 e estoque caiu) → consumo todo vira "perda"
  const semFicha = itens.filter((i) => i.estoque_fim_real > 0 && i.saida_teorica === 0 && consumoFisico(i) > 0 && i.desvio_rs < 0);
  const distFim = semFim.reduce((s, i) => s + Math.abs(i.desvio_rs), 0);
  const distFicha = semFicha.reduce((s, i) => s + Math.abs(i.desvio_rs), 0);
  const distorcido = distFim + distFicha;
  const perdaReal = Math.max(0, perdaAbs - distorcido);
  const distSet = new Set([...semFim, ...semFicha].map((i) => i.insumo_codigo));

  if (distorcido >= 50 && perdaAbs > 0 && distorcido / perdaAbs >= 0.25) {
    const partes: string[] = [];
    if (semFim.length) partes.push(`${semFim.length} sem contagem final`);
    if (semFicha.length) partes.push(`${semFicha.length} sem ficha`);
    insights.push({ level: 'alert', texto: `Dos ${fmtRS(perdaAbs)} de perda, ${fmtRS(distorcido)} vêm de itens com dado faltando (${partes.join(' + ')}) — perda real provável ~${fmtRS(perdaReal)}. Resolver o cadastro antes de cobrar a equipe.` });
  } else {
    if (semFim.length && distFim >= 50) insights.push({ level: 'alert', texto: `${semFim.length} ${semFim.length === 1 ? 'item ficou' : 'itens ficaram'} sem contagem no fim (estoque real = 0) — provável contagem faltando, inflando ${fmtRS(distFim)}. Confira a planilha.` });
    if (semFicha.length && distFicha >= 50) insights.push({ level: 'warn', texto: `${semFicha.length} insumo(s) consumidos sem ficha técnica que explique a venda — ${fmtRS(distFicha)} viram "perda". Falta cadastrar a receita.` });
  }

  // 3) concentração da perda REAL por área (ignora itens distorcidos)
  const perdasArea: Record<string, number> = {};
  for (const it of itens) if (it.desvio_rs < 0 && !distSet.has(it.insumo_codigo)) perdasArea[it.area] = (perdasArea[it.area] || 0) + Math.abs(it.desvio_rs);
  const areas = Object.entries(perdasArea).sort((a, b) => b[1] - a[1]);
  if (areas.length && perdaReal > 0) {
    const [area, val] = areas[0];
    const pct = Math.round((val / perdaReal) * 100);
    if (pct >= 40) insights.push({ level: 'info', texto: `Na perda real, ${area} concentra ${pct}% (${fmtRS(val)}).` });
  }

  // 4) maiores perdas REAIS por insumo (exclui os distorcidos; itens já vêm ordenados por |desvio_rs|)
  const top = itens.filter((i) => i.desvio_rs < 0 && !distSet.has(i.insumo_codigo)).slice(0, 3);
  if (top.length) {
    insights.push({ level: 'info', texto: `Maiores perdas reais: ${top.map((t) => `${t.insumo_nome} (${fmtRS(Math.abs(t.desvio_rs))})`).join(', ')}.` });
  }

  // 5) itens sem preço (desvio não valorizado)
  const semPreco = itens.filter((i) => i.preco == null).length;
  if (semPreco) insights.push({ level: 'warn', texto: `${semPreco} insumo(s) sem preço cadastrado — desvio em R$ não conta pra eles.` });

  const level: 'alert' | 'warn' | 'info' = insights.some((i) => i.level === 'alert') ? 'alert' : insights.some((i) => i.level === 'warn') ? 'warn' : 'info';
  return { level, insights, anterior: prev.prevDate };
}

/**
 * GET /api/operacional/desvios
 *  - sem ?ini&fim → datas de contagem do tipo (?tipo=diaria|semanal|mensal) p/ o seletor.
 *  - com ?ini&fim → desvio por insumo:
 *      Estoque fim teórico = estoque_ini + compras − Saída Teórica (vendas×ficha do período [ini, fim)).
 *      Desvio = Estoque real (contagem do fim) − Estoque fim teórico. Negativo = faltou (perda).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  const tipo = ['diaria', 'semanal', 'mensal'].includes(sp.get('tipo') || '') ? sp.get('tipo') : 'semanal';

  if (!ini || !fim) {
    const { data: datas, error } = await (sb() as any).schema('operations')
      .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, datas: (datas || []).map((d: any) => d.data_contagem) });
  }

  const { data, error } = await (sb() as any).schema('gold')
    .rpc('fn_desvios', { p_bar: user.bar_id, p_ini: ini, p_fim: fim });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // na diária só faz sentido a Curva A (insumos contados todo dia); senão estoque ini/fim vem furado
  const base = tipo === 'diaria' ? (data || []).filter((r: any) => r.curva_a === true) : (data || []);

  const itens = base.map((r: any) => {
    const estoque_ini = Number(r.estoque_ini || 0);
    const compra = Number(r.compra || 0);
    const estoque_fim_real = Number(r.estoque_fim_real || 0);
    const teorica = Number(r.saida_teorica || 0);
    // consumo físico = quanto saiu de fato do estoque (ini + compras − fim real)
    const consumo_fisico = estoque_ini + compra - estoque_fim_real;
    // suspeita de ficha/unidade: saída teórica muito acima do consumo físico + impacto alto
    const suspeita = Math.abs(teorica) > Math.abs(consumo_fisico) * 5 && Math.abs(Number(r.desvio_rs || 0)) > 200;
    const is_producao = r.is_producao === true;
    const produzido = Number(r.produzido || 0);
    const desperdicio = Number(r.desperdicio || 0);
    // produção em que o estoque SUBIU (produziu no período) sem o "produzido" informado → desvio não confiável
    const pendente = is_producao && !r.produzido_informado && estoque_fim_real > estoque_ini;
    return {
      insumo_codigo: r.insumo_codigo,
      insumo_nome: r.insumo_nome,
      curva_a: r.curva_a,
      is_producao,
      unidade: r.unidade || null,
      area: areaDe(r.categoria, r.insumo_codigo),
      estoque_ini,
      compra,
      produzido,
      saida_teorica: teorica,
      desperdicio,
      estoque_fim_teorico: Number(r.estoque_fim_teorico || 0),
      estoque_fim_real,
      desvio_qtd: Number(r.desvio_qtd || 0),
      preco: r.preco == null ? null : Number(r.preco),
      desvio_rs: Number(r.desvio_rs || 0),
      produzido_informado: !!r.produzido_informado,
      pendente,
      suspeita,
    };
  });

  // enriquece produções: fornadas lançadas no período + rendimento por fornada (atalho fornadas×rend → unidade de contagem)
  const prodCods = itens.filter((i: any) => i.is_producao).map((i: any) => i.insumo_codigo);
  if (prodCods.length) {
    const [pbRes, enRes] = await Promise.all([
      sb().from('producao_base').select('codigo, rendimento, fator_contagem, unidade_contagem').eq('bar_id', user.bar_id),
      (sb() as any).schema('operations').from('producao_entrada_manual').select('producao_codigo, fornadas').eq('bar_id', user.bar_id).gte('data', ini).lt('data', fim),
    ]);
    const pbMap = new Map<string, any>((pbRes.data || []).map((r: any) => [String(r.codigo).toUpperCase(), r]));
    const fornMap = new Map<string, number>();
    for (const e of (enRes.data || [])) { const k = String(e.producao_codigo).toUpperCase(); fornMap.set(k, (fornMap.get(k) || 0) + Number(e.fornadas || 0)); }
    for (const it of itens) {
      if (!it.is_producao) continue;
      const pb = pbMap.get(String(it.insumo_codigo).toUpperCase());
      const rend = Number(pb?.rendimento || 0); const fator = Number(pb?.fator_contagem || 1) || 1;
      it.rend_contagem = rend > 0 ? rend / fator : null; // unidades de contagem por fornada
      it.unidade_contagem = pb?.unidade_contagem || it.unidade;
      it.fornadas = fornMap.get(String(it.insumo_codigo).toUpperCase()) || null;
      // sugestão de produzido (estimativa pelo movimento + vendas): produzido ≈ (fim − ini) + saída teórica + desperdício
      const sug = (it.estoque_fim_real - it.estoque_ini) + it.saida_teorica + it.desperdicio;
      it.produzido_sugerido = sug > 0.001 ? Math.round(sug * 100) / 100 : null;
      it.fornadas_sugerido = (it.produzido_sugerido && it.rend_contagem) ? Math.round((it.produzido_sugerido / it.rend_contagem) * 100) / 100 : null;
    }
  }

  // desvio = real − teórico. Negativo = faltou estoque (perda); positivo = sobrou (sobra).
  // ignora itens pendentes (produção sem 'produzido' informado = sobra falsa) nos agregados.
  const itensValidos = itens.filter((i: any) => !i.pendente);
  const desvio_total = itensValidos.reduce((s: number, i: any) => s + i.desvio_rs, 0);
  const perdas = itensValidos.reduce((s: number, i: any) => s + (i.desvio_rs < 0 ? i.desvio_rs : 0), 0);
  const sobras = itensValidos.reduce((s: number, i: any) => s + (i.desvio_rs > 0 ? i.desvio_rs : 0), 0);

  // análise: compara a perda deste período com a do período anterior do mesmo tipo
  let analise: any = null;
  try {
    const { data: datasRaw } = await (sb() as any).schema('operations')
      .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo });
    const ds: string[] = (datasRaw || []).map((d: any) => d.data_contagem); // já vem desc
    const idx = ds.indexOf(ini);
    const prevDate = idx >= 0 && idx < ds.length - 1 ? ds[idx + 1] : null; // contagem imediatamente anterior a `ini`
    let prevPerdas = 0;
    if (prevDate) {
      const { data: pdata } = await (sb() as any).schema('gold')
        .rpc('fn_desvios', { p_bar: user.bar_id, p_ini: prevDate, p_fim: ini });
      const pbase = tipo === 'diaria' ? (pdata || []).filter((r: any) => r.curva_a === true) : (pdata || []);
      for (const r of pbase) { const v = Number(r.desvio_rs || 0); if (v < 0) prevPerdas += v; }
    }
    analise = buildAnalise(itensValidos, { perdas, sobras }, { prevDate, prevPerdas }, tipo || 'semanal');
  } catch { analise = null; }

  return NextResponse.json({
    success: true,
    ini, fim,
    itens: itens.sort((a: any, b: any) => Math.abs(b.desvio_rs) - Math.abs(a.desvio_rs)),
    headline: { desvio_total, perdas, sobras },
    analise,
  });
}

/**
 * POST — lança o "produzido" (produção, por fornadas ou direto) e o "desperdício" (qualquer item).
 *  body: { tipo:'produzido'|'desperdicio', codigo, data, ... }
 *   - produzido: { fornadas? } (converte por rendimento×fator) OU { qtd } (direto na unidade de contagem)
 *   - desperdicio: { qtd, motivo? }
 * Lança com data = `data` (dia da operação). Qtd 0/null apaga o lançamento.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const codigo = String(body.codigo || '').trim();
  const data = String(body.data || '').trim();
  if (!codigo || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'codigo e data (YYYY-MM-DD) obrigatórios' }, { status: 400 });
  }
  const ops = (sb() as any).schema('operations');

  if (body.tipo === 'produzido') {
    // resolve a quantidade: por fornadas (× rendimento ÷ fator_contagem) ou direto
    let produzido_qtd: number | null = null;
    let fornadas: number | null = null;
    if (body.fornadas != null && body.fornadas !== '') {
      fornadas = Number(body.fornadas);
      const { data: pb } = await sb().from('producao_base')
        .select('rendimento, fator_contagem').eq('bar_id', user.bar_id).eq('codigo', codigo).maybeSingle();
      const rend = Number(pb?.rendimento || 0);
      const fator = Number(pb?.fator_contagem || 1) || 1;
      produzido_qtd = rend > 0 ? (fornadas * rend) / fator : null;
      if (produzido_qtd == null) return NextResponse.json({ success: false, error: 'rendimento da produção não cadastrado' }, { status: 400 });
    } else {
      produzido_qtd = Number(body.qtd);
    }
    if (!Number.isFinite(produzido_qtd as number) || (produzido_qtd as number) <= 0) {
      const { error } = await ops.from('producao_entrada_manual').delete().eq('bar_id', user.bar_id).eq('producao_codigo', codigo).eq('data', data);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, removido: true });
    }
    const { error } = await ops.from('producao_entrada_manual').upsert({
      bar_id: user.bar_id, producao_codigo: codigo, data,
      fornadas, produzido_qtd, usuario: user.email || 'app', atualizado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,producao_codigo,data' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, produzido_qtd });
  }

  if (body.tipo === 'desperdicio') {
    const qtd = Number(body.qtd);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      const { error } = await ops.from('desvio_desperdicio_manual').delete().eq('bar_id', user.bar_id).eq('insumo_codigo', codigo).eq('data', data);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, removido: true });
    }
    const { error } = await ops.from('desvio_desperdicio_manual').upsert({
      bar_id: user.bar_id, insumo_codigo: codigo, data, qtd,
      motivo: body.motivo ? String(body.motivo) : null, usuario: user.email || 'app', atualizado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,insumo_codigo,data' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, qtd });
  }

  return NextResponse.json({ success: false, error: 'tipo inválido' }, { status: 400 });
}
