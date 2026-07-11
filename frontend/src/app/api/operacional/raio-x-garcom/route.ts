import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Raio-x por garçom/vendedor: agrega gold_contahub_avendas_porproduto_analitico por usr_lancou
 * (via operations.fn_raio_x_garcom). Vendas, comandas (dia+mesa), ticket médio, itens/comanda,
 * desconto % e attach de bebida por pessoa. Só vendas reais (valorfinal>0 exclui consumo interno).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const dias = Math.min(Math.max(Number(sp.get('dias')) || 30, 1), 180);
  const minComandas = Math.min(Math.max(Number(sp.get('min_comandas')) || 20, 1), 500);

  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .rpc('fn_raio_x_garcom', { p_bar_id: barId, p_dias: dias, p_min_comandas: minComandas });

  if (error) {
    console.error('[raio-x-garcom] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...(data || {}) });
}
