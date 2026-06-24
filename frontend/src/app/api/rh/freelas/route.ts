import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const STATUS = ['convocado', 'confirmado', 'recusado', 'compareceu', 'faltou'];

/** GET ?data=YYYY-MM-DD -> convocações do dia + pool de freelas (ativos). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const data = new URL(request.url).searchParams.get('data');
  if (!data) return NextResponse.json({ success: false, error: 'data obrigatória' }, { status: 400 });

  const supabase = await getAdminClient();
  const [{ data: convocacoes, error: e1 }, { data: pool, error: e2 }] = await Promise.all([
    (supabase as any).schema('hr').from('freela_convocacao').select('*').eq('bar_id', user.bar_id).eq('data', data),
    (supabase as any).schema('hr').from('funcionarios')
      .select('id, nome, area_id, valor_diaria, chave_pix, tipo_chave_pix')
      .eq('bar_id', user.bar_id).eq('ativo', true).eq('tipo_contratacao', 'Freela').order('nome'),
  ]);
  if (e1 || e2) return NextResponse.json({ success: false, error: (e1 || e2)?.message }, { status: 500 });
  return NextResponse.json({ success: true, convocacoes: convocacoes || [], pool: pool || [] });
}

/** POST -> convoca (sem id) ou atualiza (com id). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();

  if (body.id) {
    const patch: any = { atualizado_em: new Date().toISOString() };
    if (body.status && STATUS.includes(body.status)) patch.status = body.status;
    if (body.valor_diaria !== undefined) patch.valor_diaria = body.valor_diaria === '' || body.valor_diaria == null ? null : Number(body.valor_diaria);
    if (body.funcao !== undefined) patch.funcao = body.funcao || null;
    if (body.observacao !== undefined) patch.observacao = body.observacao || null;
    const { data: row, error } = await (supabase as any).schema('hr').from('freela_convocacao')
      .update(patch).eq('id', body.id).eq('bar_id', user.bar_id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, convocacao: row });
  }

  const funcionarioId = Number(body.funcionario_id);
  const data = String(body.data || '');
  if (!funcionarioId || !data) return NextResponse.json({ success: false, error: 'funcionario_id e data obrigatórios' }, { status: 400 });

  // valor_diaria default = o cadastrado no funcionário
  const { data: f } = await (supabase as any).schema('hr').from('funcionarios')
    .select('id, valor_diaria').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!f) return NextResponse.json({ success: false, error: 'Freela não encontrado' }, { status: 404 });

  const { data: row, error } = await (supabase as any).schema('hr').from('freela_convocacao').upsert({
    bar_id: user.bar_id, data, funcionario_id: funcionarioId, status: 'convocado',
    valor_diaria: body.valor_diaria != null && body.valor_diaria !== '' ? Number(body.valor_diaria) : f.valor_diaria,
    funcao: body.funcao || null,
  }, { onConflict: 'funcionario_id,data' }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, convocacao: row }, { status: 201 });
}

/** DELETE ?id= -> remove a convocação. */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('hr').from('freela_convocacao')
    .delete().eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
