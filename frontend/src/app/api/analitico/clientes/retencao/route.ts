import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analitico/clientes/retencao?meses=12
 * Matriz de coorte (retenção/recompra) por mês da 1ª visita.
 * Fonte: gold.cliente_coorte_mensal (cliente_fone_norm). bar_id do usuário autenticado.
 * Retorna linhas (coorte, mes_offset, clientes) — o front pivota em matriz.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const meses = Math.min(Math.max(Number(searchParams.get('meses')) || 12, 1), 24);
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);
  const desdeIso = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-01`;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('gold' as never)
    .from('cliente_coorte_mensal')
    .select('coorte, mes_offset, clientes')
    .eq('bar_id', user.bar_id)
    .gte('coorte', desdeIso)
    .order('coorte', { ascending: true })
    .order('mes_offset', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}
