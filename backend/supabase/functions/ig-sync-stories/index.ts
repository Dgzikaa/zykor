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
    // Lista stories ativos
    const fields = 'id,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url';
    const listRes = await fetch(
      `${IG_GRAPH}/me/stories?fields=${fields}&access_token=${token}`,
    );
    if (!listRes.ok) {
      const err = await listRes.json();
      throw new Error(`Stories list: ${JSON.stringify(err).slice(0, 200)}`);
    }
    const listJson = await listRes.json();
    const stories: any[] = listJson.data || [];
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

    // Insights por story — metricas suportadas: impressions, reach, replies,
    // exits, taps_forward, taps_back, swipe_forward, profile_visits, follows,
    // shares (algumas mudaram pra views/total_value na v22)
    const metrics = [
      'reach', 'replies', 'profile_visits', 'follows', 'shares',
      'taps_forward', 'taps_back', 'exits',
      // 'impressions' depreciado; em alguns casos vira 'views' total_value
    ].join(',');

    let inseridos = 0;
    for (const s of stories) {
      let insMap: Record<string, number> = {};
      try {
        const insRes = await fetch(
          `${IG_GRAPH}/${s.id}/insights?metric=${metrics}&access_token=${token}`,
        );
        if (insRes.ok) {
          const j = await insRes.json();
          for (const item of (j.data || [])) {
            insMap[item.name] = Number(item.values?.[0]?.value) || 0;
          }
        } else {
          console.warn(`[ig-stories] insights ${s.id}:`, await insRes.text());
        }
      } catch (e) {
        console.warn(`[ig-stories] insights err ${s.id}:`, e);
      }

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
