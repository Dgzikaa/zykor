import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/dashboard?bar_id=N
 *
 * Consolida dados do dashboard de Instagram a partir das tabelas povoadas
 * pelo edge fn ig-sync-diario:
 *   - perfil atual (instagram_contas)
 *   - counts e insights de hoje vs D-1 (instagram_conta_metricas)
 *   - evolucao de followers 30d (instagram_conta_metricas)
 *   - top 10 posts dos ultimos 30d por reach (join com instagram_post_insights)
 *   - heatmap online_followers (ultima coleta)
 *   - status da ultima sync (instagram_sync_logs)
 */
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    }

    const supabase = await getAdminClient();

    // 1) Perfil + token info
    const { data: conta } = await (supabase as any)
      .schema('integrations')
      .from('instagram_contas')
      .select(
        'bar_id, ig_username, ig_business_id, name, biography, profile_picture_url, account_type, ativo, expires_at, sincronizado_em',
      )
      .eq('bar_id', barId)
      .maybeSingle();

    if (!conta) {
      return NextResponse.json({
        success: true,
        conectado: false,
        mensagem: 'Nenhuma conta Instagram conectada pra esse bar',
      });
    }

    // 2) Snapshots ultimos 30 dias
    const desde30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const { data: snapshots30 } = await (supabase as any)
      .schema('integrations')
      .from('instagram_conta_metricas')
      .select(
        'data_snapshot, followers_count, follows_count, media_count, reach, profile_views, website_clicks, online_followers',
      )
      .eq('bar_id', barId)
      .gte('data_snapshot', desde30)
      .order('data_snapshot', { ascending: true });

    const ultimoSnap = snapshots30?.[snapshots30.length - 1] ?? null;
    const penultimoSnap = snapshots30?.[snapshots30.length - 2] ?? null;

    const evolucaoFollowers = (snapshots30 ?? []).map((s: any) => ({
      data: s.data_snapshot,
      followers: s.followers_count,
    }));

    // 3) Insights ultimos 7d (soma reach + profile_views)
    const insights7 = (snapshots30 ?? []).slice(-7);
    const soma7 = insights7.reduce(
      (acc: any, s: any) => ({
        reach: acc.reach + (s.reach ?? 0),
        profile_views: acc.profile_views + (s.profile_views ?? 0),
        website_clicks: acc.website_clicks + (s.website_clicks ?? 0),
      }),
      { reach: 0, profile_views: 0, website_clicks: 0 },
    );

    // 4) Heatmap online_followers (ultima coleta com dado)
    let onlineFollowers: Record<string, number> | null = null;
    for (let i = (snapshots30?.length ?? 0) - 1; i >= 0; i--) {
      const v = snapshots30![i].online_followers;
      if (v) {
        try {
          onlineFollowers = typeof v === 'string' ? JSON.parse(v) : v;
        } catch {
          onlineFollowers = null;
        }
        if (onlineFollowers) break;
      }
    }

    // 5) Top 10 posts ultimos 30d por reach (join posts + insights mais recente)
    const { data: postsUltimos30 } = await (supabase as any)
      .schema('integrations')
      .from('instagram_posts')
      .select(
        'ig_media_id, media_type, media_product_type, caption, permalink, thumbnail_url, media_url, timestamp_post, comments_count, like_count',
      )
      .eq('bar_id', barId)
      .gte('timestamp_post', desde30)
      .order('timestamp_post', { ascending: false })
      .limit(50);

    let topPosts: any[] = [];
    if (postsUltimos30?.length) {
      const ids = postsUltimos30.map((p: any) => p.ig_media_id);
      const { data: insights } = await (supabase as any)
        .schema('integrations')
        .from('instagram_post_insights')
        .select('ig_media_id, data_snapshot, reach, likes, comments, shares, saved, total_interactions, video_views')
        .eq('bar_id', barId)
        .in('ig_media_id', ids)
        .order('data_snapshot', { ascending: false });

      // Mantem so a metrica mais recente por post
      const insightsPorPost = new Map<string, any>();
      for (const ins of (insights ?? [])) {
        if (!insightsPorPost.has(ins.ig_media_id)) {
          insightsPorPost.set(ins.ig_media_id, ins);
        }
      }

      topPosts = postsUltimos30
        .map((p: any) => {
          const ins = insightsPorPost.get(p.ig_media_id) ?? {};
          const engajamento = (ins.likes ?? p.like_count ?? 0) + (ins.comments ?? p.comments_count ?? 0) + (ins.shares ?? 0) + (ins.saved ?? 0);
          return {
            ig_media_id: p.ig_media_id,
            media_type: p.media_type,
            media_product_type: p.media_product_type,
            caption: p.caption?.slice(0, 200) ?? null,
            permalink: p.permalink,
            thumbnail_url: p.thumbnail_url,
            media_url: p.media_url,
            timestamp: p.timestamp_post,
            metricas: {
              likes: ins.likes ?? p.like_count ?? 0,
              comments: ins.comments ?? p.comments_count ?? 0,
              shares: ins.shares ?? 0,
              saved: ins.saved ?? 0,
              reach: ins.reach ?? 0,
              video_views: ins.video_views ?? 0,
              total_interactions: ins.total_interactions ?? engajamento,
              engajamento,
            },
          };
        })
        .sort((a: any, b: any) => (b.metricas.reach || b.metricas.engajamento) - (a.metricas.reach || a.metricas.engajamento))
        .slice(0, 10);
    }

    // 6) Ultima sync
    const { data: ultimaSync } = await (supabase as any)
      .schema('integrations')
      .from('instagram_sync_logs')
      .select('id, tipo_sync, status, iniciado_em, concluido_em, duracao_ms, itens_processados, erro_mensagem')
      .eq('bar_id', barId)
      .order('iniciado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      conectado: !!conta.ativo,
      perfil: {
        ig_username: conta.ig_username,
        ig_business_id: conta.ig_business_id,
        name: conta.name,
        biography: conta.biography,
        profile_picture_url: conta.profile_picture_url,
        account_type: conta.account_type,
        followers_count: ultimoSnap?.followers_count ?? null,
        follows_count: ultimoSnap?.follows_count ?? null,
        media_count: ultimoSnap?.media_count ?? null,
        token_expira_em: conta.expires_at,
        sincronizado_em: conta.sincronizado_em,
      },
      hoje: {
        reach: ultimoSnap?.reach ?? null,
        profile_views: ultimoSnap?.profile_views ?? null,
        website_clicks: ultimoSnap?.website_clicks ?? null,
        followers_diff: (ultimoSnap?.followers_count ?? 0) - (penultimoSnap?.followers_count ?? 0),
        data: ultimoSnap?.data_snapshot ?? null,
      },
      ultimos_7_dias: soma7,
      evolucao_followers: evolucaoFollowers,
      online_followers_heatmap: onlineFollowers,
      top_posts: topPosts,
      ultima_sync: ultimaSync,
    });
  } catch (e: any) {
    console.error('[ig/dashboard] excecao:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
