import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { fin, podeAprovar, registrarHistorico, comentarioSistema } from '@/lib/financeiro/pedidos-pagamento';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

export const dynamic = 'force-dynamic';

// POST — financeiro rejeita o pedido (motivo obrigatório)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAprovar(user)) return permissionErrorResponse('Apenas o financeiro pode rejeitar pedidos');
  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const motivo = String(body.motivo || '').trim();
  if (!motivo) {
    return NextResponse.json({ success: false, error: 'motivo da rejeição é obrigatório' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data: pedido } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('id, bar_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  // Não rejeita o que já foi pra frente (agendado/pago).
  if (['agendado', 'pago', 'rejeitado', 'cancelado'].includes(pedido.status)) {
    return NextResponse.json(
      { success: false, error: `Pedido não pode ser rejeitado (status: ${pedido.status})` },
      { status: 409 }
    );
  }

  const { data, error } = await fin(supabase)
    .from('pedidos_pagamento')
    .update({
      status: 'rejeitado',
      motivo_rejeicao: motivo,
      rejeitado_por_id: user.auth_id,
      rejeitado_por_nome: user.nome,
      rejeitado_em: new Date().toISOString(),
      atualizado_por: user.auth_id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await registrarHistorico(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, autor: user, campo: 'status',
    valor_anterior: pedido.status, valor_novo: 'rejeitado',
  });
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id: pedido.bar_id,
    mensagem: `Rejeitado por ${user.nome}. Motivo: ${motivo}`,
  });

  await broadcastPedidoChange(pedido.bar_id);
  return NextResponse.json({ success: true, pedido: data });
}
