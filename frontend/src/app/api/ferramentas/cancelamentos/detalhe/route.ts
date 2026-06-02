import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ferramentas/cancelamentos/detalhe?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Linha a linha dos itens cancelados no período: item, valor unitário, qtd,
 * quem cancelou (garçom), motivo, mesa. bar_id do usuário autenticado.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get('inicio');
  const fim = searchParams.get('fim') || inicio;
  if (!inicio) {
    return NextResponse.json({ success: false, error: 'inicio é obrigatório' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema('bronze' as never)
    .from('bronze_contahub_avendas_cancelamentos')
    .select('dt_gerencial, prd_desc, grp_desc, itm_qtd, itm_vrunitario, itm_vrcheio, custototal, cancelou, motivocancdesconto, vd_mesadesc')
    .eq('bar_id', user.bar_id)
    .gte('dt_gerencial', inicio)
    .lte('dt_gerencial', fim as string)
    .order('itm_vrcheio', { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, itens: data || [] });
}
