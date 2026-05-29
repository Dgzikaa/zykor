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
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    const { data } = await (supabase as any).schema('integrations').from('instagram_stories')
      .select('*').eq('bar_id', barId).gte('timestamp_post', desde)
      .order('timestamp_post', { ascending: false });

    const stories = data || [];
    const totalReach = stories.reduce((s: number, x: any) => s + (x.reach ?? 0), 0);
    const totalReplies = stories.reduce((s: number, x: any) => s + (x.replies ?? 0), 0);
    const totalFollows = stories.reduce((s: number, x: any) => s + (x.follows ?? 0), 0);
    const totalProfileVisits = stories.reduce((s: number, x: any) => s + (x.profile_visits ?? 0), 0);

    return NextResponse.json({
      success: true,
      stories,
      totais: { reach: totalReach, replies: totalReplies, follows_ganhos: totalFollows, profile_visits: totalProfileVisits, qtd: stories.length },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
