import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/feed?bar_id=N&dias=90
 * Performance dos posts de FEED (carrossel/imagem, NÃO reels/stories): ranqueia por
 * engajamento e compara formato (Carrossel × Imagem) — quais posts foram bons/ruins.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 60;

const fmtLabel = (mt: string) => (mt === 'CAROUSEL_ALBUM' ? 'Carrossel' : mt === 'IMAGE' ? 'Imagem' : mt);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 90);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const { data: posts } = await (supabase as any).schema('integrations').from('instagram_posts')
      .select('ig_media_id, media_type, caption, permalink, thumbnail_url, media_url, timestamp_post, comments_count, like_count')
      .eq('bar_id', barId).eq('media_product_type', 'FEED').gte('timestamp_post', desde)
      .order('timestamp_post', { ascending: false });

    if (!posts?.length) return NextResponse.json({ success: true, posts: [], totais: null, formatos: [] });

    const ids = posts.map((p: any) => p.ig_media_id);
    const { data: insights } = await (supabase as any).schema('integrations').from('instagram_post_insights')
      .select('ig_media_id, reach, impressions, saved, likes, comments, shares, total_interactions, data_snapshot')
      .eq('bar_id', barId).in('ig_media_id', ids)
      .order('data_snapshot', { ascending: false });

    const insMap = new Map<string, any>();
    for (const ins of insights ?? []) if (!insMap.has(ins.ig_media_id)) insMap.set(ins.ig_media_id, ins);

    const enriquecidos = posts.map((p: any) => {
      const i = insMap.get(p.ig_media_id) ?? {};
      const reach = i.reach ?? 0;
      const likes = i.likes ?? p.like_count ?? 0;
      const comments = i.comments ?? p.comments_count ?? 0;
      const shares = i.shares ?? 0;
      const saves = i.saved ?? 0;
      const engajamento = likes + comments + shares + saves;
      return {
        ig_media_id: p.ig_media_id,
        formato: fmtLabel(p.media_type),
        media_type: p.media_type,
        caption: p.caption ?? '',
        permalink: p.permalink,
        thumbnail: p.thumbnail_url || p.media_url || null,
        timestamp_post: p.timestamp_post,
        reach,
        impressions: i.impressions ?? 0,
        likes, comments, shares, saves,
        engajamento,
        taxa_engajamento: reach > 0 ? engajamento / reach : 0, // engajamento por alcance
      };
    }).sort((a: any, b: any) => b.engajamento - a.engajamento);

    const totais = enriquecidos.reduce((a: any, p: any) => ({
      qtd: a.qtd + 1, reach: a.reach + p.reach, engajamento: a.engajamento + p.engajamento,
      likes: a.likes + p.likes, comments: a.comments + p.comments, shares: a.shares + p.shares, saves: a.saves + p.saves,
    }), { qtd: 0, reach: 0, engajamento: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

    // comparação por formato (Carrossel × Imagem)
    const porFmt = new Map<string, { formato: string; qtd: number; reach: number; engajamento: number; comReach: number; somaTaxa: number }>();
    for (const p of enriquecidos) {
      const f = porFmt.get(p.formato) || { formato: p.formato, qtd: 0, reach: 0, engajamento: 0, comReach: 0, somaTaxa: 0 };
      f.qtd += 1; f.reach += p.reach; f.engajamento += p.engajamento;
      if (p.reach > 0) { f.comReach += 1; f.somaTaxa += p.taxa_engajamento; }
      porFmt.set(p.formato, f);
    }
    const formatos = [...porFmt.values()].map((f) => ({
      formato: f.formato, qtd: f.qtd,
      alcance_medio: f.qtd ? Math.round(f.reach / f.qtd) : 0,
      engajamento_medio: f.qtd ? Math.round(f.engajamento / f.qtd) : 0,
      taxa_media: f.comReach ? f.somaTaxa / f.comReach : 0,
    })).sort((a, b) => b.engajamento_medio - a.engajamento_medio);

    return NextResponse.json({
      success: true,
      posts: enriquecidos,
      formatos,
      totais: {
        ...totais,
        engajamento_medio: totais.qtd ? Math.round(totais.engajamento / totais.qtd) : 0,
        alcance_medio: totais.qtd ? Math.round(totais.reach / totais.qtd) : 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
