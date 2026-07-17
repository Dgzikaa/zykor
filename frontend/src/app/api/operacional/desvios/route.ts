import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

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
  // fornecedor de bebida cadastrado como categoria (ex.: AMBEV/HEINEKEN) → Salão, não Comidas
  if (['AMBEV', 'HEINEKEN', 'KIRIN', 'CERVEJ', 'CHOPP'].some((k) => c.includes(k))) return 'Salão';
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

// análise enxuta p/ Produções e Proteínas: perda vs período anterior + maiores perdas.
function buildAnaliseSimples(
  itens: { desvio_rs: number; nome: string }[],
  head: { perdas: number; sobras: number },
  prev: { prevDate: string | null; prevPerdas: number },
  labelTipo: string,
): { level: 'alert' | 'warn' | 'info'; insights: { level: string; texto: string }[]; anterior: string | null } {
  const insights: { level: string; texto: string }[] = [];
  const per = labelTipo === 'diaria' ? 'dia' : labelTipo === 'semanal' ? 'semana' : 'mês';
  const perda = Math.abs(head.perdas);
  let level: 'alert' | 'warn' | 'info' = 'info';
  if (prev.prevDate && Math.abs(prev.prevPerdas) > 0.01) {
    const prevAbs = Math.abs(prev.prevPerdas);
    const d = (perda - prevAbs) / prevAbs;
    const txt = d > 0.05 ? `${Math.round(d * 100)}% maior` : d < -0.05 ? `${Math.round(Math.abs(d) * 100)}% menor` : 'no mesmo nível';
    if (d > 0.15) level = 'warn';
    insights.push({ level: d > 0.15 ? 'warn' : 'info', texto: `Perda de ${fmtRS(perda)} neste ${per} — ${txt} que o período anterior (${fmtRS(prevAbs)}).` });
  } else {
    insights.push({ level: 'info', texto: `Perda de ${fmtRS(perda)} neste ${per}${head.sobras > 0.01 ? ` · sobras de ${fmtRS(head.sobras)}` : ''}.` });
  }
  const top = itens.filter((i) => i.desvio_rs < -1).sort((a, b) => a.desvio_rs - b.desvio_rs).slice(0, 3);
  if (top.length) insights.push({ level: 'info', texto: `Maiores perdas: ${top.map((p) => `${p.nome} (${fmtRS(Math.abs(p.desvio_rs))})`).join(', ')}.` });
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
  // semana em andamento: ini = abertura da semana atual (última segunda), fim = última contagem diária
  // disponível → só itens de Curva A têm fim fresco; restringe a Curva A (igual diária).
  const andamento = sp.get('andamento') === '1';

  if (!ini || !fim) {
    // p_classe='insumo': exclui contagens de limpeza/utensílio (forçadas a 'semanal' no refresh,
    // contadas em dias soltos da semana) — senão poluem as janelas semanais com datas de ter/qua.
    const { data: datas, error } = await (sb() as any).schema('operations')
      .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo, p_classe: 'insumo' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const ds: string[] = (datas || []).map((d: any) => d.data_contagem);
    // prévia da semana em andamento (só semanal): abertura = última contagem semanal; fim = última
    // contagem diária (Curva A) que seja mais recente que essa abertura. Sem fim novo → sem prévia.
    let andamentoWin: { ini: string; fim: string } | null = null;
    if (tipo === 'semanal' && ds.length) {
      const { data: dia } = await (sb() as any).schema('operations')
        .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: 'diaria', p_classe: 'insumo' });
      const latest: string | null = ((dia || []).map((d: any) => d.data_contagem))[0] || null;
      if (latest && latest > ds[0]) andamentoWin = { ini: ds[0], fim: latest };
    }
    return NextResponse.json({ success: true, datas: ds, andamento: andamentoWin });
  }

  // aba Proteínas (VMarket × Utilizado Produção, estoque âncora) — fn própria
  if (sp.get('aba') === 'proteina') {
    const { data, error } = await (sb() as any).schema('gold').rpc('fn_desvios_proteina', { p_bar: user.bar_id, p_ini: ini, p_fim: fim });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const rows = (data || []) as any[];
    const headline = {
      desvio_total: rows.reduce((s, i) => s + Number(i.desvio_rs || 0), 0),
      perdas: rows.reduce((s, i) => s + (Number(i.desvio_rs || 0) < 0 ? Number(i.desvio_rs) : 0), 0),
      sobras: rows.reduce((s, i) => s + (Number(i.desvio_rs || 0) > 0 ? Number(i.desvio_rs) : 0), 0),
    };
    let analise: any = null;
    try {
      const { data: datasRaw } = await (sb() as any).schema('operations').rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo, p_classe: 'insumo' });
      const ds: string[] = (datasRaw || []).map((d: any) => d.data_contagem);
      const idx = ds.indexOf(ini);
      const prevDate = idx >= 0 && idx < ds.length - 1 ? ds[idx + 1] : null;
      let prevPerdas = 0;
      if (prevDate) {
        const { data: pdata } = await (sb() as any).schema('gold').rpc('fn_desvios_proteina', { p_bar: user.bar_id, p_ini: prevDate, p_fim: ini });
        for (const r of (pdata || [])) { const v = Number(r.desvio_rs || 0); if (v < 0) prevPerdas += v; }
      }
      analise = buildAnaliseSimples(rows.map((i) => ({ desvio_rs: Number(i.desvio_rs || 0), nome: i.insumo_nome })), headline, { prevDate, prevPerdas }, tipo || 'semanal');
    } catch { analise = null; }
    return NextResponse.json({ success: true, itens: rows, headline, analise });
  }

  // Dispara o cálculo do PERÍODO ANTERIOR (usado só na "análise vs período anterior") EM PARALELO
  // com o fn_desvios principal + enriquecimento. Antes rodava em série no fim → dobrava a latência.
  // Mesmas queries, mesmo resultado — só sobrepostos. Depende só de bar/tipo/ini (já disponíveis).
  const analiseDataPromise: Promise<{ prevDate: string | null; prevPerdas: number; prevPerdasProd: number }> = (async () => {
    try {
      const { data: datasRaw } = await (sb() as any).schema('operations')
        .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo, p_classe: 'insumo' });
      const ds: string[] = (datasRaw || []).map((d: any) => d.data_contagem); // desc
      const idx = ds.indexOf(ini);
      const prevDate = andamento ? null : (idx >= 0 && idx < ds.length - 1 ? ds[idx + 1] : null);
      let prevPerdas = 0, prevPerdasProd = 0;
      if (prevDate) {
        const { data: pdata } = await (sb() as any).schema('gold')
          .rpc('fn_desvios', { p_bar: user.bar_id, p_ini: prevDate, p_fim: ini });
        const pbase = tipo === 'diaria' ? (pdata || []).filter((r: any) => r.curva_a === true) : (pdata || []);
        for (const r of pbase) {
          const v = Number(r.desvio_rs || 0);
          if (r.is_producao) { if (v < 0) prevPerdasProd += v; }
          else if (v < 0) prevPerdas += v;
        }
      }
      return { prevDate, prevPerdas, prevPerdasProd };
    } catch { return { prevDate: null, prevPerdas: 0, prevPerdasProd: 0 }; }
  })();

  const { data, error } = await (sb() as any).schema('gold')
    .rpc('fn_desvios', { p_bar: user.bar_id, p_ini: ini, p_fim: fim });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // na diária (e na prévia da semana em andamento) só faz sentido a Curva A (insumos contados todo
  // dia); senão o estoque fim dos demais vem furado (sem contagem nova) e vira perda falsa.
  const base = (tipo === 'diaria' || andamento) ? (data || []).filter((r: any) => r.curva_a === true) : (data || []);

  // Composição do estoque (contagem crua × embutido em pré-batches decompor_contagem) p/ o
  // tooltip de debug das colunas "Estoque inicial" e "Estoque real". Por (bar, ini, fim), por código.
  const { data: compRows } = await (sb() as any).schema('gold')
    .rpc('fn_desvios_composicao', { p_bar: user.bar_id, p_ini: ini, p_fim: fim });
  const compMap = new Map<string, any>((compRows || []).map((c: any) => [String(c.cod).toUpperCase(), c]));

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
    // Produção sem "produzido" informado: SEMPRE mostrar o desvio bruto calculado
    // pela fn_desvios (não esconde mais com "—"). A maioria dos dias não tem produção
    // lançada, e o número cru é informação útil — sobra grande com est_ini=0 sinaliza
    // "produziu e não registrou"; perda legítima aparece normal. Flag `sem_producao`
    // vira só badge visual (não altera cálculo nem tira do agregado).
    // Antes: `pendente = is_producao && !produzido_informado && teorica > 0` escondia
    // desvios legítimos (Gonza 2026-07-17: Pastel Carne PC0013 tinha desvio +54 unid /
    // +R$106,91 e mostrava "—").
    const sem_producao = is_producao && !r.produzido_informado;
    const pendente = false;
    // motivo de dado faltando (p/ o usuário ver QUAIS itens distorcem a perda) — só insumos
    const dvrs = Number(r.desvio_rs || 0);
    const dado_faltando = !is_producao
      ? (estoque_fim_real === 0 && (estoque_ini > 0 || compra > 0) && dvrs < 0 ? 'sem_contagem'
        : (estoque_fim_real > 0 && teorica === 0 && consumo_fisico > 0 && dvrs < 0 ? 'sem_ficha' : null))
      : null;
    return {
      insumo_codigo: r.insumo_codigo,
      insumo_nome: r.insumo_nome,
      curva_a: r.curva_a,
      is_producao,
      unidade: r.unidade || null,
      area: areaDe(r.categoria, r.insumo_codigo),
      estoque_ini,
      // composição do estoque ini/fim (contagem × pré-batch) — tooltip de debug
      composicao: compMap.get(String(r.insumo_codigo).toUpperCase()) || null,
      compra,
      troca: Number(r.troca || 0),
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
      sem_producao,
      suspeita,
      dado_faltando,
    };
  });

  // enriquece produções: fornadas lançadas no período + rendimento por fornada (atalho fornadas×rend → unidade de contagem)
  const prodCods = itens.filter((i: any) => i.is_producao).map((i: any) => i.insumo_codigo);
  if (prodCods.length) {
    const [pbRes, enRes] = await Promise.all([
      sb().from('producao_base').select('codigo, rendimento, fator_contagem, unidade_contagem, secao').eq('bar_id', user.bar_id),
      (sb() as any).schema('operations').from('producao_entrada_manual').select('producao_codigo, fornadas').eq('bar_id', user.bar_id).gte('data', ini).lt('data', fim),
    ]);
    const pbMap = new Map<string, any>((pbRes.data || []).map((r: any) => [String(r.codigo).toUpperCase(), r]));
    const fornMap = new Map<string, number>();
    for (const e of (enRes.data || [])) { const k = String(e.producao_codigo).toUpperCase(); fornMap.set(k, (fornMap.get(k) || 0) + Number(e.fornadas || 0)); }
    for (const it of itens) {
      if (!it.is_producao) continue;
      const pb = pbMap.get(String(it.insumo_codigo).toUpperCase());
      // seção da produção (Comida/Drinks) — respeita o cadastro (producao_base.secao); fallback no prefixo (pd=Bar/Drinks)
      const sec = pb?.secao || (String(it.insumo_codigo).toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha');
      it.secao_prod = sec === 'Bar' ? 'Drinks' : 'Comida';
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

  // marca proteína (curva_a_proteina) → o frontend separa as abas: Insumos (não-prod, não-prot),
  // Produções (is_producao), Proteínas (is_proteina, via fn própria).
  const { data: protRows } = await (sb() as any).schema('operations').from('insumos')
    .select('codigo').eq('bar_id', user.bar_id).eq('curva_a_proteina', true);
  const proteinSet = new Set((protRows || []).map((r: any) => String(r.codigo).toUpperCase()));
  // insumos que estão em alguma ficha de produto (têm saída teórica possível)
  const { data: fichaRows } = await (sb() as any).schema('silver').from('insumo_em_ficha')
    .select('cod').eq('bar_id', user.bar_id);
  const fichaSet = new Set((fichaRows || []).map((r: any) => String(r.cod).toUpperCase()));
  for (const i of itens) {
    i.is_proteina = proteinSet.has(String(i.insumo_codigo).toUpperCase());
    i.tem_ficha = i.is_producao || fichaSet.has(String(i.insumo_codigo).toUpperCase());
  }
  // headline/análise = só INSUMOS (produção e proteína têm aba própria)
  const insumosOnly = itens.filter((i: any) => !i.is_producao && !i.is_proteina);

  // desvio = real − teórico. Negativo = faltou estoque (perda); positivo = sobrou (sobra).
  // ignora itens pendentes (produção sem 'produzido' informado = sobra falsa) nos agregados.
  const itensValidos = insumosOnly.filter((i: any) => !i.pendente);
  const desvio_total = itensValidos.reduce((s: number, i: any) => s + i.desvio_rs, 0);
  const perdas = itensValidos.reduce((s: number, i: any) => s + (i.desvio_rs < 0 ? i.desvio_rs : 0), 0);
  const sobras = itensValidos.reduce((s: number, i: any) => s + (i.desvio_rs > 0 ? i.desvio_rs : 0), 0);

  // PRODUÇÕES: headline próprio (mesmo balanço, linhas is_producao)
  const prodRows = itens.filter((i: any) => i.is_producao && !i.pendente && ((tipo !== 'diaria' && !andamento) || i.curva_a === true));
  const headlineProducao = {
    desvio_total: prodRows.reduce((s: number, i: any) => s + i.desvio_rs, 0),
    perdas: prodRows.reduce((s: number, i: any) => s + (i.desvio_rs < 0 ? i.desvio_rs : 0), 0),
    sobras: prodRows.reduce((s: number, i: any) => s + (i.desvio_rs > 0 ? i.desvio_rs : 0), 0),
  };

  // análise: compara a perda deste período com a do período anterior do mesmo tipo
  let analise: any = null;
  let analiseProducao: any = null;
  try {
    // já calculado em paralelo lá em cima (não compara na prévia em andamento — semana parcial engana)
    const { prevDate, prevPerdas, prevPerdasProd } = await analiseDataPromise;
    analise = buildAnalise(itensValidos, { perdas, sobras }, { prevDate, prevPerdas }, tipo || 'semanal');
    analiseProducao = buildAnaliseSimples(
      prodRows.map((i: any) => ({ desvio_rs: i.desvio_rs, nome: i.insumo_nome })),
      { perdas: headlineProducao.perdas, sobras: headlineProducao.sobras },
      { prevDate, prevPerdas: prevPerdasProd }, tipo || 'semanal');
  } catch { analise = null; }

  return NextResponse.json({
    success: true,
    ini, fim, em_andamento: andamento,
    itens: itens.sort((a: any, b: any) => Math.abs(b.desvio_rs) - Math.abs(a.desvio_rs)),
    headline: { desvio_total, perdas, sobras },
    analise,
    headline_producao: headlineProducao,
    analise_producao: analiseProducao,
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
  const nega = negarPorRota(user, request); if (nega) return nega;
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

  if (body.tipo === 'utilizado') {
    const qtd = Number(body.qtd);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      const { error } = await ops.from('proteina_utilizado_manual').delete().eq('bar_id', user.bar_id).eq('insumo_codigo', codigo).eq('data', data);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, removido: true });
    }
    const { error } = await ops.from('proteina_utilizado_manual').upsert({
      bar_id: user.bar_id, insumo_codigo: codigo, data, qtd, atualizado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,insumo_codigo,data' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, qtd });
  }

  return NextResponse.json({ success: false, error: 'tipo inválido' }, { status: 400 });
}
