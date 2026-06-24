import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

async function checaFuncionario(supabase: any, id: number, barId: number) {
  const { data } = await supabase.schema('hr').from('funcionarios').select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  return !!data;
}

/** GET -> avaliações do funcionário (mais recentes primeiro). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { data, error } = await (supabase as any).schema('hr').from('avaliacoes')
    .select('*').eq('funcionario_id', Number(id)).order('criado_em', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, avaliacoes: data || [] });
}

/** POST -> cria avaliação. Body: { periodo, avaliador?, criterios:[{criterio,nota}], pontos_fortes?, pontos_desenvolver? } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.periodo) return NextResponse.json({ success: false, error: 'Período é obrigatório' }, { status: 400 });

  const criterios = Array.isArray(body.criterios) ? body.criterios.filter((c: any) => c && c.criterio) : [];
  const notas = criterios.map((c: any) => Number(c.nota)).filter((n: number) => n > 0);
  const notaGeral = notas.length ? Math.round((notas.reduce((a: number, b: number) => a + b, 0) / notas.length) * 100) / 100 : null;

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { data, error } = await (supabase as any).schema('hr').from('avaliacoes').insert({
    bar_id: user.bar_id, funcionario_id: Number(id), periodo: body.periodo,
    avaliador: body.avaliador || null, criterios, nota_geral: notaGeral,
    pontos_fortes: body.pontos_fortes || null, pontos_desenvolver: body.pontos_desenvolver || null,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, avaliacao: data }, { status: 201 });
}

/** DELETE ?avaliacao_id= */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const avId = new URL(request.url).searchParams.get('avaliacao_id');
  if (!avId) return NextResponse.json({ success: false, error: 'avaliacao_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { error } = await (supabase as any).schema('hr').from('avaliacoes')
    .delete().eq('id', avId).eq('funcionario_id', Number(id));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
