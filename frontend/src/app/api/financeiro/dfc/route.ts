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
    const { data, error } = await (supabase as any).rpc('get_dfc_por_ano', { p_bar_id: barId, p_ano: ano, p_so_conciliado: soConciliado });
    if (error) throw error;

    return NextResponse.json({ linhas: data ?? [], ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
