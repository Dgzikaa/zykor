import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Giro de mesa (eficiência de receita): R$/mesa-hora, tempo de permanência, ticket, receita
 * por hora e por faixa de permanência — via operations.fn_giro_mesa sobre silver.cliente_visitas.
 * Complementa a página Tempo de Estadia (que só tem duração, sem receita).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const dias = Math.min(Math.max(Number(sp.get('dias')) || 90, 7), 365);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .rpc('fn_giro_mesa', { p_bar_id: barId, p_dias: dias });

  if (error) {
    console.error('[giro-mesa] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...(data || {}) });
}
