import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/financeiro/dfc/fora-depara?bar_id=3&ano=2026
 * Categorias do Conta Azul FORA do de-para da DRE (somem dos relatórios).
 * Fonte: financial.get_dfc_fora_depara.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).schema('financial')
      .rpc('get_dfc_fora_depara', { p_bar_id: barId, p_ano: ano });
    if (error) throw error;

    return NextResponse.json({ categorias: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
