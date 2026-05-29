import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/best-time?bar_id=N
 *
 * Calcula o "melhor horário pra postar" cruzando:
 *   - online_followers heatmap (qtd seguidores online por hora 0-23)
 *   - engajamento médio histórico dos posts agrupado por hora de publicacao
 *
 * Retorna: score 0-100 por hora (combinação ponderada 60% online_followers +
 * 40% engajamento histórico), + top 3 horarios recomendados.
 *
 * Quando não houver dado de engajamento por hora ainda, usa só online_followers.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();

    // 1) Pega ultimo online_followers conhecido
    const desde30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const { data: snapshots } = await (supabase as any)
      .schema('integrations').from('instagram_conta_metricas')
      .select('data_snapshot, online_followers').eq('bar_id', barId)
      .gte('data_snapshot', desde30)
      .order('data_snapshot', { ascending: false });

    let onlineFollowers: Record<string, number> = {};
    for (const s of (snapshots ?? [])) {
      const raw = s.online_followers;
      if (!raw) continue;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') {
          onlineFollowers = parsed;
          break;
        }
      } catch { /* skip */ }
    }

    // 2) Engajamento médio dos posts dos últimos 90 dias agrupado por hora
    const desde90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: posts } = await (supabase as any)
      .schema('integrations').from('instagram_posts')
      .select('ig_media_id, timestamp_post, like_count, comments_count')
      .eq('bar_id', barId)
      .gte('timestamp_post', desde90);

    // Pega insight mais recente por post
    let insightsPorPost = new Map<string, any>();
    if (posts?.length) {
      const ids = posts.map((p: any) => p.ig_media_id);
      const { data: insights } = await (supabase as any)
        .schema('integrations').from('instagram_post_insights')
        .select('ig_media_id, data_snapshot, reach, total_interactions, likes, comments, shares, saved')
        .eq('bar_id', barId).in('ig_media_id', ids)
        .order('data_snapshot', { ascending: false });
      for (const ins of (insights ?? [])) {
        if (!insightsPorPost.has(ins.ig_media_id)) insightsPorPost.set(ins.ig_media_id, ins);
      }
    }

    // Agrupa engajamento por hora (UTC do timestamp_post)
    const engajPorHora: Record<number, number[]> = {};
    for (const p of (posts ?? [])) {
      const ins = insightsPorPost.get(p.ig_media_id);
      const engaj = (ins?.total_interactions ?? 0) ||
        ((ins?.likes ?? p.like_count ?? 0) + (ins?.comments ?? p.comments_count ?? 0) + (ins?.shares ?? 0) + (ins?.saved ?? 0));
      if (engaj <= 0) continue;
      const h = new Date(p.timestamp_post).getUTCHours();
      // Ajuste BR timezone (-3) — converte hora UTC pra hora BRT
      const hBrt = (h - 3 + 24) % 24;
      if (!engajPorHora[hBrt]) engajPorHora[hBrt] = [];
      engajPorHora[hBrt].push(engaj);
    }

    const mediaEngajPorHora: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      const arr = engajPorHora[h] || [];
      mediaEngajPorHora[h] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    }

    // 3) Normaliza ambos pra 0-100 e combina (60% online + 40% engaj)
    const maxOnline = Math.max(...Object.values(onlineFollowers).map(v => Number(v) || 0), 1);
    const maxEngaj = Math.max(...Object.values(mediaEngajPorHora), 1);
    const tempHistoricoConfiavel = posts && posts.length >= 5;

    const horas: { hora: number; online: number; engaj_medio: number; score: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const online = Number(onlineFollowers[String(h)] ?? 0);
      const engaj = mediaEngajPorHora[h];
      const onlineNorm = (online / maxOnline) * 100;
      const engajNorm = (engaj / maxEngaj) * 100;
      const score = tempHistoricoConfiavel
        ? Math.round(0.6 * onlineNorm + 0.4 * engajNorm)
        : Math.round(onlineNorm);
      horas.push({ hora: h, online, engaj_medio: Math.round(engaj), score });
    }

    const top3 = [...horas].sort((a, b) => b.score - a.score).slice(0, 3);

    return NextResponse.json({
      success: true,
      base_dados: {
        posts_analisados: posts?.length ?? 0,
        tem_online_followers: Object.keys(onlineFollowers).length > 0,
        usa_engajamento_historico: tempHistoricoConfiavel,
      },
      horas,
      top_3_horarios: top3,
    });
  } catch (e: any) {
    console.error('[ig/best-time] excecao:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
