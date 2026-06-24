import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const ETAPAS = ['inscrito', 'triagem', 'entrevista', 'aprovado', 'reprovado', 'contratado'];

async function checaVaga(supabase: any, vagaId: string, barId: number) {
  const { data } = await supabase.schema('hr').from('vagas').select('id, area_id, tipo_contratacao').eq('id', vagaId).eq('bar_id', barId).maybeSingle();
  return data;
}

/** GET -> candidatos da vaga. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaVaga(supabase, id, user.bar_id))) return NextResponse.json({ success: false, error: 'Vaga não encontrada' }, { status: 404 });
  const { data, error } = await (supabase as any).schema('hr').from('candidatos')
    .select('*').eq('vaga_id', id).order('criado_em');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, candidatos: data || [] });
}

/** POST -> adiciona (sem id), muda etapa (id+etapa) ou admite (id+admitir=true -> cria funcionário). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();
  const vaga = await checaVaga(supabase, id, user.bar_id);
  if (!vaga) return NextResponse.json({ success: false, error: 'Vaga não encontrada' }, { status: 404 });

  // Admitir: cria o funcionário a partir do candidato e marca como contratado.
  if (body.id && body.admitir) {
    const { data: cand } = await (supabase as any).schema('hr').from('candidatos')
      .select('*').eq('id', body.id).eq('vaga_id', id).maybeSingle();
    if (!cand) return NextResponse.json({ success: false, error: 'Candidato não encontrado' }, { status: 404 });
    if (cand.funcionario_id) return NextResponse.json({ success: false, error: 'Candidato já foi admitido' }, { status: 400 });

    const hoje = new Date().toISOString().slice(0, 10);
    const { data: novoFunc, error: eF } = await (supabase as any).schema('hr').from('funcionarios').insert({
      bar_id: user.bar_id, nome: cand.nome, telefone: cand.telefone || null, email: cand.email || null,
      tipo_contratacao: vaga.tipo_contratacao || 'CLT', area_id: vaga.area_id || null,
      data_admissao: hoje, ativo: true,
    }).select('id').single();
    if (eF) return NextResponse.json({ success: false, error: eF.message }, { status: 500 });

    const { data, error } = await (supabase as any).schema('hr').from('candidatos')
      .update({ etapa: 'contratado', funcionario_id: novoFunc.id }).eq('id', body.id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, candidato: data, funcionario_id: novoFunc.id });
  }

  // Mudar etapa / observação
  if (body.id) {
    const patch: any = {};
    if (body.etapa && ETAPAS.includes(body.etapa)) patch.etapa = body.etapa;
    if (body.observacao !== undefined) patch.observacao = body.observacao || null;
    const { data, error } = await (supabase as any).schema('hr').from('candidatos')
      .update(patch).eq('id', body.id).eq('vaga_id', id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, candidato: data });
  }

  // Novo candidato
  if (!body.nome?.trim()) return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 });
  const { data, error } = await (supabase as any).schema('hr').from('candidatos').insert({
    bar_id: user.bar_id, vaga_id: id, nome: body.nome.trim(), telefone: body.telefone || null, email: body.email || null,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, candidato: data }, { status: 201 });
}

/** DELETE ?candidato_id= */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const candId = new URL(request.url).searchParams.get('candidato_id');
  if (!candId) return NextResponse.json({ success: false, error: 'candidato_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  if (!(await checaVaga(supabase, id, user.bar_id))) return NextResponse.json({ success: false, error: 'Vaga não encontrada' }, { status: 404 });
  const { error } = await (supabase as any).schema('hr').from('candidatos').delete().eq('id', candId).eq('vaga_id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
