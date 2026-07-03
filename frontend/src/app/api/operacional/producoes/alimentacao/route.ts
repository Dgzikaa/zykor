import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Alimentação da equipe (jantas dos funcionários). Diferente da execução de produção:
 * NÃO tem ficha técnica, rendimento nem peso mestre. A pessoa seleciona insumos direto,
 * informa a quantidade (em unidade-base g/ml/un), o preço vem do catálogo e gravamos a
 * refeição do dia + o tempo em operations.alimentacao_execucao (+ _insumo).
 *
 * O custo é snapshotado: custo_insumo = qtd(base) × preco_un(base). preco_un já vem
 * precificado da tela (silver.insumo_catalogo: preco/embalagem = preço por unidade-base).
 */

const round = (n: number, casas = 4) => {
  const f = Math.pow(10, casas);
  return Math.round((Number(n) || 0) * f) / f;
};

function computar(insumos: any[]) {
  let custoTotal = 0;
  const linhas = (Array.isArray(insumos) ? insumos : []).map((i) => {
    const precoUn = Number(i.preco_un) || 0;
    const qtd = i.qtd != null ? Number(i.qtd) : null;
    const custo = qtd != null ? qtd * precoUn : 0;
    custoTotal += custo;
    return {
      insumo_codigo: i.insumo_codigo ?? null,
      insumo_id_vmarket: i.insumo_id_vmarket != null ? Number(i.insumo_id_vmarket) : null,
      nome: i.nome ?? null,
      qtd,
      unidade: i.unidade ?? null,
      preco_un: precoUn,
      custo: round(custo, 4),
    };
  });
  return { linhas, custoTotal };
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const body = await request.json().catch(() => ({}));

  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const insumos: any[] = Array.isArray(body.insumos) ? body.insumos : [];
  if (!insumos.length) return NextResponse.json({ success: false, error: 'Selecione ao menos um insumo' }, { status: 400 });
  const { linhas, custoTotal } = computar(insumos);

  const dataRefeicao = String(body.data_refeicao || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const tipo = ['almoco', 'janta', 'ceia'].includes(String(body.tipo)) ? String(body.tipo) : 'janta';
  const durSeg = body.duracao_seg != null ? Math.round(Number(body.duracao_seg)) : null;
  const respId = body.responsavel_id != null ? Number(body.responsavel_id) : null;

  const supabase = await getAdminClient();

  // IDEMPOTÊNCIA (anti duplo/triplo submit — igual à execução de produção): se já existe uma
  // refeição idêntica (bar+data+tipo+responsável+duração) nos últimos 5 min, devolve ELA.
  const janelaIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentes } = await (supabase as any)
    .schema('operations')
    .from('alimentacao_execucao')
    .select('id, responsavel_id, duracao_seg, tipo, data_refeicao')
    .eq('bar_id', barId)
    .eq('data_refeicao', dataRefeicao)
    .gte('criado_em', janelaIso)
    .order('criado_em', { ascending: false })
    .limit(20);
  const dup = (recentes || []).find((e: any) =>
    e.tipo === tipo &&
    (e.duracao_seg ?? null) === durSeg &&
    (e.responsavel_id ?? null) === respId
  );
  if (dup) {
    return NextResponse.json({ success: true, execucao_id: dup.id, custo_total: round(custoTotal, 2), duplicada: true });
  }

  const { data: exec, error: errExec } = await (supabase as any)
    .schema('operations')
    .from('alimentacao_execucao')
    .insert({
      bar_id: barId,
      responsavel_id: respId,
      responsavel_nome: body.responsavel_nome ?? null,
      data_refeicao: dataRefeicao,
      tipo,
      num_pessoas: body.num_pessoas != null && body.num_pessoas !== '' ? Math.round(Number(body.num_pessoas)) : null,
      inicio: body.inicio ?? null,
      fim: body.fim ?? null,
      duracao_seg: durSeg,
      custo_total: round(custoTotal, 4),
      observacao: body.observacao ? String(body.observacao) : null,
      criado_por: user.email ?? user.nome ?? null,
    })
    .select('id')
    .single();
  if (errExec) return NextResponse.json({ success: false, error: errExec.message }, { status: 500 });

  const payload = linhas.map((l) => ({ ...l, execucao_id: exec.id }));
  const { error: errIns } = await (supabase as any)
    .schema('operations')
    .from('alimentacao_insumo')
    .insert(payload);
  if (errIns) {
    await (supabase as any).schema('operations').from('alimentacao_execucao').delete().eq('id', exec.id);
    return NextResponse.json({ success: false, error: errIns.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, execucao_id: exec.id, custo_total: round(custoTotal, 2) });
}

/**
 * DELETE ?id=&bar_id= — remove uma refeição (admin only). Cascata apaga os insumos.
 */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas admin pode excluir refeições' }, { status: 403 });
  }
  const sp = new URL(request.url).searchParams;
  const id = Number(sp.get('id'));
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!id || !barId) return NextResponse.json({ success: false, error: 'id e bar_id obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: alvo } = await (supabase as any)
    .schema('operations').from('alimentacao_execucao')
    .select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  if (!alvo) return NextResponse.json({ success: false, error: 'Refeição não encontrada neste bar' }, { status: 404 });

  const { error } = await (supabase as any).schema('operations').from('alimentacao_execucao').delete().eq('id', id).eq('bar_id', barId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted_id: id });
}

/**
 * GET — histórico das refeições. Filtros: bar_id (obrigatório), de, ate (por data_refeicao).
 * ?execucao_id= devolve os insumos de UMA refeição.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();

  const execId = sp.get('execucao_id');
  if (execId) {
    const { data: insumos, error } = await (supabase as any)
      .schema('operations')
      .from('alimentacao_insumo')
      .select('*')
      .eq('execucao_id', Number(execId))
      .order('id', { ascending: true });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, insumos: insumos || [] });
  }

  let q = (supabase as any)
    .schema('operations')
    .from('alimentacao_execucao')
    .select('*')
    .eq('bar_id', barId)
    .order('data_refeicao', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(500);
  if (sp.get('de')) q = q.gte('data_refeicao', sp.get('de'));
  if (sp.get('ate')) q = q.lte('data_refeicao', sp.get('ate'));

  const { data: execs, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, refeicoes: execs || [] });
}
