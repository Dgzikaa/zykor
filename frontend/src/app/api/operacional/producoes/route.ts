import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** Cadastro de produções (preparos internos). CRUD master. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .from('producao_base')
    .select('id,codigo,nome,unidade,rendimento,secao,ativo,observacao,atualizado_em')
    .eq('bar_id', barId)
    .order('nome', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // contagem de itens da ficha por produção
  const ids = (data || []).map((p) => p.id);
  const contagem: Record<number, number> = {};
  if (ids.length) {
    const { data: itens } = await supabase.from('producao_ficha_item').select('producao_id').in('producao_id', ids);
    (itens || []).forEach((i: any) => { contagem[i.producao_id] = (contagem[i.producao_id] || 0) + 1; });
  }
  return NextResponse.json({ success: true, producoes: (data || []).map((p) => ({ ...p, qtd_componentes: contagem[p.id] || 0 })) });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const nome = String(body.nome || '').trim();
  if (!nome) return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const payload = {
    bar_id: barId, nome,
    codigo: body.codigo ? String(body.codigo).trim() : null,
    unidade: body.unidade ? String(body.unidade) : 'un',
    rendimento: body.rendimento != null ? Number(body.rendimento) : 1,
    secao: body.secao ? String(body.secao) : null,
    observacao: body.observacao ? String(body.observacao) : null,
  };
  const { data, error } = await supabase.from('producao_base').insert(payload).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, producao: data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const patch: any = { atualizado_em: new Date().toISOString() };
  for (const k of ['nome', 'codigo', 'unidade', 'secao', 'observacao', 'ativo']) if (k in body) patch[k] = body[k];
  if ('rendimento' in body) patch.rendimento = Number(body.rendimento);
  const { data, error } = await supabase.from('producao_base').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, producao: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await supabase.from('producao_base').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
