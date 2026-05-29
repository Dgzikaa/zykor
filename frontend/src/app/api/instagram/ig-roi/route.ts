import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/ig-roi?bar_id=3&dias=180&order=variacao
 *   Lista posts com faturamento D+1 + baseline 7d + variacao %.
 *   order: variacao | data | reach
 */
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 180);
    const order = sp.get('order') ?? 'variacao';
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];

    const orderCol = order === 'data' ? 'data_post' : order === 'reach' ? 'reach' : 'variacao_d1_pct';

    const { data } = await (supabase as any).schema('gold').from('ig_roi_posts')
      .select('*')
      .eq('bar_id', barId)
      .gte('data_post', desde)
      .order(orderCol, { ascending: false, nullsFirst: false })
      .limit(200);

    const posts = data ?? [];

    const comFat = posts.filter((p: any) => p.fat_d1 != null && p.fat_baseline_7d_pre != null);
    const acimaBaseline = comFat.filter((p: any) => Number(p.variacao_d1_pct) > 0).length;
    const variacaoMedia = comFat.length > 0
      ? comFat.reduce((s: number, p: any) => s + Number(p.variacao_d1_pct || 0), 0) / comFat.length
      : 0;

    return NextResponse.json({
      success: true,
      posts,
      stats: {
        total: posts.length,
        com_fat_d1: comFat.length,
        acima_baseline: acimaBaseline,
        pct_eficazes: comFat.length > 0 ? Math.round((acimaBaseline / comFat.length) * 100) : 0,
        variacao_media_pct: Number(variacaoMedia.toFixed(1)),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
