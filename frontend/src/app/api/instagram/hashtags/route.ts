import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/hashtags?bar_id=N&dias=60
 *
 * Parse hashtags das captions + cross com métricas.
 * Retorna: top 20 hashtags por reach médio + engajamento médio + qtd usos.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 300;

const HASHTAG_RE = /#[\p{L}\p{N}_]{2,}/gu;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 60);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const { data: posts } = await (supabase as any).schema('integrations').from('instagram_posts')
      .select('ig_media_id, caption, media_type, media_product_type').eq('bar_id', barId).gte('timestamp_post', desde);

    if (!posts?.length) return NextResponse.json({ success: true, hashtags: [] });

    const ids = posts.map((p: any) => p.ig_media_id);
    const { data: insights } = await (supabase as any).schema('integrations').from('instagram_post_insights')
      .select('ig_media_id, reach, likes, comments, shares, saved, data_snapshot')
      .eq('bar_id', barId).in('ig_media_id', ids).order('data_snapshot', { ascending: false });

    const insMap = new Map<string, any>();
    for (const ins of insights ?? []) if (!insMap.has(ins.ig_media_id)) insMap.set(ins.ig_media_id, ins);

    // Agrega por hashtag
    const stats: Map<string, { usos: number; reach_total: number; engaj_total: number; tipos: Set<string> }> = new Map();
    for (const p of posts) {
      const ins = insMap.get(p.ig_media_id) ?? {};
      const reach = ins.reach ?? 0;
      const engaj = (ins.likes ?? 0) + (ins.comments ?? 0) + (ins.shares ?? 0) + (ins.saved ?? 0);
      const tags = ((p.caption as string) || '').match(HASHTAG_RE) || [];
      const tipo = p.media_product_type === 'REELS' ? 'REEL' : p.media_type === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : p.media_type === 'VIDEO' ? 'VIDEO' : 'IMAGE';
      const tagsUnicas: Set<string> = new Set((tags as string[]).map((t) => t.toLowerCase()));
      for (const tag of tagsUnicas) {
        const cur = stats.get(tag) ?? { usos: 0, reach_total: 0, engaj_total: 0, tipos: new Set<string>() };
        cur.usos++;
        cur.reach_total += reach;
        cur.engaj_total += engaj;
        cur.tipos.add(tipo);
        stats.set(tag, cur);
      }
    }

    const arr = Array.from(stats.entries()).map(([tag, s]) => ({
      hashtag: tag,
      usos: s.usos,
      reach_medio: Math.round(s.reach_total / s.usos),
      engaj_medio: Math.round(s.engaj_total / s.usos),
      tipos_usados: Array.from(s.tipos),
    }))
      .filter(t => t.usos >= 2) // descartar tags de uso único (ruído)
      .sort((a, b) => b.reach_medio - a.reach_medio);

    return NextResponse.json({
      success: true,
      total_hashtags_unicas: arr.length,
      hashtags: arr.slice(0, 30),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
