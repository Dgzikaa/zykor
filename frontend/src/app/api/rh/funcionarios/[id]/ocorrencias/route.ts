import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const TIPOS = ['advertencia', 'falta', 'atestado', 'ferias', 'observacao'];

async function checaFuncionario(supabase: any, id: number, barId: number) {
  const { data } = await supabase.schema('hr').from('funcionarios').select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  return !!data;
}

/** GET -> ocorrências do funcionário (advertência/falta/atestado/férias/obs). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { data, error } = await (supabase as any).schema('hr').from('funcionario_ocorrencias')
    .select('*').eq('funcionario_id', Number(id)).order('data_inicio', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ocorrencias: data || [] });
}

/** POST -> adiciona ocorrência. Body: { tipo, data_inicio, data_fim?, descricao? } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!TIPOS.includes(body.tipo)) return NextResponse.json({ success: false, error: 'Tipo inválido' }, { status: 400 });
  if (!body.data_inicio) return NextResponse.json({ success: false, error: 'Data é obrigatória' }, { status: 400 });

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { data, error } = await (supabase as any).schema('hr').from('funcionario_ocorrencias').insert({
    funcionario_id: Number(id), tipo: body.tipo, data_inicio: body.data_inicio,
    data_fim: body.data_fim || null, descricao: body.descricao || null, created_by: user.id,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ocorrencia: data }, { status: 201 });
}

/** DELETE ?ocorrencia_id= -> remove. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const ocorrId = new URL(request.url).searchParams.get('ocorrencia_id');
  if (!ocorrId) return NextResponse.json({ success: false, error: 'ocorrencia_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { error } = await (supabase as any).schema('hr').from('funcionario_ocorrencias')
    .delete().eq('id', ocorrId).eq('funcionario_id', Number(id));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
