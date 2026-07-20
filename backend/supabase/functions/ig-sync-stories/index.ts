/**
 * 📸 Instagram Sync Stories
 *
 * Itera bares com IG ativo e popula:
 *   - integrations.instagram_stories (lista + insights por story)
 *
 * Stories tem 24h life — rodar a cada 2h pra não perder antes de expirar.
 * Upsert por (bar_id, ig_media_id), idempotente.
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
  stories_descobertos: number;
  stories_atualizados: number;
  tempo_ms: number;
  erro?: string;
}

async function syncStoriesBar(supabase: any, conta: any): Promise<BarSyncResult> {
  const t0 = Date.now();
  const barId = conta.bar_id as number;
  const token = conta.access_token as string;

  const result: BarSyncResult = {
    bar_id: barId,
    ig_username: conta.ig_username,
    status: 'ok',
    stories_descobertos: 0,
    stories_atualizados: 0,
    tempo_ms: 0,
  };

  const { data: logRow } = await supabase
    .schema('integrations')
    .from('instagram_sync_logs')
    .insert({
      bar_id: barId,
      tipo_sync: 'stories',
      status: 'em_execucao',
      iniciado_em: new Date().toISOString(),
    })
    .select('id')
    .single();
  const logId = logRow?.id;

  try {
    // Lista stories ativos — PAGINADO. /me/stories devolve 25 por página; sem seguir
    // paging.next a gente perdia todo o excedente quando havia >25 stories ativos ao
    // mesmo tempo (bar posta em rajada). Teto de 20 páginas (500 stories) por segurança.
    const fields = 'id,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url';
    const stories: any[] = [];
    let listUrl: string | null =
      `${IG_GRAPH}/me/stories?fields=${fields}&limit=50&access_token=${token}`;
    for (let page = 0; page < 20 && listUrl; page++) {
      const listRes = await fetch(listUrl);
      if (!listRes.ok) {
        const err = await listRes.json();
        throw new Error(`Stories list: ${JSON.stringify(err).slice(0, 200)}`);
      }
      const listJson = await listRes.json();
      if (Array.isArray(listJson.data)) stories.push(...listJson.data);
      listUrl = listJson?.paging?.next || null;
    }
    result.stories_descobertos = stories.length;

    if (stories.length === 0) {
      result.tempo_ms = Date.now() - t0;
      if (logId) {
        await supabase.schema('integrations').from('instagram_sync_logs').update({
          status: 'ok',
          itens_processados: 0,
          duracao_ms: result.tempo_ms,
          concluido_em: new Date().toISOString(),
        }).eq('id', logId);
      }
      return result;
    }

    // Insights por story. IMPORTANTE: na Graph API v22 algumas métricas foram
    // depreciadas (impressions, exits, taps_forward, taps_back, swipe_forward).
    // Num batch, UMA métrica inválida derruba a chamada inteira (400) -> tudo null.
    // Por isso buscamos métrica por métrica (best-effort): as válidas voltam,
    // as inválidas falham sozinhas sem afetar as outras.
    const metricCandidates = [
      'reach', 'replies', 'profile_visits', 'follows', 'shares',
      'total_interactions', 'views', // novas (v22)
      'exits', 'taps_forward', 'taps_back', 'swipe_forward', // legadas (podem 400)
    ];

    async function fetchInsights(mediaId: string): Promise<Record<string, number>> {
      const map: Record<string, number> = {};
      for (const metric of metricCandidates) {
        try {
          const res = await fetch(
            `${IG_GRAPH}/${mediaId}/insights?metric=${metric}&access_token=${token}`,
          );
          if (!res.ok) {
            // métrica não suportada nessa conta/versão — segue pras outras
            continue;
          }
          const j = await res.json();
          for (const item of (j.data || [])) {
            // v22 usa total_value.value; versões antigas usam values[0].value
            const v = item?.total_value?.value ?? item?.values?.[0]?.value;
            if (v !== undefined && v !== null) map[item.name] = Number(v) || 0;
          }
        } catch (e) {
          console.warn(`[ig-stories] insight ${metric} ${mediaId}:`, e);
        }
      }
      return map;
    }

    let inseridos = 0;
    for (const s of stories) {
      const insMap = await fetchInsights(s.id);

      const row = {
        bar_id: barId,
        ig_media_id: s.id,
        media_type: s.media_type ?? null,
        permalink: s.permalink ?? null,
        media_url: s.media_url ?? null,
        thumbnail_url: s.thumbnail_url ?? null,
        timestamp_post: s.timestamp ?? null,
        impressions: insMap.impressions ?? null,
        reach: insMap.reach ?? null,
        replies: insMap.replies ?? null,
        exits: insMap.exits ?? null,
        taps_forward: insMap.taps_forward ?? null,
        taps_back: insMap.taps_back ?? null,
        swipe_forward: insMap.swipe_forward ?? null,
        profile_visits: insMap.profile_visits ?? null,
        follows: insMap.follows ?? null,
        shares: insMap.shares ?? null,
        raw_data: { story: s, insights: insMap },
        capturado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .schema('integrations')
        .from('instagram_stories')
        .upsert(row, { onConflict: 'bar_id,ig_media_id' });
      if (!error) inseridos++;
      else console.warn(`[ig-stories] upsert ${s.id}:`, error);
    }
    result.stories_atualizados = inseridos;
    result.tempo_ms = Date.now() - t0;

    if (logId) {
      await supabase.schema('integrations').from('instagram_sync_logs').update({
        status: 'ok',
        itens_processados: stories.length,
        itens_atualizados: inseridos,
        duracao_ms: result.tempo_ms,
        concluido_em: new Date().toISOString(),
      }).eq('id', logId);
    }
    return result;
  } catch (e: any) {
    result.status = 'erro';
    result.erro = e?.message || String(e);
    result.tempo_ms = Date.now() - t0;
    if (logId) {
      await supabase.schema('integrations').from('instagram_sync_logs').update({
        status: 'erro',
        erro_mensagem: result.erro,
        duracao_ms: result.tempo_ms,
        concluido_em: new Date().toISOString(),
      }).eq('id', logId);
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let q = supabase
      .schema('integrations')
      .from('instagram_contas')
      .select('bar_id, ig_username, ig_business_id, access_token, ativo')
      .eq('ativo', true);
    if (filterBarId) q = q.eq('bar_id', filterBarId);
    const { data: contas, error } = await q;

    if (error || !contas?.length) {
      return new Response(JSON.stringify({ success: true, contas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados: BarSyncResult[] = [];
    for (const conta of contas) {
      if (!conta.access_token) {
        resultados.push({
          bar_id: conta.bar_id, ig_username: conta.ig_username, status: 'sem_token',
          stories_descobertos: 0, stories_atualizados: 0, tempo_ms: 0,
        });
        continue;
      }
      const r = await syncStoriesBar(supabase, conta);
      resultados.push(r);
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[ig-sync-stories] excecao:', e);
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
