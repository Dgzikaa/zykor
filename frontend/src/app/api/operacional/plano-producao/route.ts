import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = () => (sb() as any).schema('operations');
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (v: any) => Number(v || 0);
const r2 = (v: number) => Number(v.toFixed(2));
const areaDe = (cod: string) => (cod || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';

// De/para Nível de Serviço → Fator de Serviço (z-score da normal).
const NIVEL_Z: Record<number, number> = {
  50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282,
  95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1,
};
const zDe = (nivel: number) => NIVEL_Z[nivel] ?? 1.645;

function calcular(media6: number, desvpad: number, estoque: number, rendContagem: number, nivel: number, semanas: number) {
  const pr = media6 + desvpad * zDe(nivel);
  const gap = pr - estoque;
  const ae = gap < 0 ? gap : gap + pr * ((semanas || 1) - 1);
  const naoProduzir = ae <= 0;
  const receitas = !naoProduzir && rendContagem > 0 ? Math.ceil(ae / rendContagem) : 0;
  return { pr: r2(pr), naoProduzir, receitas, sugestaoQtd: r2(receitas * rendContagem) };
}
function mediaPonderada(saidas: number[]) {
  let n = 0, d = 0;
  saidas.forEach((v, i) => { if (v > 0) { n += v * (i + 1); d += (i + 1); } });
  return d > 0 ? n / d : 0;
}
function desvioPadrao(saidas: number[]) {
  const k = saidas.length;
  if (k < 2) return 0;
  const m = saidas.reduce((s, v) => s + v, 0) / k;
  return Math.sqrt(saidas.reduce((s, v) => s + (v - m) ** 2, 0) / (k - 1));
}
// segunda-feira da semana que contém d
function semanaIniDe(d: Date) { const dow = (d.getDay() + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - dow); return isoD(m); }
const addDias = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d + n)); return dt.toISOString().slice(0, 10); };

// Itens "ao vivo" da semana W: roda fn_plano_producao + aplica config + sugestão.
async function montarItensLive(barId: number, semanaIni: string) {
  const gold = (sb() as any).schema('gold');
  const [{ data }, { data: cfgs }] = await Promise.all([
    gold.rpc('fn_plano_producao', { p_bar: barId, p_semana: semanaIni }),
    ops().from('producao_plano_config').select('producao_id, nivel_servico, semanas_receita').eq('bar_id', barId),
  ]);
  const cfgMap = new Map((cfgs || []).map((c: any) => [Number(c.producao_id), c]));
  return ((data || []) as any[]).map((r) => {
    const saidas = (r.saidas || []).map(num);
    const media6 = mediaPonderada(saidas);
    const desvpad = desvioPadrao(saidas);
    const fator = num(r.fator_contagem) || 1;
    const rendContagem = r2(num(r.rendimento) / fator);
    const cfg = cfgMap.get(Number(r.producao_id)) as any;
    const nivel = cfg ? Number(cfg.nivel_servico) : 95;
    const semanas = cfg ? Number(cfg.semanas_receita) : 1;
    const c = calcular(media6, desvpad, num(r.estoque_atual), rendContagem, nivel, semanas);
    return {
      producao_id: Number(r.producao_id), codigo: r.producao_cod, nome: r.producao_nome,
      unidade: r.unidade, curva_a: r.curva_a === true, controle_producao: r.controle_producao === true,
      rendimento: num(r.rendimento), fator, rend_contagem: rendContagem,
      estoque: num(r.estoque_atual), media6: r2(media6), desvpad: r2(desvpad), saidas, semanas: r.semanas || [],
      nivel_servico: nivel, semanas_receita: semanas,
      pr: c.pr, sugestao_qtd: c.sugestaoQtd, sugestao_receitas: c.receitas, nao_produzir: c.naoProduzir,
    };
  });
}

// BOM pai→filho (qtd do filho na un. contagem por receita do pai)
async function fetchBom(itens: any[]) {
  const idFator = new Map(itens.map((i) => [i.producao_id, i.fator]));
  const ids = new Set(itens.map((i) => i.producao_id));
  const { data: fichaProd } = await sb().from('producao_ficha_item')
    .select('producao_id, producao_ref, quantidade').eq('componente_tipo', 'producao').not('producao_ref', 'is', null);
  return ((fichaProd || []) as any[])
    .filter((f) => ids.has(Number(f.producao_id)) && ids.has(Number(f.producao_ref)))
    .map((f) => ({ pai: Number(f.producao_id), filho: Number(f.producao_ref), qtd_receita: r2(num(f.quantidade) / (Number(idFator.get(Number(f.producao_ref))) || 1)) }));
}
function calcConsumo(itens: any[], bom: any[], decBy: Map<number, any>) {
  const rec = new Map<number, number>(itens.map((it) => {
    const d = decBy.get(it.producao_id);
    return [it.producao_id, d?.decidido_receitas != null ? Number(d.decidido_receitas) : it.sugestao_receitas];
  }));
  const m = new Map<number, number>();
  bom.forEach((b) => { const q = rec.get(b.pai) || 0; if (q > 0) m.set(b.filho, (m.get(b.filho) || 0) + q * b.qtd_receita); });
  return m;
}
// linha de snapshot (operations.producao_plano_item) → item da tela
const snapToItem = (s: any) => ({
  producao_id: Number(s.producao_id), codigo: s.producao_cod, nome: s.producao_nome,
  unidade: s.unidade, curva_a: s.curva_a === true, controle_producao: true,
  rend_contagem: num(s.rend_contagem), estoque: num(s.estoque),
  media6: num(s.media6), desvpad: num(s.desvpad), saidas: s.saidas || [], semanas: s.semanas_datas || [],
  nivel_servico: s.nivel_servico ?? 95, semanas_receita: num(s.semanas_receita) || 1,
  pr: num(s.ponto_ressupr), sugestao_qtd: num(s.sugestao_qtd), sugestao_receitas: s.sugestao_receitas ?? 0,
  nao_produzir: (s.sugestao_receitas ?? 0) <= 0, consumo: num(s.consumo), frozen: true,
  decisao: { decidido_receitas: s.decidido_receitas, decidido_qtd: s.decidido_qtd, dia_producao: s.dia_producao, seguiu_sugestao: s.seguiu_sugestao, motivo_override: s.motivo_override },
});

// ---------------------------------------------------------------------------
// GET: planejamento da semana selecionada (?semana=YYYY-MM-DD) + seletor de semanas.
//   ?hoje=1 → calendarização do dia (Controle de Produção).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  if (sp.get('hoje')) {
    const hoje = isoD(new Date());
    const { data: planos } = await ops().from('producao_plano').select('id').eq('bar_id', barId).eq('status', 'encerrado').order('semana_ini', { ascending: false }).limit(8);
    const ids = (planos || []).map((p: any) => p.id);
    if (!ids.length) return NextResponse.json({ success: true, data: hoje, itens: [] });
    const { data: itens } = await ops().from('producao_plano_item')
      .select('producao_id, producao_cod, producao_nome, decidido_receitas, decidido_qtd, sugestao_qtd, dia_producao')
      .in('plano_id', ids).eq('dia_producao', hoje);
    return NextResponse.json({ success: true, data: hoje, itens: itens || [] });
  }

  // semanas com contagem (seletor)
  const gold = (sb() as any).schema('gold');
  const { data: semRows } = await gold.rpc('fn_semanas_com_contagem', { p_bar: barId });
  const comContagem: string[] = (semRows || []).map((r: any) => r.semana_ini);
  const latest = comContagem[0] || semanaIniDe(new Date());
  // lista do seletor: semanas com contagem + a próxima (bloqueada, aguardando contagem)
  const semanasDisponiveis = [
    { ini: addDias(latest, 7), fim: addDias(latest, 13), tem_contagem: false },
    ...comContagem.map((ini) => ({ ini, fim: addDias(ini, 6), tem_contagem: true })),
  ];
  // semana selecionada: ?semana= (se válida) senão a mais recente com contagem
  const pedida = sp.get('semana');
  const semanaSel = pedida && comContagem.includes(pedida) ? pedida : latest;
  const semana = { ini: semanaSel, fim: addDias(semanaSel, 6) };

  // Calendarização da semana p/ o Controle de Produção: itens dos planos ENCERRADOS
  // (o que foi finalizado e mandado produzir), com o dia e a quantidade decidida.
  if (sp.get('calendario')) {
    const { data: planos } = await ops().from('producao_plano')
      .select('id, area').eq('bar_id', barId).eq('semana_ini', semanaSel).eq('status', 'encerrado');
    const ids = (planos || []).map((p: any) => p.id);
    const areaDeId = new Map((planos || []).map((p: any) => [p.id, p.area]));
    let itensCal: any[] = [];
    if (ids.length) {
      const { data: its } = await ops().from('producao_plano_item')
        .select('plano_id, producao_id, producao_cod, producao_nome, decidido_receitas, decidido_qtd, dia_producao, unidade')
        .in('plano_id', ids);
      itensCal = (its || []).filter((it: any) => Number(it.decidido_receitas) > 0)
        .map((it: any) => ({ ...it, area: areaDeId.get(it.plano_id) || 'Cozinha' }));
    }
    return NextResponse.json({
      success: true, semana, semana_sel: semanaSel, semana_ativa: latest,
      semanas_disponiveis: semanasDisponiveis, itens: itensCal,
    });
  }

  const [{ data: evs }, { data: planosRows }] = await Promise.all([
    ops().from('feriados_eventos').select('data,nome').gte('data', semana.ini).lte('data', semana.fim),
    ops().from('producao_plano').select('*').eq('bar_id', barId).eq('semana_ini', semanaSel),
  ]);
  const planos: Record<string, any> = { Cozinha: null, Bar: null };
  (planosRows || []).forEach((p: any) => { planos[p.area || 'Cozinha'] = p; });

  const encerradoIds = (planosRows || []).filter((p: any) => p.status === 'encerrado').map((p: any) => p.id);
  const rascunhoIds = (planosRows || []).filter((p: any) => p.status === 'rascunho').map((p: any) => p.id);

  // itens: congelados (snapshot) p/ áreas encerradas; ao vivo p/ o resto
  const itens: any[] = [];
  if (encerradoIds.length) {
    const { data: snaps } = await ops().from('producao_plano_item').select('*').in('plano_id', encerradoIds);
    (snaps || []).forEach((s: any) => itens.push(snapToItem(s)));
  }
  const live = await montarItensLive(barId, semanaSel);
  const bom = await fetchBom(live);
  let decMap = new Map<number, any>();
  if (rascunhoIds.length) {
    const { data: items } = await ops().from('producao_plano_item').select('*').in('plano_id', rascunhoIds);
    decMap = new Map((items || []).map((it: any) => [Number(it.producao_id), it]));
  }
  for (const it of live) {
    if (planos[areaDe(it.codigo)]?.status === 'encerrado') continue; // já veio do snapshot
    itens.push({ ...it, decisao: decMap.get(it.producao_id) || null });
  }

  return NextResponse.json({
    success: true,
    semana, semana_sel: semanaSel, semana_ativa: latest, semanas_disponiveis: semanasDisponiveis,
    contagem: { data: comContagem.includes(semanaSel) ? semanaSel : null },
    planos,
    eventos: (evs || []).map((e: any) => ({ data: e.data, nome: e.nome })),
    bom, itens,
  });
}

// ---------------------------------------------------------------------------
// POST: config / flag / iniciar / decidir / encerrar / reabrir
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(user.bar_id);
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const quem = user.email ?? user.nome ?? null;

  switch (body.action) {
    case 'config': {
      const producaoId = Number(body.producao_id);
      if (!producaoId) return NextResponse.json({ success: false, error: 'producao_id obrigatório' }, { status: 400 });
      const patch: any = { bar_id: barId, producao_id: producaoId, producao_cod: body.producao_cod ?? null, atualizado_em: new Date().toISOString(), atualizado_por: quem };
      if (body.nivel_servico != null) patch.nivel_servico = Number(body.nivel_servico);
      if (body.semanas_receita != null) patch.semanas_receita = Number(body.semanas_receita);
      const { error } = await ops().from('producao_plano_config').upsert(patch, { onConflict: 'bar_id,producao_id' });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'flag': {
      const id = Number(body.producao_id);
      if (!id) return NextResponse.json({ success: false, error: 'producao_id obrigatório' }, { status: 400 });
      const { error } = await sb().from('producao_base').update({ controle_producao: !!body.controle_producao, atualizado_em: new Date().toISOString() }).eq('id', id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'iniciar': {
      const area = body.area === 'Bar' ? 'Bar' : 'Cozinha';
      const semanaIni = String(body.semana || '');
      if (!semanaIni) return NextResponse.json({ success: false, error: 'semana obrigatória' }, { status: 400 });
      // gate: só dá pra planejar a semana ATIVA (a mais recente com contagem). Anteriores = só consulta.
      const { data: sem } = await (sb() as any).schema('gold').rpc('fn_semanas_com_contagem', { p_bar: barId });
      const weeks = (sem || []).map((s: any) => s.semana_ini);
      if (!weeks.includes(semanaIni)) return NextResponse.json({ success: false, error: `A semana ${semanaIni.split('-').reverse().join('/')} ainda não fechou (sem contagem).` }, { status: 409 });
      if (semanaIni !== weeks[0]) return NextResponse.json({ success: false, error: `Só dá pra planejar a semana mais recente (${String(weeks[0]).split('-').reverse().join('/')}). Semanas anteriores são só consulta.` }, { status: 409 });
      const { data: plano, error } = await ops().from('producao_plano')
        .upsert({ bar_id: barId, semana_ini: semanaIni, area, status: 'rascunho', contagem_data: semanaIni, iniciado_por: quem }, { onConflict: 'bar_id,semana_ini,area' })
        .select().single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, plano });
    }
    case 'decidir': {
      const planoId = Number(body.plano_id);
      const producaoId = Number(body.producao_id);
      if (!planoId || !producaoId) return NextResponse.json({ success: false, error: 'plano_id e producao_id obrigatórios' }, { status: 400 });
      const row: any = {
        plano_id: planoId, producao_id: producaoId,
        producao_cod: body.producao_cod ?? null, producao_nome: body.producao_nome ?? null,
        media6: body.media6 ?? null, desvpad: body.desvpad ?? null,
        nivel_servico: body.nivel_servico ?? null, fator_servico: body.nivel_servico != null ? zDe(Number(body.nivel_servico)) : null,
        ponto_ressupr: body.ponto_ressupr ?? null, estoque: body.estoque ?? null,
        sugestao_qtd: body.sugestao_qtd ?? null, sugestao_receitas: body.sugestao_receitas ?? null,
        decidido_receitas: body.decidido_receitas != null ? Number(body.decidido_receitas) : null,
        decidido_qtd: body.decidido_qtd != null ? Number(body.decidido_qtd) : null,
        seguiu_sugestao: body.seguiu_sugestao != null ? !!body.seguiu_sugestao : true,
        motivo_override: body.motivo_override ?? null, dia_producao: body.dia_producao ?? null,
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await ops().from('producao_plano_item').upsert(row, { onConflict: 'plano_id,producao_id' });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'encerrar': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      const { data: plano } = await ops().from('producao_plano').select('*').eq('id', planoId).eq('bar_id', barId).single();
      if (!plano) return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
      // congela TODOS os itens da área: snapshot completo (sem recalcular depois)
      const live = await montarItensLive(barId, plano.semana_ini);
      const bom = await fetchBom(live);
      const { data: decs } = await ops().from('producao_plano_item').select('*').eq('plano_id', planoId);
      const decBy = new Map<number, any>((decs || []).map((d: any) => [Number(d.producao_id), d]));
      const consumo = calcConsumo(live, bom, decBy);
      const rows = live.filter((it) => areaDe(it.codigo) === plano.area).map((it) => {
        const d = decBy.get(it.producao_id) as any;
        const decididoRec = d?.decidido_receitas != null ? Number(d.decidido_receitas) : it.sugestao_receitas;
        return {
          plano_id: planoId, producao_id: it.producao_id, producao_cod: it.codigo, producao_nome: it.nome,
          media6: it.media6, desvpad: it.desvpad, nivel_servico: it.nivel_servico, fator_servico: zDe(it.nivel_servico),
          ponto_ressupr: it.pr, estoque: it.estoque, sugestao_qtd: it.sugestao_qtd, sugestao_receitas: it.sugestao_receitas,
          decidido_receitas: decididoRec, decidido_qtd: r2(decididoRec * it.rend_contagem),
          seguiu_sugestao: decididoRec === it.sugestao_receitas, motivo_override: d?.motivo_override ?? null,
          dia_producao: d?.dia_producao ?? null,
          unidade: it.unidade, rend_contagem: it.rend_contagem, semanas_receita: it.semanas_receita, curva_a: it.curva_a,
          consumo: r2(consumo.get(it.producao_id) || 0), saidas: it.saidas, semanas_datas: it.semanas,
          atualizado_em: new Date().toISOString(),
        };
      });
      if (rows.length) {
        const { error: e1 } = await ops().from('producao_plano_item').upsert(rows, { onConflict: 'plano_id,producao_id' });
        if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });
      }
      const { error } = await ops().from('producao_plano').update({ status: 'encerrado', encerrado_por: quem, encerrado_em: new Date().toISOString() }).eq('id', planoId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'reabrir': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      const { error } = await ops().from('producao_plano').update({ status: 'rascunho', encerrado_por: null, encerrado_em: null }).eq('id', planoId).eq('bar_id', barId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'cancelar': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      // apaga o plano e seus itens (cascade); usado p/ descartar um planejamento iniciado por engano
      const { error } = await ops().from('producao_plano').delete().eq('id', planoId).eq('bar_id', barId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  }
}
