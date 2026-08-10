import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/stone/venda-x-liquidacao?data=YYYY-MM-DD
 *
 * Duas leituras do MESMO dinheiro, lado a lado:
 *   VENDA      — o dia em que o cliente passou o cartão. É o que o Zykor lança no Conta Azul.
 *   LIQUIDAÇÃO — o dia em que a Stone paga. É o que a maquininha/extrato mostra.
 *                Débito cai em D+1, crédito ~D+30, PIX no mesmo dia.
 *
 * Mais os EVENTOS (CrossBalance etc.) que a Stone abate do repasse e que não aparecem em
 * lugar nenhum das transações — é o que faz o extrato mostrar menos que a soma das vendas.
 *
 * Toda a conta é feita em public.stone_venda_x_liquidacao (SQL), para a tela não reimplementar
 * a regra de classificação (crédito = previsão > 15 dias da venda) e divergir do lançador.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });
  }

  const data = (new URL(request.url).searchParams.get('data') || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data inválida (use YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data: resultado, error } = await supabase.rpc('stone_venda_x_liquidacao', {
    p_bar_id: user.bar_id,
    p_data: data,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comparativo: resultado });
}
