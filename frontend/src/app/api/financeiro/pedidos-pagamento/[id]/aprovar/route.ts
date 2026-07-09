import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  registrarHistorico,
  comentarioSistema,
  formatBRL,
  STATUS_APROVAVEL,
  type PedidoPagamento,
  type PedidoStatus,
} from '@/lib/financeiro/pedidos-pagamento';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

export const dynamic = 'force-dynamic';

/**
 * POST — APROVAR (decisão). Etapa 1 de 2:
 *  - valida que o vínculo CA/Inter está completo (categoria, fornecedor, conta, credencial);
 *  - grava o vínculo e marca status = 'aprovado'.
 *  - NÃO cria nada no Conta Azul nem dispara o PIX no Inter — isso é o AGENDAR (etapa 2),
 *    feito depois por um clique no botão "Agendar" na aba Aprovado.
 *
 * O financeiro completa o vínculo no corpo da aprovação:
 *   categoria_id, conta_financeira_id, contaazul_pessoa_id, inter_credencial_id
 *   (+ opcionais centro_custo_id/nome, categoria_nome).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAprovar(user)) return permissionErrorResponse('Apenas o financeiro pode aprovar pedidos');
  const { id } = await params;

  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }

  const supabase = await getAdminClient();
  const { data: pedido } = (await fin(supabase)
    .from('pedidos_pagamento')
    .select('*')
    .eq('id', id)
    .maybeSingle()) as { data: PedidoPagamento | null };

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  if (!STATUS_APROVAVEL.includes(pedido.status as PedidoStatus)) {
    return NextResponse.json(
      { success: false, error: `Pedido não pode ser aprovado (status atual: ${pedido.status})` },
      { status: 409 }
    );
  }

  // Vínculo CA enviado na aprovação.
  const vinculo: Record<string, unknown> = {};
  for (const c of [
    'categoria_id', 'categoria_nome', 'centro_custo_id', 'centro_custo_nome',
    'contaazul_pessoa_id', 'conta_financeira_id', 'inter_credencial_id',
  ]) {
    if (c in body && body[c] != null && body[c] !== '') vinculo[c] = body[c];
  }
  const p = { ...pedido, ...vinculo } as PedidoPagamento;
  const ehBoleto = !!p.linha_digitavel;
  const ehCopiaCola = !ehBoleto && !!p.pix_copia_cola;

  // Conta pagadora PADRÃO do bar quando não veio nenhuma (a credencial Inter é derivada
  // dela logo abaixo). Ordinário → Ordinário Inter; Descubra → Descubra Inter.
  if (!p.conta_financeira_id) {
    const { data: cp } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('contaazul_id').eq('bar_id', pedido.bar_id).eq('pagadora_padrao', true).maybeSingle();
    if (cp?.contaazul_id) { p.conta_financeira_id = cp.contaazul_id; vinculo.conta_financeira_id = cp.contaazul_id; }
  }

  // A CONTA PAGADORA manda na credencial Inter (Ordinário Inter → cred Ordinário; OrdiBar → OrdiBar;
  // Descubra → Descubra). Sobrepõe o padrão do bar — senão paga sempre da mesma empresa.
  if (p.conta_financeira_id && !ehCopiaCola) {
    const { data: contaMap } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('inter_credencial_id')
      .eq('bar_id', pedido.bar_id)
      .eq('contaazul_id', String(p.conta_financeira_id))
      .maybeSingle();
    const cred = Number(contaMap?.inter_credencial_id);
    if (cred && cred !== Number(p.inter_credencial_id)) {
      p.inter_credencial_id = cred;
      vinculo.inter_credencial_id = cred;
    }
  }

  // Valida o que o CA/Inter vão exigir no AGENDAR — aprovar só se estiver pronto pra agendar.
  const faltando: string[] = [];
  if (!p.categoria_id) faltando.push('categoria');
  if (!p.conta_financeira_id) faltando.push('conta financeira pagadora');
  if (!p.contaazul_pessoa_id) faltando.push('contato/fornecedor no Conta Azul');
  if (!ehCopiaCola && !p.inter_credencial_id) faltando.push('credencial Inter');
  if (ehBoleto) { if (!p.linha_digitavel) faltando.push('linha digitável'); }
  else if (!ehCopiaCola && !p.chave_pix) faltando.push('chave PIX');
  if (faltando.length) {
    return NextResponse.json(
      { success: false, error: `Complete antes de aprovar: ${faltando.join(', ')}.` },
      { status: 400 }
    );
  }

  // Grava vínculo + carimbo de aprovação. Status = 'aprovado' (ainda NÃO agendado).
  const updates: Record<string, unknown> = {
    ...vinculo,
    status: 'aprovado',
    aprovado_por_id: user.auth_id,
    aprovado_por_nome: user.nome,
    aprovado_em: new Date().toISOString(),
    atualizado_por: user.auth_id,
  };
  const { data: atualizado } = await fin(supabase)
    .from('pedidos_pagamento')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  for (const [campo, valor] of Object.entries(vinculo)) {
    await registrarHistorico(supabase, {
      pedido_id: id, bar_id: pedido.bar_id, autor: user, campo,
      valor_anterior: (pedido as any)[campo], valor_novo: valor,
    });
  }
  await registrarHistorico(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, autor: user, campo: 'status',
    valor_anterior: pedido.status, valor_novo: 'aprovado',
  });
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id: pedido.bar_id,
    mensagem: `Aprovado por ${user.nome} — ${formatBRL(p.valor)}. Pronto pra agendar (clique em "Agendar" pra criar no Conta Azul e disparar o PIX no Inter).`,
  });

  await broadcastPedidoChange(pedido.bar_id);
  return NextResponse.json({ success: true, pedido: atualizado });
}
