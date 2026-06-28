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

// De/para Nível de Serviço → Fator de Serviço (z-score da normal), igual à planilha do sócio.
const NIVEL_Z: Record<number, number> = {
  50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282,
  95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1,
};
const zDe = (nivel: number) => NIVEL_Z[nivel] ?? 1.645;

// Ponto de Ressuprimento + Sugestão de Produção (fórmulas exatas da planilha do sócio).
// AE (Sugestão Produção) = IF((PR−Estoque)<0; PR−Estoque; (PR−Estoque) + PR×(Semanas−1))
// AF (Sug Receitas)      = ROUNDUP(AE / rendimento)   [<=0 → "Não Produzir"]
function calcular(media6: number, desvpad: number, estoque: number, rendContagem: number, nivel: number, semanas: number) {
  const pr = media6 + desvpad * zDe(nivel);
  const gap = pr - estoque;
  const ae = gap < 0 ? gap : gap + pr * ((semanas || 1) - 1); // cada semana extra repõe um PR cheio
  const naoProduzir = ae <= 0;
  const receitas = !naoProduzir && rendContagem > 0 ? Math.ceil(ae / rendContagem) : 0;
  const sugestaoQtd = receitas * rendContagem;
  return { pr: r2(pr), naoProduzir, receitas, sugestaoQtd: r2(sugestaoQtd) };
}

// Média 6 semanas PONDERADA por recência (pesos 1..6, oldest→newest), só semanas >0 — igual à planilha.
function mediaPonderada(saidas: number[]) {
  let num = 0, den = 0;
  saidas.forEach((v, i) => { if (v > 0) { num += v * (i + 1); den += (i + 1); } });
  return den > 0 ? num / den : 0;
}
// Desvio padrão amostral (n−1) com média SIMPLES = STDEV(T:Y) da planilha (independe da média ponderada).
function desvioPadrao(saidas: number[]) {
  const n = saidas.length;
  if (n < 2) return 0;
  const m = saidas.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(saidas.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
}

// próxima semana (segunda → domingo)
function proximaSemana() {
  const hoje = new Date();
  const dow = (hoje.getDay() + 6) % 7;
  const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow + 7);
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
  return { ini: isoD(ini), fim: isoD(fim) };
}

// ---------------------------------------------------------------------------
// GET: planejamento da próxima semana (sugestões ao vivo) + config + sessão.
//   ?hoje=1  → planejado para HOJE (calendarização do plano encerrado) p/ o Controle de Produção.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  // ---- planejado para hoje (Controle de Produção) ----
  if (new URL(request.url).searchParams.get('hoje')) {
    const hoje = isoD(new Date());
    const { data: planos } = await ops().from('producao_plano')
      .select('id, semana_ini').eq('bar_id', barId).eq('status', 'encerrado')
      .order('semana_ini', { ascending: false }).limit(4);
    const ids = (planos || []).map((p: any) => p.id);
    if (!ids.length) return NextResponse.json({ success: true, data: hoje, itens: [] });
    const { data: itens } = await ops().from('producao_plano_item')
      .select('producao_id, producao_cod, producao_nome, decidido_receitas, decidido_qtd, sugestao_qtd, dia_producao')
      .in('plano_id', ids).eq('dia_producao', hoje);
    return NextResponse.json({ success: true, data: hoje, itens: itens || [] });
  }

  const semana = proximaSemana();

  // Estoque vem da contagem do INÍCIO da semana planejada (>= segunda). Sem ela, estoque = 0.
  const gold = (sb() as any).schema('gold');
  const { data, error } = await gold.rpc('fn_plano_producao', { p_bar: barId, p_estoque_desde: semana.ini });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // contexto: eventos + contagem da semana planejada (gate de início) + sessões por área
  const [{ data: evs }, { data: cont }, { data: cfgs }, { data: planosRows }] = await Promise.all([
    ops().from('feriados_eventos').select('data,nome').gte('data', semana.ini).lte('data', semana.fim),
    (sb() as any).schema('silver').from('estoque_contagem').select('data_contagem').eq('bar_id', barId)
      .gte('data_contagem', semana.ini).order('data_contagem', { ascending: false }).limit(1),
    ops().from('producao_plano_config').select('producao_id, nivel_servico, semanas_receita').eq('bar_id', barId),
    ops().from('producao_plano').select('*').eq('bar_id', barId).eq('semana_ini', semana.ini),
  ]);

  const cfgMap = new Map((cfgs || []).map((c: any) => [Number(c.producao_id), c]));

  // sessões separadas Cozinha × Bar (ciclo independente)
  const planos: Record<string, any> = { Cozinha: null, Bar: null };
  (planosRows || []).forEach((p: any) => { planos[p.area || 'Cozinha'] = p; });

  // decisões já salvas (de qualquer uma das sessões — cada produção é de uma área só)
  let decMap = new Map<number, any>();
  const planoIds = (planosRows || []).map((p: any) => p.id);
  if (planoIds.length) {
    const { data: items } = await ops().from('producao_plano_item').select('*').in('plano_id', planoIds);
    decMap = new Map((items || []).map((it: any) => [Number(it.producao_id), it]));
  }

  const itens = ((data || []) as any[]).map((r) => {
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
      decisao: decMap.get(Number(r.producao_id)) || null,
    };
  });

  // BOM (pai → filho) p/ a cascata de demanda dependente ("massa baseada na sugestão da porção").
  // qtd_receita = quantidade do filho (na unidade de contagem do filho) consumida por 1 receita/fornada do pai.
  const idFator = new Map(itens.map((i) => [i.producao_id, i.fator]));
  const ids = new Set(itens.map((i) => i.producao_id));
  const { data: fichaProd } = await sb().from('producao_ficha_item')
    .select('producao_id, producao_ref, quantidade').eq('componente_tipo', 'producao').not('producao_ref', 'is', null);
  const bom = ((fichaProd || []) as any[])
    .filter((f) => ids.has(Number(f.producao_id)) && ids.has(Number(f.producao_ref)))
    .map((f) => ({ pai: Number(f.producao_id), filho: Number(f.producao_ref), qtd_receita: r2(num(f.quantidade) / (Number(idFator.get(Number(f.producao_ref))) || 1)) }));

  return NextResponse.json({
    success: true,
    semana,
    contagem: { data: cont?.[0]?.data_contagem || null },
    planos,
    eventos: (evs || []).map((e: any) => ({ data: e.data, nome: e.nome })),
    bom,
    itens,
  });
}

// ---------------------------------------------------------------------------
// POST: ações do ciclo de planejamento.
//   action='config'   → salva Nível de Serviço / Semanas de Receita por produção
//   action='flag'     → liga/desliga "entra no controle de produção" (producao_base)
//   action='iniciar'  → abre a sessão da próxima semana (gate: contagem feita)
//   action='decidir'  → salva a decisão de um item (snapshot + decidido + dia de produção)
//   action='encerrar' → fecha o planejamento (gera a calendarização)
//   action='reabrir'  → volta pra rascunho
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
      const semana = proximaSemana();
      const { data: cont } = await (sb() as any).schema('silver').from('estoque_contagem')
        .select('data_contagem').eq('bar_id', barId).gte('data_contagem', semana.ini)
        .order('data_contagem', { ascending: false }).limit(1);
      const contagemData = cont?.[0]?.data_contagem || null;
      if (!contagemData) return NextResponse.json({ success: false, error: `Faça a contagem das produções de ${semana.ini.split('-').reverse().join('/')} (início da semana) antes de iniciar o planejamento.` }, { status: 409 });
      const { data: plano, error } = await ops().from('producao_plano')
        .upsert({ bar_id: barId, semana_ini: semana.ini, area, status: 'rascunho', contagem_data: contagemData, iniciado_por: quem }, { onConflict: 'bar_id,semana_ini,area' })
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
        motivo_override: body.motivo_override ?? null,
        dia_producao: body.dia_producao ?? null,
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await ops().from('producao_plano_item').upsert(row, { onConflict: 'plano_id,producao_id' });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    case 'encerrar':
    case 'reabrir': {
      const planoId = Number(body.plano_id);
      if (!planoId) return NextResponse.json({ success: false, error: 'plano_id obrigatório' }, { status: 400 });
      const encerrar = body.action === 'encerrar';
      const { error } = await ops().from('producao_plano').update(
        encerrar
          ? { status: 'encerrado', encerrado_por: quem, encerrado_em: new Date().toISOString() }
          : { status: 'rascunho', encerrado_por: null, encerrado_em: null }
      ).eq('id', planoId).eq('bar_id', barId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  }
}
