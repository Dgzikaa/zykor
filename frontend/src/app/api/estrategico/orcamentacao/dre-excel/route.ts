import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/estrategico/orcamentacao/dre-excel?bar_id=3&ano=2026
 * Retorna estrutura do DRE igual ao Excel:
 * - 12 meses + YTD
 * - Cada categoria MACRO + subcategorias
 * - Valor (R$) + percentual da receita
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).schema('financial').from('dre_excel')
      .select('*').eq('bar_id', barId);
    if (error) throw error;

    return NextResponse.json({ linhas: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
