import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/stories?bar_id=N&dias=7
 */
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 7);
    const inicio = sp.get('inicio');
    const fim = sp.get('fim');
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    // Data explícita (inicio/fim) tem precedência sobre o período relativo (dias)
    let q = (supabase as any).schema('integrations').from('instagram_stories')
      .select('*').eq('bar_id', barId);
    q = inicio && fim
      ? q.gte('timestamp_post', inicio).lte('timestamp_post', `${fim}T23:59:59.999`)
      : q.gte('timestamp_post', desde);
    const { data } = await q.order('timestamp_post', { ascending: false });

    const stories = data || [];
    const totalViews = stories.reduce((s: number, x: any) => s + (x.views ?? 0), 0);
    const totalReach = stories.reduce((s: number, x: any) => s + (x.reach ?? 0), 0);
    const totalInteractions = stories.reduce((s: number, x: any) => s + (x.total_interactions ?? 0), 0);
    const totalReplies = stories.reduce((s: number, x: any) => s + (x.replies ?? 0), 0);
    const totalFollows = stories.reduce((s: number, x: any) => s + (x.follows ?? 0), 0);
    const totalProfileVisits = stories.reduce((s: number, x: any) => s + (x.profile_visits ?? 0), 0);

    return NextResponse.json({
      success: true,
      stories,
      totais: { views: totalViews, reach: totalReach, interactions: totalInteractions, replies: totalReplies, follows_ganhos: totalFollows, profile_visits: totalProfileVisits, qtd: stories.length },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
