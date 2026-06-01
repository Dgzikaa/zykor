import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  comentarioSistema,
  formatBRL,
  TIPOS_VALIDOS,
  type PedidoTipo,
} from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// =====================================================
// GET — lista de pedidos do bar
//   ?status= filtro · ?tipo= filtro · ?escopo=meus|todos
//   - escopo=meus: só os do próprio solicitante
//   - escopo=todos: todos do bar (default p/ quem pode aprovar)
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const tipo = searchParams.get('tipo');
  const escopoParam = searchParams.get('escopo');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

  // Quem não pode aprovar só enxerga os próprios pedidos, mesmo pedindo "todos".
  const escopo = podeAprovar(user) && escopoParam !== 'meus' ? 'todos' : 'meus';

  const supabase = await getAdminClient();
  let query = fin(supabase)
    .from('pedidos_pagamento')
    .select('*')
    .eq('bar_id', user.bar_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (tipo) query = query.eq('tipo', tipo);
  if (escopo === 'meus') query = query.eq('solicitante_id', user.auth_id);

  const { data, error } = await query;
  if (error) {
    console.error('[PEDIDOS-PAG][GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pedidos: data || [],
    escopo,
    pode_aprovar: podeAprovar(user),
  });
}

// =====================================================
// POST — cria um novo pedido (qualquer funcionário logado)
// =====================================================
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const tipo = String(body.tipo || '') as PedidoTipo;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { success: false, error: `tipo inválido (use: ${TIPOS_VALIDOS.join(', ')})` },
      { status: 400 }
    );
  }

  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ success: false, error: 'valor inválido' }, { status: 400 });
  }

  const descricao = String(body.descricao || '').trim();
  if (!descricao) {
    return NextResponse.json({ success: false, error: 'descrição é obrigatória' }, { status: 400 });
  }

  const data_vencimento = body.data_vencimento;
  if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_vencimento))) {
    return NextResponse.json(
      { success: false, error: 'data_vencimento (AAAA-MM-DD) é obrigatória' },
      { status: 400 }
    );
  }

  // Reembolso e adiantamento normalmente caem na chave do próprio funcionário.
  const chave_pix = body.chave_pix ? String(body.chave_pix).trim() : null;
  if ((tipo === 'reembolso' || tipo === 'fornecedor') && !chave_pix) {
    return NextResponse.json(
      { success: false, error: 'chave PIX é obrigatória para este tipo' },
      { status: 400 }
    );
  }

  const supabase = await getAdminClient();
  const novo = {
    bar_id: user.bar_id,
    tipo,
    status: 'aguardando_aprovacao',
    solicitante_id: user.auth_id,
    solicitante_nome: user.nome,
    descricao,
    valor: Math.round(valor * 100) / 100,
    data_competencia: body.data_competencia || null,
    data_vencimento,
    beneficiario_nome: body.beneficiario_nome || null,
    chave_pix,
    cpf_cnpj: body.cpf_cnpj || null,
    observacao: body.observacao || null,
    // Pré-sugestões opcionais (financeiro confirma na aprovação)
    categoria_id: body.categoria_id || null,
    categoria_nome: body.categoria_nome || null,
    centro_custo_id: body.centro_custo_id || null,
    centro_custo_nome: body.centro_custo_nome || null,
    criado_por: user.auth_id,
    atualizado_por: user.auth_id,
  };

  const { data, error } = await fin(supabase)
    .from('pedidos_pagamento')
    .insert(novo)
    .select()
    .single();

  if (error) {
    console.error('[PEDIDOS-PAG][POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await comentarioSistema(supabase, {
    pedido_id: data.id,
    bar_id: user.bar_id,
    mensagem: `Pedido criado por ${user.nome} — ${formatBRL(valor)} (${tipo}).`,
  });

  return NextResponse.json({ success: true, pedido: data });
}
