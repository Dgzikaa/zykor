import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/reels?bar_id=N&dias=30
 *
 * Reels-only deep dive: métricas únicas (avg_watch_time, plays, views/reach
 * ratio), agrupamento por duração estimada.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 30);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const { data: posts } = await (supabase as any).schema('integrations').from('instagram_posts')
      .select('ig_media_id, caption, permalink, thumbnail_url, media_url, timestamp_post, comments_count, like_count')
      .eq('bar_id', barId).eq('media_product_type', 'REELS').gte('timestamp_post', desde)
      .order('timestamp_post', { ascending: false });

    if (!posts?.length) {
      return NextResponse.json({ success: true, reels: [], totais: null });
    }

    const ids = posts.map((p: any) => p.ig_media_id);
    const { data: insights } = await (supabase as any).schema('integrations').from('instagram_post_insights')
      .select('ig_media_id, reach, likes, comments, shares, saved, video_views, plays, total_interactions, ig_reels_avg_watch_time, data_snapshot')
      .eq('bar_id', barId).in('ig_media_id', ids)
      .order('data_snapshot', { ascending: false });

    const insMap = new Map<string, any>();
    for (const ins of insights ?? []) if (!insMap.has(ins.ig_media_id)) insMap.set(ins.ig_media_id, ins);

    const reels = posts.map((p: any) => {
      const i = insMap.get(p.ig_media_id) ?? {};
      const reach = i.reach ?? 0;
      const views = i.video_views ?? i.plays ?? 0;
      return {
        ...p,
        reach,
        likes: i.likes ?? p.like_count ?? 0,
        comments: i.comments ?? p.comments_count ?? 0,
        shares: i.shares ?? 0,
        saves: i.saved ?? 0,
        views,
        plays: i.plays ?? views,
        avg_watch_time_ms: i.ig_reels_avg_watch_time ?? null,
        views_por_reach: reach > 0 ? views / reach : 0,
        total_interactions: i.total_interactions ?? 0,
      };
    }).sort((a: any, b: any) => b.views - a.views);

    const totais = reels.reduce((acc: any, r: any) => ({
      qtd: acc.qtd + 1,
      reach: acc.reach + r.reach,
      views: acc.views + r.views,
      likes: acc.likes + r.likes,
      comments: acc.comments + r.comments,
      shares: acc.shares + r.shares,
      saves: acc.saves + r.saves,
    }), { qtd: 0, reach: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

    const avgWatchSomados = reels.filter((r: any) => r.avg_watch_time_ms != null);
    const avgWatchMedio = avgWatchSomados.length > 0
      ? avgWatchSomados.reduce((s: number, r: any) => s + r.avg_watch_time_ms, 0) / avgWatchSomados.length
      : null;

    return NextResponse.json({
      success: true,
      reels,
      totais: {
        ...totais,
        engajamento_medio_por_reel: totais.qtd > 0 ? Math.round((totais.likes + totais.comments + totais.shares + totais.saves) / totais.qtd) : 0,
        views_medio_por_reel: totais.qtd > 0 ? Math.round(totais.views / totais.qtd) : 0,
        avg_watch_time_medio_ms: avgWatchMedio,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
