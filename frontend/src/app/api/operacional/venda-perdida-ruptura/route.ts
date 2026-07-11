import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Venda perdida por ruptura: cruza produtos em ruptura INTERMITENTE
 * (gold_..._stockout_filtrado) com a velocidade de venda real (avendas analitico),
 * via operations.fn_venda_perdida_ruptura. Retorna faixa conservador→teto por
 * produto/categoria/dia. Estimativa (não fato) — modelo documentado na função.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const dias = Math.min(Math.max(Number(sp.get('dias')) || 30, 7), 180);

  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .rpc('fn_venda_perdida_ruptura', { p_bar_id: barId, p_dias: dias });

  if (error) {
    console.error('[venda-perdida-ruptura] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...(data || {}) });
}
