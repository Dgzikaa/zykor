/**
 * @camada bronze
 * @jobName instagram-sync-posts
 * @descricao Sync de posts (feed + reels) do IG. 1x/dia, 5h BRT.
 *
 * Posts são permanentes — buscamos /me/media e salvamos novos ou
 * atualizamos snapshots (caption pode ser editada, like_count muda).
 * Insights ficam pra função separada (instagram-sync-insights-posts).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  listarContasAtivas,
  igGetAllPaged,
  startSyncLog,
  marcarUltimaSync,
  isTokenInvalido,
} from '../_shared/instagram-client.ts';

const POST_FIELDS = [
  'id',
  'media_type',
  'media_product_type',
  'caption',
  'permalink',
  'media_url',
  'thumbnail_url',
  'timestamp',
  'is_shared_to_feed',
  'comments_count',
  'like_count',
].join(',');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const contas = await listarContasAtivas(supabase);
  const resultadosPorBar: Array<{ bar_id: number; novos: number; atualizados: number; erro?: string }> = [];

  for (const conta of contas) {
    const log = await startSyncLog(supabase, conta.bar_id, 'posts');
    let novos = 0;
    let atualizados = 0;
    let processados = 0;

    try {
      const posts = await igGetAllPaged<any>(
        `${conta.ig_business_id}/media`,
        conta.access_token,
        { fields: POST_FIELDS, limit: 50 },
        10, // até 500 posts
      );

      for (const p of posts) {
        processados++;
        const row = {
          bar_id: conta.bar_id,
          ig_media_id: p.id,
          media_type: p.media_type,
          media_product_type: p.media_product_type,
          caption: p.caption || null,
          permalink: p.permalink,
          media_url: p.media_url,
          thumbnail_url: p.thumbnail_url,
          timestamp_post: p.timestamp,
          is_shared_to_feed: p.is_shared_to_feed,
          comments_count: p.comments_count ?? null,
          like_count: p.like_count ?? null,
          raw_data: p,
          atualizado_em: new Date().toISOString(),
        };

        const { data: existente } = await supabase
          .from('instagram_posts')
          .select('id')
          .eq('bar_id', conta.bar_id)
          .eq('ig_media_id', p.id)
          .maybeSingle();

        const { error } = await supabase
          .from('instagram_posts')
          .upsert(row, { onConflict: 'bar_id,ig_media_id' });

        if (error) {
          console.error('[ig-posts] upsert erro:', error);
        } else if (existente) {
          atualizados++;
        } else {
          novos++;
        }
      }

      await marcarUltimaSync(supabase, conta.bar_id);
      await log.finalizar({
        status: 'success',
        itens_processados: processados,
        itens_novos: novos,
        itens_atualizados: atualizados,
      });
      resultadosPorBar.push({ bar_id: conta.bar_id, novos, atualizados });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ig-posts] bar ${conta.bar_id} erro:`, msg);
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
        itens_atualizados: atualizados,
        erro_mensagem: msg,
      });
      resultadosPorBar.push({ bar_id: conta.bar_id, novos, atualizados, erro: msg });
    }
  }

  return new Response(
    JSON.stringify({ success: true, bars: resultadosPorBar }),
    { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
  );
});
