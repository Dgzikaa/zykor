import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Dashboard "Gargalo de Cozinha": lê a silver.tempos_producao (via operations.fn_gargalo_cozinha)
 * e devolve os 4 cortes — KPIs, por praça, por hora, itens que atrasam, decomposição do tempo.
 * A função respeita a config por bar (métrica t0_t3/t0_t2, limites, setores, excluídos), então
 * bate com o atrasos_cozinha_perc da home. Robusto a outlier (mediana/p90 + cap).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const dias = Math.min(Math.max(Number(sp.get('dias')) || 30, 1), 180);
  const catRaw = sp.get('categoria') || 'cozinha';
  const categoria = ['cozinha', 'bar', 'todos'].includes(catRaw) ? catRaw : 'cozinha';

  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .rpc('fn_gargalo_cozinha', { p_bar_id: barId, p_dias: dias, p_categoria: categoria, p_cap_seg: 3600 });

  if (error) {
    console.error('[gargalo-cozinha] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...(data || {}) });
}
