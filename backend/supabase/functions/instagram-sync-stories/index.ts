/**
 * @camada bronze
 * @jobName instagram-sync-stories
 * @descricao Captura stories ativos + métricas (a cada 4h)
 *
 * Stories no Instagram somem da Graph API após 24h, e as métricas
 * (impressions, reach, replies, etc) só são acessíveis enquanto o story
 * está vivo. Por isso esta function:
 *   1. Roda a cada 4h (6x/dia) — garante captura de TODOS os stories
 *   2. Faz captura única: insere com métricas no momento e nunca mais
 *      atualiza (porque depois de 24h não dá pra buscar de novo)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  listarContasAtivas,
  igGet,
  startSyncLog,
  marcarUltimaSync,
  isTokenInvalido,
} from '../_shared/instagram-client.ts';

const STORY_INSIGHT_METRICS = [
  'impressions',
  'reach',
  'replies',
  'navigation',  // substitui exits/taps_forward/taps_back nas APIs mais novas
  'follows',
  'profile_visits',
  'shares',
].join(',');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const contas = await listarContasAtivas(supabase);
  const resultadosPorBar: Array<{ bar_id: number; novos: number; processados: number; erro?: string }> = [];

  for (const conta of contas) {
    const log = await startSyncLog(supabase, conta.bar_id, 'stories');
    let novos = 0;
    let processados = 0;

    try {
      const resp = await igGet<{ data: Array<{ id: string }> }>(
        `${conta.ig_business_id}/stories`,
        conta.access_token,
        { fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp' },
      );

      const stories = resp.data || [];

      for (const story of stories) {
        processados++;
        const storyDetail = story as any;

        // Verifica se já existe (não atualizamos métricas antigas — captura é única)
        const { data: existente } = await supabase
          .from('instagram_stories')
          .select('id, impressions')
          .eq('bar_id', conta.bar_id)
          .eq('ig_media_id', story.id)
          .maybeSingle();

        // Se já tem métricas registradas, pula (não dá pra refetch após 24h)
        if (existente && (existente as any).impressions != null) continue;

        // Busca insights — só funciona se story ainda ativo
        let insights: Record<string, number> = {};
        try {
          const insResp = await igGet<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
            `${story.id}/insights`,
            conta.access_token,
            { metric: STORY_INSIGHT_METRICS },
          );
          for (const m of insResp.data || []) {
            insights[m.name] = m.values?.[0]?.value ?? 0;
          }
        } catch (e) {
          // Insights podem falhar pra stories muito recentes (sem dados) ou expirados
          console.warn(`[ig-stories] insights falharam pra ${story.id}:`, String(e).slice(0, 200));
        }

        const row = {
          bar_id: conta.bar_id,
          ig_media_id: story.id,
          media_type: storyDetail.media_type,
          permalink: storyDetail.permalink,
          media_url: storyDetail.media_url,
          thumbnail_url: storyDetail.thumbnail_url,
          timestamp_post: storyDetail.timestamp,
          impressions: insights.impressions ?? null,
          reach: insights.reach ?? null,
          replies: insights.replies ?? null,
          follows: insights.follows ?? null,
          profile_visits: insights.profile_visits ?? null,
          shares: insights.shares ?? null,
          raw_data: { story: storyDetail, insights },
        };

        const { error } = await supabase
          .from('instagram_stories')
          .upsert(row, { onConflict: 'bar_id,ig_media_id' });

        if (error) {
          console.error(`[ig-stories] upsert erro:`, error);
        } else if (!existente) {
          novos++;
        }
      }

      await marcarUltimaSync(supabase, conta.bar_id);
      await log.finalizar({
        status: 'success',
        itens_processados: processados,
        itens_novos: novos,
      });
      resultadosPorBar.push({ bar_id: conta.bar_id, novos, processados });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ig-stories] bar ${conta.bar_id} erro:`, msg);

      if (isTokenInvalido(err)) {
        await supabase
          .from('instagram_contas')
          .update({ ativo: false, desconectado_em: new Date().toISOString() })
          .eq('bar_id', conta.bar_id);
      }

      await log.finalizar({
        status: 'error',
        itens_processados: processados,
        itens_novos: novos,
        erro_mensagem: msg,
      });
      resultadosPorBar.push({ bar_id: conta.bar_id, novos, processados, erro: msg });
    }
  }

  return new Response(
    JSON.stringify({ success: true, bars: resultadosPorBar }),
    { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
  );
});
