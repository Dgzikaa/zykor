import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { fin, podeAprovar } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// POST — adiciona comentário na thread (solicitante ou financeiro)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const mensagem = String(body.mensagem || '').trim();
  if (!mensagem) {
    return NextResponse.json({ success: false, error: 'mensagem vazia' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data: pedido } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('id, bar_id, solicitante_id')
    .eq('id', id)
    .maybeSingle();

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  if (!podeAprovar(user) && pedido.solicitante_id !== user.auth_id) {
    return permissionErrorResponse('Sem acesso a este pedido');
  }

  const { data, error } = await fin(supabase)
    .from('pedidos_pagamento_comentarios')
    .insert({
      pedido_id: id,
      bar_id: pedido.bar_id,
      autor_id: user.auth_id,
      autor_nome: user.nome,
      mensagem,
      tipo: 'comentario',
    })
    .select()
    .single();

  if (error) {
    console.error('[PEDIDOS-PAG][COMENT]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, comentario: data });
}
