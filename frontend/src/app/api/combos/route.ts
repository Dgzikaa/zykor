import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 60);
    const incluirBanda = sp.get('incluir_banda') === '1';
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('produto_combos', {
      p_bar_id: barId, p_dias: dias, p_min_pares: 25,
    });
    if (error) throw error;

    let combos = data ?? [];
    if (!incluirBanda) {
      combos = combos.filter((c: any) => !c.produto_a?.includes('[Banda]') && !c.produto_b?.includes('[Banda]'));
    }

    return NextResponse.json({ success: true, combos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
