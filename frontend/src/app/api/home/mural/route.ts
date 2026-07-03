import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

// Quem pode deixar recado no mural: admin e gerente (manager).
function podeMural(role: string): boolean {
  return role === 'admin' || role === 'manager';
}

/** Deixar um recado no mural da casa. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeMural(user.role)) return permissionErrorResponse('Apenas gestores podem deixar recados no mural');

  const body = await request.json().catch(() => ({}));
  const mensagem = String(body.mensagem || '').trim();
  if (!mensagem) return NextResponse.json({ success: false, error: 'Escreva um recado' }, { status: 400 });
  if (mensagem.length > 500) return NextResponse.json({ success: false, error: 'Recado muito longo (máx. 500)' }, { status: 400 });

  // bar_id: por padrão o bar do autor; body.global=true grava pra todos os bares (bar_id null)
  const barId = body.global ? null : user.bar_id;
  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .from('mural_avisos')
    .insert({
      bar_id: barId,
      autor_id: user.auth_id,
      autor_nome: user.nome || user.email,
      mensagem,
      fixado: !!body.fixado,
    })
    .select('id, bar_id, autor_nome, mensagem, fixado, criado_em')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, aviso: data });
}

/** Remover um recado (autor ou admin). Soft-delete (ativo=false). */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: aviso } = await supabase
    .schema('operations')
    .from('mural_avisos')
    .select('autor_id')
    .eq('id', id)
    .maybeSingle();
  if (!aviso) return NextResponse.json({ success: false, error: 'Recado não encontrado' }, { status: 404 });
  // só o autor ou um admin remove
  if (user.role !== 'admin' && aviso.autor_id !== user.auth_id) {
    return permissionErrorResponse('Você só pode remover os seus próprios recados');
  }

  const { error } = await supabase
    .schema('operations')
    .from('mural_avisos')
    .update({ ativo: false })
    .eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
