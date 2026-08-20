import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  podeVerTodos,
  registrarHistorico,
  STATUS_EDITAVEL_SOLICITANTE,
  type PedidoPagamento,
  type PedidoStatus,
} from '@/lib/financeiro/pedidos-pagamento';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';
import { negarSeNaoPode } from '@/lib/permissions/guard';

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

/**
 * Campos CONTÁBEIS — os que dizem "como isso é classificado", não "quanto e pra quem se paga".
 *
 * Pedido do Isaías (20/08/2026): "tem como deixar a gente ter acesso para editar os boletos depois
 * que lança?". Ele já tinha o direito de editar no perfil (Administrativo tem
 * `...pedidos_de_pagamento:editar`); o que barrava era o STATUS — solicitante só editava enquanto
 * o pedido estava em rascunho/aguardando aprovação.
 *
 * A liberação é destes campos e só destes. Valor, vencimento, chave PIX e linha digitável ficam
 * de fora depois que o pedido sai da aprovação: nesse ponto o pagamento já foi agendado no Inter
 * com aqueles números, e mudá-los aqui faria o registro do Zykor discordar do que saiu do banco —
 * o erro mais caro possível, porque some sem deixar rastro.
 */
const CAMPOS_CONTABEIS = [
  'descricao', 'observacao', 'data_competencia',
  'categoria_id', 'categoria_nome', 'contaazul_pessoa_id',
  'centro_custo_id', 'centro_custo_nome',
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
  if (!podeVerTodos(user) && pedido.solicitante_id !== user.auth_id) {
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
    // Corrigir a classificação de um pedido JÁ lançado (categoria, competência, fornecedor,
    // centro de custo). Não é aprovar nem agendar — não move dinheiro.
    pode_corrigir: !negarSeNaoPode(user, ['/financeiro/pedidos-pagamento'], 'editar'),
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
  // Quem tem o direito de EDITAR no módulo de pedidos (perfil Administrativo, p.ex.) corrige a
  // classificação de qualquer pedido do bar, mesmo depois de lançado — só os campos contábeis.
  const podeCorrigir = !negarSeNaoPode(user, ['/financeiro/pedidos-pagamento'], 'editar');
  if (!ehFinanceiro && !ehDono && !podeCorrigir) {
    return permissionErrorResponse('Sem permissão para editar este pedido');
  }
  // Fora da janela de aprovação, quem não é financeiro fica restrito aos campos contábeis.
  const soContabeis = !ehFinanceiro && !STATUS_EDITAVEL_SOLICITANTE.includes(pedido.status as PedidoStatus);
  if (soContabeis && !podeCorrigir) {
    return permissionErrorResponse('Pedido já está em processamento e não pode mais ser editado por você');
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const camposPermitidos = ehFinanceiro ? CAMPOS_FINANCEIRO : soContabeis ? CAMPOS_CONTABEIS : CAMPOS_SOLICITANTE;
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
  /*
    O lançamento no Conta Azul foi criado no AGENDAR e a API do CA não atualiza lançamento
    [[feedback_contaazul_api_sem_delete_lancamento]]. Então corrigir a categoria aqui conserta o
    Zykor e NÃO conserta o CA — e é o CA que alimenta a DRE. Sem este aviso a pessoa corrige,
    vê certo na tela e segue achando que resolveu.
  */
  const jaFoiProCA = ['agendado', 'pago'].includes(String(pedido.status))
    && ['categoria_id', 'categoria_nome', 'centro_custo_id', 'data_competencia'].some(c => c in updates);
  return NextResponse.json({
    success: true, pedido: data, alterado: true,
    aviso: jaFoiProCA
      ? 'Corrigido no Zykor. O lançamento JÁ foi criado no Conta Azul e não muda sozinho — ajuste a categoria por lá também.'
      : undefined,
  });
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
