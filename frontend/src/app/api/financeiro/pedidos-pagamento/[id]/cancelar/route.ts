import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin, podeAprovar, registrarHistorico, comentarioSistema,
  STATUS_EDITAVEL_SOLICITANTE, STATUS_CANCELAVEL_FINANCEIRO, STATUS_SUBIDO_INTER,
  type PedidoStatus,
} from '@/lib/financeiro/pedidos-pagamento';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

export const dynamic = 'force-dynamic';

// POST — cancela o pedido.
//  - Solicitante (dono): só enquanto pendente (rascunho/aguardando_aprovacao).
//  - Financeiro: também depois de aprovado/subido (aprovado/aguardando_socio/agendado/erro_*).
//    Se já foi SUBIDO ao Inter, tenta cancelar o agendamento no banco antes. O Conta Azul NÃO
//    tem API de exclusão — se houver lançamento, fica um aviso pra remover à mão.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;

  const supabase = await getAdminClient();
  const { data: pedido } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('id, bar_id, status, solicitante_id, tipo, inter_codigo_solicitacao, inter_credencial_id, contaazul_lancamento_id')
    .eq('id', id)
    .maybeSingle();

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }

  const ehDono = pedido.solicitante_id === user.auth_id;
  const ehFinanceiro = podeAprovar(user);
  if (!ehDono && !ehFinanceiro) {
    return permissionErrorResponse('Sem permissão para cancelar este pedido');
  }

  // O financeiro pode cancelar até depois de subido; o dono só enquanto pendente.
  const statusPermitidos: PedidoStatus[] = ehFinanceiro ? STATUS_CANCELAVEL_FINANCEIRO : STATUS_EDITAVEL_SOLICITANTE;
  if (!statusPermitidos.includes(pedido.status as PedidoStatus)) {
    return NextResponse.json(
      { success: false, error: `Pedido não pode mais ser cancelado (status: ${pedido.status})` },
      { status: 409 }
    );
  }

  // Já subido ao Inter → tenta desfazer o agendamento no banco ANTES de cancelar localmente.
  const subidoInter = STATUS_SUBIDO_INTER.includes(pedido.status as PedidoStatus) && !!pedido.inter_codigo_solicitacao;
  if (subidoInter) {
    const origin = new URL(request.url).origin;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const fwdAuth = request.headers.get('authorization');
    const fwdCookie = request.headers.get('cookie');
    const fwdBar = request.headers.get('x-selected-bar-id');
    if (fwdAuth) headers['authorization'] = fwdAuth;
    if (fwdCookie) headers['cookie'] = fwdCookie;
    if (fwdBar) headers['x-selected-bar-id'] = fwdBar;
    try {
      const r = await fetch(`${origin}/api/financeiro/inter/pix/cancelar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ codigo: pedido.inter_codigo_solicitacao, inter_credencial_id: pedido.inter_credencial_id }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        return NextResponse.json(
          { success: false, etapa: 'inter', error: `Não deu pra cancelar no Inter: ${d?.error || `HTTP ${r.status}`}. Se o sócio ainda não aprovou, recuse direto no app do Inter.` },
          { status: 400 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        { success: false, etapa: 'inter', error: `Falha ao falar com o Inter: ${e?.message || 'erro de rede'}.` },
        { status: 500 }
      );
    }
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
  const avisoCA = pedido.contaazul_lancamento_id
    ? ` ATENÇÃO: já havia lançamento no Conta Azul (${pedido.contaazul_lancamento_id}) — remova-o à mão (o CA não tem exclusão via API).`
    : '';
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id: pedido.bar_id,
    mensagem: `Cancelado por ${user.nome}.${subidoInter ? ' Agendamento cancelado no Inter.' : ''}${avisoCA}`,
  });

  await broadcastPedidoChange(pedido.bar_id);
  return NextResponse.json({ success: true, pedido: data });
}
