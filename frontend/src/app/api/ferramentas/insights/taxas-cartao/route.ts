import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Taxa de cartão (custo de maquininha): agrega silver.stone_transacoes (fee por transação)
 * por bandeira, tipo e dia, via operations.fn_taxa_cartao. Fonte = Stone (o campo `taxa` do
 * ContaHub em faturamento_pagamentos está zerado).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const di = sp.get('data_inicio');
  const df = sp.get('data_fim');
  if (!barId || !di || !df) {
    return NextResponse.json({ success: false, error: 'bar_id, data_inicio e data_fim são obrigatórios' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .rpc('fn_taxa_cartao', { p_bar_id: barId, p_di: di, p_df: df });

  if (error) {
    console.error('[taxas-cartao] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...(data || {}) });
}
