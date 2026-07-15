import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  registrarHistorico,
  comentarioSistema,
  type PedidoPagamento,
} from '@/lib/financeiro/pedidos-pagamento';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

export const dynamic = 'force-dynamic';

// =====================================================
// POST — Marca o pedido como PAGO manualmente.
//   Uso principal: PIX copia e cola / QR (Meta Ads etc.), que NÃO passa pelo Inter
//   automático — o sócio cola o código no app do Inter e aqui confirma o pagamento.
//   Também serve pra fechar qualquer pedido 'aprovado'/'agendado' pago fora do fluxo.
// =====================================================
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAprovar(user)) return permissionErrorResponse('Apenas o financeiro pode marcar como pago');
  const { id } = await params;

  const supabase = await getAdminClient();
  const { data: pedido } = (await fin(supabase)
    .from('pedidos_pagamento')
    .select('*')
    .eq('id', id)
    .maybeSingle()) as { data: PedidoPagamento | null };

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  // Fecha manualmente qualquer pedido já em andamento pós-aprovação (inclui os subidos ao Inter
  // aguardando o sócio e os agendados) — cobre copia-e-cola/boleto pagos fora do webhook.
  if (!['aprovado', 'aguardando_socio', 'agendado'].includes(pedido.status)) {
    return NextResponse.json(
      { success: false, error: `Só dá pra marcar como pago um pedido aprovado/agendado (status atual: ${pedido.status})` },
      { status: 409 }
    );
  }

  const { data: atualizado } = await fin(supabase)
    .from('pedidos_pagamento')
    .update({
      status: 'pago',
      pago_em: new Date().toISOString(),
      atualizado_por: user.auth_id,
    })
    .eq('id', id)
    .select()
    .single();

  await registrarHistorico(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, autor: user, campo: 'status',
    valor_anterior: pedido.status, valor_novo: 'pago',
  });
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id: pedido.bar_id,
    mensagem: `Marcado como pago por ${user.nome}.`,
  });

  await broadcastPedidoChange(pedido.bar_id);
  return NextResponse.json({ success: true, pedido: atualizado });
}
