import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const STATUS = ['aberta', 'pausada', 'fechada'];

/** GET -> vagas do bar + contagem de candidatos por vaga. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: vagas, error } = await (supabase as any).schema('hr').from('vagas')
    .select('*').eq('bar_id', user.bar_id).order('criado_em', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const ids = (vagas || []).map((v: any) => v.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: cands } = await (supabase as any).schema('hr').from('candidatos')
      .select('vaga_id, etapa').in('vaga_id', ids);
    for (const c of cands || []) if (c.etapa !== 'reprovado') counts[c.vaga_id] = (counts[c.vaga_id] || 0) + 1;
  }
  return NextResponse.json({ success: true, vagas: (vagas || []).map((v: any) => ({ ...v, candidatos: counts[v.id] || 0 })) });
}

/** POST -> cria (sem id) ou atualiza status/dados (com id). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();

  if (body.id) {
    const patch: any = {};
    if (body.status && STATUS.includes(body.status)) patch.status = body.status;
    if (body.titulo) patch.titulo = body.titulo;
    if (body.descricao !== undefined) patch.descricao = body.descricao || null;
    const { data, error } = await (supabase as any).schema('hr').from('vagas')
      .update(patch).eq('id', body.id).eq('bar_id', user.bar_id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, vaga: data });
  }

  if (!body.titulo?.trim()) return NextResponse.json({ success: false, error: 'Título obrigatório' }, { status: 400 });
  const { data, error } = await (supabase as any).schema('hr').from('vagas').insert({
    bar_id: user.bar_id, titulo: body.titulo.trim(), area_id: body.area_id ? Number(body.area_id) : null,
    tipo_contratacao: body.tipo_contratacao || null, descricao: body.descricao || null,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vaga: data }, { status: 201 });
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('hr').from('vagas').delete().eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
