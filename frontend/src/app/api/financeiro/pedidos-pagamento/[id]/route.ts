import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  registrarHistorico,
  STATUS_EDITAVEL_SOLICITANTE,
  type PedidoPagamento,
  type PedidoStatus,
} from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

async function carregarPedido(supabase: any, id: string): Promise<PedidoPagamento | null> {
  const { data } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data || null;
}

// Campos que o financeiro pode editar; o solicitante só os "de pedido".
const CAMPOS_SOLICITANTE = [
  'descricao', 'valor', 'data_competencia', 'data_vencimento',
  'beneficiario_nome', 'chave_pix', 'cpf_cnpj', 'observacao', 'tipo',
];
const CAMPOS_FINANCEIRO = [
  ...CAMPOS_SOLICITANTE,
  'categoria_id', 'categoria_nome', 'centro_custo_id', 'centro_custo_nome',
  'contaazul_pessoa_id', 'conta_financeira_id', 'inter_credencial_id',
];

// =====================================================
// GET — detalhe + comentários + anexos + histórico
// =====================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;

  const supabase = await getAdminClient();
  const pedido = await carregarPedido(supabase, id);
  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }

  // Solicitante só vê o próprio; financeiro vê todos do bar.
  if (!podeAprovar(user) && pedido.solicitante_id !== user.auth_id) {
    return permissionErrorResponse('Sem acesso a este pedido');
  }

  const [comentarios, anexos, historico] = await Promise.all([
    fin(supabase).from('pedidos_pagamento_comentarios').select('*').eq('pedido_id', id).order('created_at', { ascending: true }),
    fin(supabase).from('pedidos_pagamento_anexos').select('*').eq('pedido_id', id).order('created_at', { ascending: true }),
    fin(supabase).from('pedidos_pagamento_historico').select('*').eq('pedido_id', id).order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    success: true,
    pedido,
    comentarios: comentarios.data || [],
    anexos: anexos.data || [],
    historico: historico.data || [],
    pode_aprovar: podeAprovar(user),
  });
}

// =====================================================
// PUT — edita campos (solicitante enquanto pendente; financeiro sempre)
//   grava cada mudança no histórico
// =====================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;

  const supabase = await getAdminClient();
  const pedido = await carregarPedido(supabase, id);
  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }

  const ehFinanceiro = podeAprovar(user);
  const ehDono = pedido.solicitante_id === user.auth_id;
  if (!ehFinanceiro && !ehDono) {
    return permissionErrorResponse('Sem permissão para editar este pedido');
  }
  // Solicitante só edita enquanto o pedido está pendente/rascunho.
  if (!ehFinanceiro && !STATUS_EDITAVEL_SOLICITANTE.includes(pedido.status as PedidoStatus)) {
    return permissionErrorResponse('Pedido já está em processamento e não pode mais ser editado por você');
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const camposPermitidos = ehFinanceiro ? CAMPOS_FINANCEIRO : CAMPOS_SOLICITANTE;
  const updates: Record<string, unknown> = {};
  for (const campo of camposPermitidos) {
    if (campo in body && body[campo] !== (pedido as any)[campo]) {
      updates[campo] = body[campo];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, pedido, alterado: false });
  }

  // Validação leve de valor
  if ('valor' in updates) {
    const v = Number(updates.valor);
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json({ success: false, error: 'valor inválido' }, { status: 400 });
    }
    updates.valor = Math.round(v * 100) / 100;
  }

  updates.atualizado_por = user.auth_id;

  const { data, error } = await fin(supabase)
    .from('pedidos_pagamento')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[PEDIDOS-PAG][PATCH]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Histórico por campo alterado (exceto metadado atualizado_por)
  for (const [campo, valorNovo] of Object.entries(updates)) {
    if (campo === 'atualizado_por') continue;
    await registrarHistorico(supabase, {
      pedido_id: id,
      bar_id: pedido.bar_id,
      autor: user,
      campo,
      valor_anterior: (pedido as any)[campo],
      valor_novo: valorNovo,
    });
  }

  return NextResponse.json({ success: true, pedido: data, alterado: true });
}
