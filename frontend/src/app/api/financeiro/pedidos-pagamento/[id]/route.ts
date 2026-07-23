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
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

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
// Categoria e fornecedor (contaazul_pessoa_id) são preenchidos pelo solicitante na criação
// e podem ser ajustados por ele enquanto o pedido está pendente — o financeiro só confere/aprova.
const CAMPOS_SOLICITANTE = [
  'descricao', 'valor', 'data_competencia', 'data_vencimento',
  'beneficiario_nome', 'chave_pix', 'cpf_cnpj', 'observacao', 'tipo',
  'precisa_comprovante', 'pix_copia_cola',
  'categoria_id', 'categoria_nome', 'contaazul_pessoa_id',
];
const CAMPOS_FINANCEIRO = [
  ...CAMPOS_SOLICITANTE,
  'centro_custo_id', 'centro_custo_nome',
  'conta_financeira_id', 'inter_credencial_id',
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

  const [comentarios, anexos, historico, competencias] = await Promise.all([
    fin(supabase).from('pedidos_pagamento_comentarios').select('*').eq('pedido_id', id).order('created_at', { ascending: true }),
    fin(supabase).from('pedidos_pagamento_anexos').select('*').eq('pedido_id', id).order('created_at', { ascending: true }),
    fin(supabase).from('pedidos_pagamento_historico').select('*').eq('pedido_id', id).order('created_at', { ascending: false }),
    fin(supabase).from('pedidos_pagamento_competencias').select('*').eq('pedido_id', id).order('ordem', { ascending: true }),
  ]);

  return NextResponse.json({
    success: true,
    pedido,
    comentarios: comentarios.data || [],
    anexos: anexos.data || [],
    historico: historico.data || [],
    competencias: competencias.data || [],
    pode_aprovar: podeAprovar(user),
    pode_excluir: user.role === 'admin',
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

  await broadcastPedidoChange(pedido.bar_id);
  return NextResponse.json({ success: true, pedido: data, alterado: true });
}

// =====================================================
// DELETE — admin apaga o pedido de vez (ex.: pedido de teste/duplicado)
//   Hard delete: remove anexos (storage + DB), comentários, histórico e o pedido.
//   Diferente de "cancelar" (soft, vira status=cancelado e fica no histórico).
// =====================================================
const BUCKET_UPLOADS = 'uploads';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const { id } = await params;

  // Exclusão definitiva é só de admin (mais restrito que aprovar/cancelar).
  if (user.role !== 'admin') {
    return permissionErrorResponse('Apenas administradores podem excluir um pedido');
  }

  const supabase = await getAdminClient();
  const pedido = await carregarPedido(supabase, id);
  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }

  // Trava: se já gerou conta no Conta Azul ou PIX no Inter, apagar deixaria o
  // registro financeiro órfão lá. Nesses casos o caminho é cancelar/tratar, não excluir.
  if (pedido.contaazul_lancamento_id || pedido.inter_codigo_solicitacao) {
    return NextResponse.json(
      {
        success: false,
        error: 'Este pedido já gerou conta no Conta Azul / PIX no Inter. Cancele em vez de excluir.',
      },
      { status: 409 }
    );
  }

  // Remove os arquivos dos anexos no storage (best-effort).
  const { data: anexos } = await fin(supabase)
    .from('pedidos_pagamento_anexos')
    .select('caminho_storage')
    .eq('pedido_id', id);
  const caminhos = (anexos || [])
    .map((a: any) => a.caminho_storage)
    .filter((c: unknown): c is string => typeof c === 'string' && c.length > 0);
  if (caminhos.length > 0) {
    await supabase.storage.from(BUCKET_UPLOADS).remove(caminhos).catch(() => {});
  }

  // Apaga filhos explicitamente (não depende de ON DELETE CASCADE) e depois o pedido.
  await fin(supabase).from('pedidos_pagamento_anexos').delete().eq('pedido_id', id);
  await fin(supabase).from('pedidos_pagamento_comentarios').delete().eq('pedido_id', id);
  await fin(supabase).from('pedidos_pagamento_historico').delete().eq('pedido_id', id);

  const { error } = await fin(supabase).from('pedidos_pagamento').delete().eq('id', id);
  if (error) {
    console.error('[PEDIDOS-PAG][DELETE]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
