import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin, podeAprovar, registrarHistorico, comentarioSistema,
  STATUS_EDITAVEL_SOLICITANTE, type PedidoStatus,
} from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// POST — solicitante (ou financeiro) cancela o pedido enquanto ainda pendente
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;

  const supabase = await getAdminClient();
  const { data: pedido } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('id, bar_id, status, solicitante_id')
    .eq('id', id)
    .maybeSingle();

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }

  const ehDono = pedido.solicitante_id === user.auth_id;
  if (!ehDono && !podeAprovar(user)) {
    return permissionErrorResponse('Sem permissão para cancelar este pedido');
  }
  if (!STATUS_EDITAVEL_SOLICITANTE.includes(pedido.status as PedidoStatus)) {
    return NextResponse.json(
      { success: false, error: `Pedido não pode mais ser cancelado (status: ${pedido.status})` },
      { status: 409 }
    );
  }

  const { data, error } = await fin(supabase)
    .from('pedidos_pagamento')
    .update({ status: 'cancelado', atualizado_por: user.auth_id })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await registrarHistorico(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, autor: user, campo: 'status',
    valor_anterior: pedido.status, valor_novo: 'cancelado',
  });
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, mensagem: `Cancelado por ${user.nome}.`,
  });

  return NextResponse.json({ success: true, pedido: data });
}
