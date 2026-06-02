import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ferramentas/cmo/produtividade?ano=YYYY
 * Produtividade de mão de obra por mês: CMO% sobre faturamento, custo MO por cliente,
 * split fixo (salário/encargos) vs variável (freela). Fonte: gold.cmo_produtividade_mensal.
 * bar_id sempre do usuário autenticado (header x-selected-bar-id resolvido no middleware).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get('ano')) || new Date().getFullYear();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('gold' as never)
    .from('cmo_produtividade_mensal')
    .select('mes, cmo_total, cmo_fixo, cmo_variavel, faturamento_liquido, pessoas, cmo_pct, cmo_por_cliente')
    .eq('bar_id', user.bar_id)
    .gte('mes', `${ano}-01-01`)
    .lte('mes', `${ano}-12-31`)
    .order('mes', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}
