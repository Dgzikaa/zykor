import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import { criarContaPagarCA } from '@/lib/contaazul/criarContaPagar';

export const dynamic = 'force-dynamic';

// =====================================================
// POST — lança UMA linha da fatura no Conta Azul (no bar da linha).
//   Idempotente: se já está 'lancado', não repete. Grava contaazul_lancamento_id.
//
//   body: { bar_id, categoria_id, categoria_nome, pessoa_id, conta_financeira_id,
//           data_vencimento, centro_custo_id? }
//   competência = data da transação; vencimento = vencimento da fatura.
// =====================================================
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para lançar');
  const { id } = await params;

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const supabase = await getAdminClient();
  const { data: linha } = await fin(supabase).from('cartao_fatura_linhas').select('*').eq('id', id).maybeSingle();
  if (!linha) return NextResponse.json({ success: false, error: 'Linha não encontrada' }, { status: 404 });
  if (linha.status === 'lancado' || linha.contaazul_lancamento_id) {
    return NextResponse.json({ success: false, error: 'Linha já lançada no Conta Azul' }, { status: 409 });
  }
  if (linha.tipo !== 'compra') {
    return NextResponse.json({ success: false, error: 'Só compras vão pro Conta Azul (pagamento/estorno são ignorados)' }, { status: 400 });
  }

  const barId = Number(body.bar_id ?? linha.bar_id);
  const categoria_id = body.categoria_id ?? linha.categoria_id;
  const categoria_nome = body.categoria_nome ?? linha.categoria_nome;
  const pessoa_id = body.pessoa_id;
  const conta_financeira_id = body.conta_financeira_id;
  const data_vencimento = body.data_vencimento;

  const faltando: string[] = [];
  if (!Number.isFinite(barId)) faltando.push('bar');
  if (!categoria_id) faltando.push('categoria');
  if (!pessoa_id) faltando.push('fornecedor (contato CA)');
  if (!conta_financeira_id) faltando.push('conta pagadora');
  if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_vencimento))) faltando.push('vencimento da fatura');
  if (faltando.length) {
    return NextResponse.json({ success: false, error: `Complete antes de lançar: ${faltando.join(', ')}.` }, { status: 400 });
  }

  // Descrição no CA: estabelecimento (+ parcela) + ref curta da linha (evita bloqueio
  // anti-duplicado do CA quando há 2 compras iguais no mesmo dia/categoria).
  const ref = String(linha.dedupe_hash).slice(0, 6);
  const descricao = `${linha.descricao}${linha.parcela ? ` (${linha.parcela})` : ''} [${ref}]`;

  try {
    const { contaazul_id } = await criarContaPagarCA({
      barId,
      data_competencia: linha.data_transacao,
      data_vencimento,
      valor: Number(linha.valor),
      descricao,
      categoria_id,
      pessoa_id,
      conta_financeira_id,
      centro_custo_id: body.centro_custo_id || undefined,
      observacao: `Cartão ${linha.banco}${linha.cartao_final ? ` final ${linha.cartao_final}` : ''} — ${linha.descricao}`,
    });

    const { data: atualizada } = await fin(supabase)
      .from('cartao_fatura_linhas')
      .update({
        status: 'lancado',
        contaazul_lancamento_id: contaazul_id,
        bar_id: barId,
        categoria_id,
        categoria_nome: categoria_nome || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return NextResponse.json({ success: true, linha: atualizada });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Falha ao lançar no Conta Azul' }, { status: 400 });
  }
}
