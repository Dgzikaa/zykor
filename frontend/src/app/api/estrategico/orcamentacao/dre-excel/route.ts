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
    // gold.mv_dre_ano = saída materializada de get_dre_por_ano (validada idêntica, refresh
    // horário). ~0,3ms vs ~2,1s da função. Mesmos números, sem risco de timeout/500.
    const { data, error } = await (supabase as any).schema('gold').from('mv_dre_ano')
      .select('bar_id, mes, categoria_macro, ordem_macro, ordem_sub, categoria, sinal, valor_com_sinal, percentual_receita')
      .eq('bar_id', barId).eq('ano', ano);
    if (error) throw error;

    return NextResponse.json({ linhas: data ?? [], ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
