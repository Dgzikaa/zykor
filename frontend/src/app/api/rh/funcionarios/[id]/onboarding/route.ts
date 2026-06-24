import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

// Checklist padrão de admissão (semeado no 1º acesso).
const PADRAO = [
  'Documentos pessoais (RG/CPF) recebidos',
  'Carteira de trabalho',
  'Exame admissional',
  'Contrato assinado',
  'Dados bancários / chave PIX',
  'Treinamento de integração',
  'Uniforme entregue',
  'Acesso aos sistemas / ponto',
];

async function checaFuncionario(supabase: any, id: number, barId: number) {
  const { data } = await supabase.schema('hr').from('funcionarios').select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  return !!data;
}

/** GET -> itens de onboarding (semeia os padrão se ainda não houver nenhum). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  let { data } = await (supabase as any).schema('hr').from('onboarding_itens')
    .select('*').eq('funcionario_id', Number(id)).order('ordem');
  if (!data || data.length === 0) {
    await (supabase as any).schema('hr').from('onboarding_itens').insert(
      PADRAO.map((item, i) => ({ bar_id: user.bar_id, funcionario_id: Number(id), item, ordem: i }))
    ).then(() => {});
    const r = await (supabase as any).schema('hr').from('onboarding_itens')
      .select('*').eq('funcionario_id', Number(id)).order('ordem');
    data = r.data;
  }
  return NextResponse.json({ success: true, itens: data || [] });
}

/** POST -> toggle (com id) ou adiciona item custom (sem id). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  if (body.id) {
    const concluido = !!body.concluido;
    const { data, error } = await (supabase as any).schema('hr').from('onboarding_itens')
      .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null })
      .eq('id', body.id).eq('funcionario_id', Number(id)).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, item: data });
  }

  if (!body.item?.trim()) return NextResponse.json({ success: false, error: 'item obrigatório' }, { status: 400 });
  const { data, error } = await (supabase as any).schema('hr').from('onboarding_itens').insert({
    bar_id: user.bar_id, funcionario_id: Number(id), item: body.item.trim(), ordem: 99,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data }, { status: 201 });
}

/** DELETE ?item_id= */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const itemId = new URL(request.url).searchParams.get('item_id');
  if (!itemId) return NextResponse.json({ success: false, error: 'item_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const { error } = await (supabase as any).schema('hr').from('onboarding_itens')
    .delete().eq('id', itemId).eq('funcionario_id', Number(id));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
