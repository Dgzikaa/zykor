/**
 * 📊 Instagram Sync Diário
 *
 * Itera bares com IG ativo e popula:
 *   - integrations.instagram_contas       (perfil: nome, bio, foto, account_type)
 *   - integrations.instagram_conta_metricas (counts + insights diarios)
 *   - integrations.instagram_posts         (upsert posts ultimos 30 dias)
 *   - integrations.instagram_post_insights (snapshot diario de metricas por post)
 *   - integrations.instagram_sync_logs     (log de execucao)
 *
 * Idempotente — pode rodar varias vezes no mesmo dia (UPSERT por
 * (bar_id, data_snapshot) ou (bar_id, ig_media_id)).
 *
 * Body opcional:
 *   { bar_id?: number, dias_posts?: number }
 *   - bar_id: roda so 1 bar (default: todos com ativo=true)
 *   - dias_posts: janela de posts a refrescar (default: 30)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const IG_GRAPH = 'https://graph.instagram.com/v22.0';

interface BarSyncResult {
  bar_id: number;
  ig_username: string | null;
  status: 'ok' | 'erro' | 'sem_token';
  perfil_atualizado: boolean;
  insights_atualizado: boolean;
  posts_descobertos: number;
  posts_atualizados: number;
  metricas_inseridas: number;
  tempo_ms: number;
  erro?: string;
}

async function syncBar(
  supabase: any,
  conta: any,
  diasPosts: number,
): Promise<BarSyncResult> {
  const t0 = Date.now();
  const barId = conta.bar_id as number;
  const token = conta.access_token as string;
  const igBusinessId = conta.ig_business_id as string;
  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const result: BarSyncResult = {
    bar_id: barId,
    ig_username: conta.ig_username,
    status: 'ok',
    perfil_atualizado: false,
    insights_atualizado: false,
    posts_descobertos: 0,
    posts_atualizados: 0,
    metricas_inseridas: 0,
    tempo_ms: 0,
  };

  // Cria row de log
  const { data: logRow } = await supabase
    .schema('integrations')
    .from('instagram_sync_logs')
    .insert({
      bar_id: barId,
      tipo_sync: 'diario',
      status: 'em_execucao',
      iniciado_em: new Date().toISOString(),
    })
    .select('id')
    .single();

  const logId = logRow?.id;

  try {
    // ====== 1. PERFIL + COUNTS ======
    const perfilFields = [
      'user_id', 'username', 'name', 'biography', 'profile_picture_url',
      'account_type', 'followers_count', 'follows_count', 'media_count',
    ].join(',');
    const perfilRes = await fetch(
      `${IG_GRAPH}/me?fields=${perfilFields}&access_token=${token}`,
    );
    if (!perfilRes.ok) {
      const err = await perfilRes.json();
      throw new Error(`Perfil IG: ${JSON.stringify(err).slice(0, 200)}`);
    }
    const perfil = await perfilRes.json();

    // Update conta com perfil estatico
    await supabase
      .schema('integrations')
      .from('instagram_contas')
      .update({
        ig_username: perfil.username ?? conta.ig_username,
        name: perfil.name ?? null,
        biography: perfil.biography ?? null,
        profile_picture_url: perfil.profile_picture_url ?? null,
        account_type: perfil.account_type ?? null,
        sincronizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('bar_id', barId);

    result.perfil_atualizado = true;

    // ====== 2. INSIGHTS DIARIOS DE CONTA (D-1) ======
    //
    // v22 mudou MUITO. Lessons learned:
    //   - since/until exato (=ontem) retorna data:[] vazio. Sem isso retorna
    //     array com ate ~2 valores recentes (ultimo completo + parcial hoje).
    //   - Varias metrics (accounts_engaged, total_interactions, views) so
    //     funcionam com metric_type=total_value (retorna 1 agregado, n array).
    //   - profile_views/website_clicks/reach aceitam period=day legacy.
    //   - 'impressions' foi depreciado; substituto eh 'views'.
    //
    // Estrategia: 2 chamadas separadas (metric_type=total_value vs legacy).
    const insightsData: Record<string, number> = {};

    // 2a) `reach` eh a unica que aceita period=day legacy (com end_time array).
    //     Pegamos o ultimo valor com end_time <= now (= janela D-1 completa).
    try {
      const r = await fetch(
        `${IG_GRAPH}/me/insights?metric=reach&period=day&access_token=${token}`,
      );
      if (r.ok) {
        const j = await r.json();
        for (const item of (j.data || [])) {
          const nowMs = Date.now();
          const vals = (item.values || []).filter((v: any) => new Date(v.end_time).getTime() <= nowMs);
          const last = vals[vals.length - 1];
          if (last?.value != null) insightsData[item.name] = Number(last.value) || 0;
        }
      }
    } catch (e) {
      console.warn(`[ig-sync] insights reach falhou bar ${barId}:`, e);
    }

    // 2b) Metrics que mudaram pra metric_type=total_value na v22.
    try {
      const metricsTotal = [
        'profile_views',
        'website_clicks',
        'profile_links_taps',
        'accounts_engaged',
        'total_interactions',
        'views',
        'follower_count',
      ];
      const r = await fetch(
        `${IG_GRAPH}/me/insights?metric=${metricsTotal.join(',')}&period=day&metric_type=total_value&access_token=${token}`,
      );
      if (r.ok) {
        const j = await r.json();
        for (const item of (j.data || [])) {
          const v = item.total_value?.value;
          if (v != null) insightsData[item.name] = Number(v) || 0;
        }
      }
    } catch (e) {
      console.warn(`[ig-sync] insights total_value falhou bar ${barId}:`, e);
    }

    // 2c) Reach breakdown por media_product_type (POST, REEL, STORY, AD, ...)
    let reachBreakdown: Record<string, number> | null = null;
    try {
      const r = await fetch(
        `${IG_GRAPH}/me/insights?metric=reach&period=day&metric_type=total_value&breakdown=media_product_type&access_token=${token}`,
      );
      if (r.ok) {
        const j = await r.json();
        const bds = j.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        reachBreakdown = {};
        for (const it of bds) {
          const key = it.dimension_values?.[0];
          if (key) reachBreakdown[key] = Number(it.value) || 0;
        }
      }
    } catch (e) {
      console.warn(`[ig-sync] reach breakdown falhou bar ${barId}:`, e);
    }

    // 2d) Follower demographics (lifetime, breakdowns separados)
    //
    // Helper: chama lifetime com um breakdown e retorna { dimVal: count }
    async function fetchDemographics(metricName: string, breakdown: string): Promise<Record<string, number> | null> {
      try {
        const r = await fetch(
          `${IG_GRAPH}/me/insights?metric=${metricName}&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${token}`,
        );
        if (!r.ok) return null;
        const j = await r.json();
        const bds = j.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        const out: Record<string, number> = {};
        for (const it of bds) {
          const key = it.dimension_values?.[0];
          if (key) out[key] = Number(it.value) || 0;
        }
        return out;
      } catch {
        return null;
      }
    }

    const followerCity   = await fetchDemographics('follower_demographics', 'city');
    const followerCountry = await fetchDemographics('follower_demographics', 'country');
    const followerAge    = await fetchDemographics('follower_demographics', 'age');
    const followerGender = await fetchDemographics('follower_demographics', 'gender');

    const engagedCity    = await fetchDemographics('engaged_audience_demographics', 'city');
    const engagedCountry = await fetchDemographics('engaged_audience_demographics', 'country');
    const engagedAge     = await fetchDemographics('engaged_audience_demographics', 'age');
    const engagedGender  = await fetchDemographics('engaged_audience_demographics', 'gender');

    const audienceGenderAge = (followerGender || followerAge)
      ? { gender: followerGender ?? {}, age: followerAge ?? {} }
      : null;
    const engagedAudience = (engagedGender || engagedAge || engagedCity || engagedCountry)
      ? {
          gender: engagedGender ?? {},
          age: engagedAge ?? {},
          city: engagedCity ?? {},
          country: engagedCountry ?? {},
        }
      : null;

    // online_followers (heatmap por hora) — endpoint separado
    let onlineFollowers: any = null;
    try {
      const ofRes = await fetch(
        `${IG_GRAPH}/${igBusinessId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
      );
      if (ofRes.ok) {
        const j = await ofRes.json();
        onlineFollowers = j.data?.[0]?.values?.[0]?.value ?? null;
      }
    } catch { /* nao critico */ }

    // Upsert conta_metricas com tudo (account metrics + demographics + breakdowns)
    const metricasRow: Record<string, any> = {
      bar_id: barId,
      data_snapshot: ontem,
      followers_count: perfil.followers_count ?? null,
      follows_count: perfil.follows_count ?? null,
      media_count: perfil.media_count ?? null,
      // account metrics (v22)
      reach: insightsData.reach ?? null,
      impressions: insightsData.views ?? null,  // views eh o novo impressions
      profile_views: insightsData.profile_views ?? null,
      website_clicks: insightsData.website_clicks ?? null,
      profile_links_taps: insightsData.profile_links_taps ?? null,
      accounts_engaged: insightsData.accounts_engaged ?? null,
      total_interactions: insightsData.total_interactions ?? null,
      // heatmap online_followers por hora
      online_followers: onlineFollowers ? JSON.stringify(onlineFollowers) : null,
      // reach by media_product_type (POST/REEL/STORY/AD/CAROUSEL_CONTAINER)
      reach_breakdown: reachBreakdown,
      // follower demographics
      audience_city: followerCity,
      audience_country: followerCountry,
      audience_gender_age: audienceGenderAge,
      // engaged audience (subset que realmente interage)
      engaged_audience: engagedAudience,
      raw_data: { perfil, insights: insightsData },
      capturado_em: new Date().toISOString(),
    };

    await supabase
      .schema('integrations')
      .from('instagram_conta_metricas')
      .upsert(metricasRow, { onConflict: 'bar_id,data_snapshot' });

    result.insights_atualizado = true;

    // ====== 3. POSTS (ultimos N dias) ======
    const desdeMs = Date.now() - diasPosts * 86400000;
    const desdeISO = new Date(desdeMs).toISOString();

    const postsFields = [
      'id', 'caption', 'media_type', 'media_product_type', 'permalink',
      'timestamp', 'thumbnail_url', 'media_url', 'is_shared_to_feed',
      'comments_count', 'like_count',
    ].join(',');

    let nextUrl: string | null = `${IG_GRAPH}/me/media?fields=${postsFields}&limit=50&access_token=${token}`;
    let posts: any[] = [];
    let paginas = 0;

    while (nextUrl && paginas < 10) {
      const r: Response = await fetch(nextUrl);
      if (!r.ok) {
        console.warn(`[ig-sync] erro listando posts bar ${barId}:`, await r.text());
        break;
      }
      const j: any = await r.json();
      const batch = (j.data || []);
      // Filtra pelos ultimos N dias
      for (const p of batch) {
        if (new Date(p.timestamp).getTime() >= desdeMs) {
          posts.push(p);
        }
      }
      // Se o ultimo do batch ja eh anterior a desdeMs, n precisa paginar mais
      const ultimo = batch[batch.length - 1];
      if (!ultimo || new Date(ultimo.timestamp).getTime() < desdeMs) break;
      nextUrl = j.paging?.next ?? null;
      paginas++;
    }

    // Upsert posts
    if (posts.length > 0) {
      const postsRows = posts.map(p => ({
        bar_id: barId,
        ig_media_id: p.id,
        media_type: p.media_type ?? null,
        media_product_type: p.media_product_type ?? null,
        caption: p.caption ?? null,
        permalink: p.permalink ?? null,
        media_url: p.media_url ?? null,
        thumbnail_url: p.thumbnail_url ?? null,
        timestamp_post: p.timestamp ?? null,
        is_shared_to_feed: p.is_shared_to_feed ?? null,
        comments_count: p.comments_count ?? null,
        like_count: p.like_count ?? null,
        raw_data: p,
        atualizado_em: new Date().toISOString(),
      }));

      const { error: upPostsErr, count } = await supabase
        .schema('integrations')
        .from('instagram_posts')
        .upsert(postsRows, { onConflict: 'bar_id,ig_media_id', count: 'exact' });

      if (upPostsErr) {
        console.error(`[ig-sync] erro upsert posts bar ${barId}:`, upPostsErr);
      } else {
        result.posts_atualizados = count ?? posts.length;
      }
    }
    result.posts_descobertos = posts.length;

    // ====== 4. INSIGHTS POR POST (snapshot do dia) ======
    //
    // Metricas variam por media_type:
    //   IMAGE/CAROUSEL: impressions, reach, engagement, saved, likes,
    //                   comments, shares
    //   VIDEO/REEL:     plays, ig_reels_avg_watch_time, reach, likes, comments,
    //                   shares, saved, total_interactions
    //
    // Pra simplificar pedimos tudo e ignoramos os que dao "metric not
    // supported" pelo tipo.
    // Metricas por tipo de media — Graph API v22 rejeita metrics nao
    // suportadas pelo tipo. Pedimos so as compativeis por subset:
    const metricasComuns = ['reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'];
    const metricasReel   = [...metricasComuns, 'views', 'ig_reels_avg_watch_time'];
    const metricasVideo  = [...metricasComuns, 'views'];
    const metricasImage  = metricasComuns;

    function metricsPara(p: any): string {
      if (p.media_product_type === 'REELS') return metricasReel.join(',');
      if (p.media_type === 'VIDEO') return metricasVideo.join(',');
      // IMAGE, CAROUSEL_ALBUM → comuns
      return metricasImage.join(',');
    }

    let metricasInseridas = 0;
    for (const p of posts) {
      try {
        const metrics = metricsPara(p);
        const insRes = await fetch(
          `${IG_GRAPH}/${p.id}/insights?metric=${metrics}&access_token=${token}`,
        );
        if (!insRes.ok) {
          const errText = await insRes.text();
          console.warn(`[ig-sync] insights post ${p.id} (${p.media_type}/${p.media_product_type}) falhou:`, errText.slice(0, 200));
          continue;
        }
        const insJ = await insRes.json();
        const insMap: Record<string, number> = {};
        for (const item of (insJ.data || [])) {
          insMap[item.name] = item.values?.[0]?.value ?? 0;
        }

        await supabase
          .schema('integrations')
          .from('instagram_post_insights')
          .upsert({
            bar_id: barId,
            ig_media_id: p.id,
            data_snapshot: hoje,
            reach: insMap.reach ?? null,
            likes: insMap.likes ?? p.like_count ?? null,
            comments: insMap.comments ?? p.comments_count ?? null,
            shares: insMap.shares ?? null,
            saved: insMap.saved ?? null,
            // video_views eh o legado — agora usamos 'views' (reels) que
            // sobe pro mesmo campo do banco p/ analytics consistente
            video_views: insMap.views ?? null,
            plays: insMap.views ?? null,
            ig_reels_avg_watch_time: insMap.ig_reels_avg_watch_time ?? null,
            total_interactions: insMap.total_interactions ?? null,
            raw_data: insMap,
            capturado_em: new Date().toISOString(),
          }, { onConflict: 'bar_id,ig_media_id,data_snapshot' });
        metricasInseridas++;
      } catch (e) {
        console.warn(`[ig-sync] erro insights post ${p.id}:`, e);
      }
    }
    result.metricas_inseridas = metricasInseridas;

    // ====== Finaliza log ======
    result.tempo_ms = Date.now() - t0;
    if (logId) {
      await supabase
        .schema('integrations')
        .from('instagram_sync_logs')
        .update({
          status: 'ok',
          itens_processados: posts.length,
          itens_novos: result.posts_descobertos,
          itens_atualizados: result.posts_atualizados,
          duracao_ms: result.tempo_ms,
          concluido_em: new Date().toISOString(),
        })
        .eq('id', logId);
    }
    return result;
  } catch (e: any) {
    result.status = 'erro';
    result.erro = e?.message || String(e);
    result.tempo_ms = Date.now() - t0;
    if (logId) {
      await supabase
        .schema('integrations')
        .from('instagram_sync_logs')
        .update({
          status: 'erro',
          erro_mensagem: result.erro,
          duracao_ms: result.tempo_ms,
          concluido_em: new Date().toISOString(),
        })
        .eq('id', logId);
    }
    return result;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const filterBarId: number | undefined = body?.bar_id;
    const diasPosts: number = body?.dias_posts ?? 30;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Lista contas ativas
    let q = supabase
      .schema('integrations')
      .from('instagram_contas')
      .select('bar_id, ig_username, ig_business_id, access_token, ativo, expires_at')
      .eq('ativo', true);
    if (filterBarId) q = q.eq('bar_id', filterBarId);
    const { data: contas, error } = await q;

    if (error || !contas?.length) {
      return new Response(
        JSON.stringify({ success: true, mensagem: 'Nenhuma conta IG ativa', contas: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const resultados: BarSyncResult[] = [];
    for (const conta of contas) {
      if (!conta.access_token) {
        resultados.push({
          bar_id: conta.bar_id,
          ig_username: conta.ig_username,
          status: 'sem_token',
          perfil_atualizado: false,
          insights_atualizado: false,
          posts_descobertos: 0,
          posts_atualizados: 0,
          metricas_inseridas: 0,
          tempo_ms: 0,
        });
        continue;
      }
      const r = await syncBar(supabase, conta, diasPosts);
      resultados.push(r);
    }

    return new Response(
      JSON.stringify({
        success: true,
        contas_processadas: resultados.length,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[ig-sync-diario] excecao:', e);
    return new Response(
      JSON.stringify({ success: false, erro: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
