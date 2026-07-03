import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/financeiro/dfc?bar_id=3&ano=2026
 * DFC por CAIXA (data de pagamento). Retorna linhas (mes, grupo_dfc, categoria,
 * entradas, saidas, net) — fonte: RPC get_dfc_por_ano (de-para categoria_dfc_map,
 * exclui AJUSTE). O agrupamento por mês/grupo é feito no client.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();
    const soConciliado = sp.get('conciliado') === '1';

    const supabase = await getAdminClient();
    // gold.mv_dfc_ano = DFC materializada (idêntica à função, refresh horário) — ~0,3ms vs ~1s
    const { data, error } = await (supabase as any).schema('gold').from('mv_dfc_ano')
      .select('mes, grupo_dfc, categoria, categoria_macro, ordem_macro, ordem_sub, entradas, saidas, net')
      .eq('bar_id', barId).eq('ano', ano).eq('so_conciliado', soConciliado);
    if (error) throw error;

    return NextResponse.json({ linhas: data ?? [], ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
