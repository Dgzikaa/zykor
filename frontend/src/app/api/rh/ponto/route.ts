import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?inicio=&fim= -> registros de ponto do período + funcionários ativos. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const inicio = sp.get('inicio'); const fim = sp.get('fim');
  if (!inicio || !fim) return NextResponse.json({ success: false, error: 'inicio e fim obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const [{ data: registros, error: e1 }, { data: funcionarios, error: e2 }] = await Promise.all([
    (supabase as any).schema('hr').from('ponto_registro').select('*')
      .eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim),
    (supabase as any).schema('hr').from('funcionarios')
      .select('id, nome, area_id, tipo_contratacao')
      .eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
  ]);
  if (e1 || e2) return NextResponse.json({ success: false, error: (e1 || e2)?.message }, { status: 500 });
  return NextResponse.json({ success: true, registros: registros || [], funcionarios: funcionarios || [] });
}

/** POST -> upsert (funcionario_id + data). Body: { funcionario_id, data, entrada?, saida?, intervalo_min?, horas_previstas?, observacao? } */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const funcionarioId = Number(body.funcionario_id);
  const data = String(body.data || '');
  if (!funcionarioId || !data) return NextResponse.json({ success: false, error: 'funcionario_id e data obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: f } = await (supabase as any).schema('hr').from('funcionarios')
    .select('id').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!f) return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });

  const { data: row, error } = await (supabase as any).schema('hr').from('ponto_registro').upsert({
    bar_id: user.bar_id, funcionario_id: funcionarioId, data,
    entrada: body.entrada || null, saida: body.saida || null,
    intervalo_min: body.intervalo_min != null && body.intervalo_min !== '' ? Number(body.intervalo_min) : 0,
    horas_previstas: body.horas_previstas != null && body.horas_previstas !== '' ? Number(body.horas_previstas) : 8,
    observacao: body.observacao || null, atualizado_em: new Date().toISOString(),
  }, { onConflict: 'funcionario_id,data' }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, registro: row });
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('hr').from('ponto_registro')
    .delete().eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
