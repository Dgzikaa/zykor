import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * GET ?bar_id=X — de-para aprendido de categoria por estabelecimento (financial.cartao_categoria_map).
 * A UI da "Fatura Cartão" usa isso pra pré-preencher a categoria quando já viu o mesmo lugar.
 * Retorna por bar porque cada bar é uma empresa no CA (categoria_id é bar-específico).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'ver')) return permissionErrorResponse('Sem permissão');

  const barId = Number(new URL(request.url).searchParams.get('bar_id'));
  if (!Number.isFinite(barId)) return NextResponse.json({ success: false, error: 'bar_id inválido' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await fin(supabase)
    .from('cartao_categoria_map')
    .select('keyword, categoria_id, categoria_nome, hits')
    .eq('bar_id', barId)
    .order('hits', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, mapa: data || [] });
}
