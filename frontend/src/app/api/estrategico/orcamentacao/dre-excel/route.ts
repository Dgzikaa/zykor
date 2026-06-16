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
    const ano = Number(sp.get('ano')) || new Date().getFullYear();

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('get_dre_por_ano', { p_bar_id: barId, p_ano: ano });
    if (error) throw error;

    return NextResponse.json({ linhas: data ?? [], ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
