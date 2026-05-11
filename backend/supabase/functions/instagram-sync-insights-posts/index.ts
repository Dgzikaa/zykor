/**
 * @camada bronze
 * @jobName instagram-sync-insights-posts
 * @descricao Snapshot diário de insights dos posts dos últimos 90 dias. 1x/dia, 6h BRT.
 *
 * Insights de posts acumulam ao longo do tempo (reach, impressions, saved, etc).
 * Salvamos um snapshot por (media_id, data) pra ter série histórica e
 * conseguir calcular crescimento e velocidade de engajamento.
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

const METRICAS_FEED = ['reach', 'saved', 'likes', 'comments', 'shares', 'total_interactions', 'views'];
const METRICAS_REEL = ['reach', 'saved', 'likes', 'comments', 'shares', 'total_interactions', 'views', 'ig_reels_avg_watch_time', 'plays'];
const DIAS_LOOKBACK = 90;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const contas = await listarContasAtivas(supabase);
  const hojeIso = new Date().toISOString().split('T')[0];
  const resultadosPorBar: Array<{ bar_id: number; processados: number; salvos: number; erro?: string }> = [];

  for (const conta of contas) {
    const log = await startSyncLog(supabase, conta.bar_id, 'post_insights');
    let processados = 0;
    let salvos = 0;

    try {
      // Pega posts dos últimos N dias deste bar
      const limiteData = new Date(Date.now() - DIAS_LOOKBACK * 86400_000).toISOString();
      const { data: posts, error: postsErr } = await supabase
        .from('instagram_posts')
        .select('ig_media_id, media_product_type')
        .eq('bar_id', conta.bar_id)
        .gte('timestamp_post', limiteData);

      if (postsErr) throw new Error(`Falha lendo posts: ${postsErr.message}`);

      for (const post of posts || []) {
        processados++;
        const isReel = (post as any).media_product_type === 'REELS';
        const metrics = (isReel ? METRICAS_REEL : METRICAS_FEED).join(',');

        try {
          const ins = await igGet<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
            `${(post as any).ig_media_id}/insights`,
            conta.access_token,
            { metric: metrics },
          );

          const mapa: Record<string, number> = {};
          for (const m of ins.data || []) {
            mapa[m.name] = m.values?.[0]?.value ?? 0;
          }

          const { error: upErr } = await supabase
            .from('instagram_post_insights')
            .upsert(
              {
                bar_id: conta.bar_id,
                ig_media_id: (post as any).ig_media_id,
                data_snapshot: hojeIso,
                reach: mapa.reach ?? null,
                impressions: mapa.views ?? null, // API nova: 'views' substitui 'impressions'
                saved: mapa.saved ?? null,
                likes: mapa.likes ?? null,
                comments: mapa.comments ?? null,
                shares: mapa.shares ?? null,
                video_views: mapa.views ?? null,
                total_interactions: mapa.total_interactions ?? null,
                plays: mapa.plays ?? null,
                ig_reels_avg_watch_time: mapa.ig_reels_avg_watch_time ?? null,
                raw_data: ins,
                capturado_em: new Date().toISOString(),
              },
              { onConflict: 'bar_id,ig_media_id,data_snapshot' },
            );

          if (upErr) {
            console.error('[ig-insights] upsert erro:', upErr);
          } else {
            salvos++;
          }
        } catch (e) {
          // Posts muito antigos ou tipos não suportados podem falhar — segue
          console.warn(`[ig-insights] media ${(post as any).ig_media_id} falhou:`, String(e).slice(0, 200));
        }
      }

      await marcarUltimaSync(supabase, conta.bar_id);
      await log.finalizar({
        status: 'success',
        itens_processados: processados,
        itens_novos: salvos,
      });
      resultadosPorBar.push({ bar_id: conta.bar_id, processados, salvos });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ig-insights] bar ${conta.bar_id} erro:`, msg);
      if (isTokenInvalido(err)) {
        await supabase
          .from('instagram_contas')
          .update({ ativo: false, desconectado_em: new Date().toISOString() })
          .eq('bar_id', conta.bar_id);
      }
      await log.finalizar({
        status: 'error',
        itens_processados: processados,
        itens_novos: salvos,
        erro_mensagem: msg,
      });
      resultadosPorBar.push({ bar_id: conta.bar_id, processados, salvos, erro: msg });
    }
  }

  return new Response(
    JSON.stringify({ success: true, bars: resultadosPorBar }),
    { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
  );
});
