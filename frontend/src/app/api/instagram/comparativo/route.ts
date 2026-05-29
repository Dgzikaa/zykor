import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/comparativo?bar_ids=3,4
 *
 * Compara metricas entre 2+ bares: followers, engagement, posts dos
 * ultimos 30 dias, crescimento WoW/MoM, reach total.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 120;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const idsRaw = sp.get('bar_ids') || '3,4';
    const barIds = idsRaw.split(',').map(s => Number(s.trim())).filter(Boolean);
    if (!barIds.length) return NextResponse.json({ error: 'bar_ids obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const bares = await Promise.all(barIds.map(async (barId) => {
      // Perfil + ultimas metricas
      const { data: conta } = await (supabase as any)
        .schema('integrations').from('instagram_contas')
        .select('ig_username, name, profile_picture_url, ativo').eq('bar_id', barId).maybeSingle();

      const { data: metricas } = await (supabase as any)
        .schema('integrations').from('instagram_conta_metricas')
        .select('data_snapshot, followers_count, reach, impressions, profile_views, accounts_engaged, total_interactions')
        .eq('bar_id', barId).gte('data_snapshot', desde30)
        .order('data_snapshot', { ascending: true });

      const ultimo = metricas?.[metricas.length - 1];
      const ha7d = metricas?.find((m: any) =>
        new Date(m.data_snapshot).getTime() <= Date.now() - 7 * 86400000);
      const primeiro = metricas?.[0];

      // Soma 30d
      const totais30d = (metricas ?? []).reduce((acc: any, m: any) => ({
        reach: acc.reach + (m.reach ?? 0),
        impressions: acc.impressions + (m.impressions ?? 0),
        profile_views: acc.profile_views + (m.profile_views ?? 0),
        accounts_engaged: acc.accounts_engaged + (m.accounts_engaged ?? 0),
        total_interactions: acc.total_interactions + (m.total_interactions ?? 0),
      }), { reach: 0, impressions: 0, profile_views: 0, accounts_engaged: 0, total_interactions: 0 });

      // Posts dos ultimos 30d + engajamento medio
      const { data: posts } = await (supabase as any)
        .schema('integrations').from('instagram_posts')
        .select('ig_media_id, media_type, like_count, comments_count, timestamp_post')
        .eq('bar_id', barId).gte('timestamp_post', new Date(Date.now() - 30 * 86400000).toISOString());

      const totalLikes = (posts ?? []).reduce((s: number, p: any) => s + (p.like_count ?? 0), 0);
      const totalComments = (posts ?? []).reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);

      const followersAtual = ultimo?.followers_count ?? 0;
      const followers7dAtras = ha7d?.followers_count ?? followersAtual;
      const followersInicio = primeiro?.followers_count ?? followersAtual;

      return {
        bar_id: barId,
        ig_username: conta?.ig_username ?? null,
        name: conta?.name ?? null,
        profile_picture_url: conta?.profile_picture_url ?? null,
        ativo: conta?.ativo ?? false,
        followers_atual: followersAtual,
        crescimento_wow: followersAtual - followers7dAtras,
        crescimento_mom: followersAtual - followersInicio,
        engagement_rate_30d: followersAtual > 0
          ? ((totalLikes + totalComments) / (followersAtual * (posts?.length || 1)) * 100).toFixed(2)
          : '0.00',
        posts_30d: posts?.length ?? 0,
        reach_30d: totais30d.reach,
        impressions_30d: totais30d.impressions,
        profile_views_30d: totais30d.profile_views,
        accounts_engaged_30d: totais30d.accounts_engaged,
        total_interactions_30d: totais30d.total_interactions,
        likes_total_30d: totalLikes,
        comments_total_30d: totalComments,
      };
    }));

    return NextResponse.json({ success: true, bares });
  } catch (e: any) {
    console.error('[ig/comparativo] excecao:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
