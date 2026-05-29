/**
 * 💬 Instagram Sync Comments + Mentions
 *
 * Roda a cada 30min (idempotente via UPSERT). Para cada bar com IG ativo:
 *   1) Para cada post dos ultimos N dias (default 30): coleta comments
 *      + replies. Upsert em integrations.instagram_comentarios.
 *   2) Coleta /me/tags (posts onde o bar foi marcado) + /me/mentioned_comment.
 *      Upsert em integrations.instagram_mencoes.
 *
 * Body: { bar_id?: number, dias_posts?: number }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const IG_GRAPH = 'https://graph.instagram.com/v22.0';

interface BarResult {
  bar_id: number;
  ig_username: string | null;
  status: 'ok' | 'erro' | 'sem_token';
  comments_inseridos: number;
  replies_inseridas: number;
  posts_processados: number;
  mentions_inseridas: number;
  tempo_ms: number;
  erro?: string;
}

async function syncBar(supabase: any, conta: any, diasPosts: number): Promise<BarResult> {
  const t0 = Date.now();
  const barId = conta.bar_id;
  const token = conta.access_token as string;

  const result: BarResult = {
    bar_id: barId,
    ig_username: conta.ig_username,
    status: 'ok',
    comments_inseridos: 0,
    replies_inseridas: 0,
    posts_processados: 0,
    mentions_inseridas: 0,
    tempo_ms: 0,
  };

  // Log
  const { data: logRow } = await supabase
    .schema('integrations').from('instagram_sync_logs')
    .insert({ bar_id: barId, tipo_sync: 'comments_mentions', status: 'em_execucao', iniciado_em: new Date().toISOString() })
    .select('id').single();
  const logId = logRow?.id;

  try {
    const desdeMs = Date.now() - diasPosts * 86400000;
    const desdeISO = new Date(desdeMs).toISOString();

    // ===== 1) COMMENTS DOS POSTS DO BAR =====
    const { data: posts } = await supabase
      .schema('integrations').from('instagram_posts')
      .select('ig_media_id')
      .eq('bar_id', barId)
      .gte('timestamp_post', desdeISO);

    let commentsRows = 0;
    let repliesRows = 0;

    for (const p of (posts || [])) {
      try {
        // /comments retorna top-level comments com replies aninhadas
        const fields = 'id,text,timestamp,username,like_count,from{id,username},replies{id,text,timestamp,username,like_count,from{id,username}}';
        const r = await fetch(`${IG_GRAPH}/${p.ig_media_id}/comments?fields=${fields}&limit=50&access_token=${token}`);
        if (!r.ok) continue;
        const j = await r.json();
        const topComments: any[] = j.data || [];

        for (const c of topComments) {
          // Top-level
          const topRow = {
            bar_id: barId,
            ig_media_id: p.ig_media_id,
            ig_comment_id: c.id,
            parent_comment_id: null,
            autor_username: c.username ?? c.from?.username ?? null,
            autor_id: c.from?.id ?? null,
            autor_picture_url: null,
            texto: c.text ?? null,
            like_count: c.like_count ?? 0,
            timestamp_post: c.timestamp ?? null,
            raw_data: c,
            capturado_em: new Date().toISOString(),
          };
          const { error } = await supabase
            .schema('integrations').from('instagram_comentarios')
            .upsert(topRow, { onConflict: 'bar_id,ig_comment_id' });
          if (!error) commentsRows++;

          // Replies (filhos)
          const replies: any[] = c.replies?.data || [];
          for (const rep of replies) {
            const repRow = {
              bar_id: barId,
              ig_media_id: p.ig_media_id,
              ig_comment_id: rep.id,
              parent_comment_id: c.id,
              autor_username: rep.username ?? rep.from?.username ?? null,
              autor_id: rep.from?.id ?? null,
              autor_picture_url: null,
              texto: rep.text ?? null,
              like_count: rep.like_count ?? 0,
              timestamp_post: rep.timestamp ?? null,
              raw_data: rep,
              capturado_em: new Date().toISOString(),
            };
            const { error: errRep } = await supabase
              .schema('integrations').from('instagram_comentarios')
              .upsert(repRow, { onConflict: 'bar_id,ig_comment_id' });
            if (!errRep) repliesRows++;
          }
        }
        result.posts_processados++;
      } catch (e) {
        console.warn(`[ig-comments] post ${p.ig_media_id}:`, e);
      }
    }
    result.comments_inseridos = commentsRows;
    result.replies_inseridas = repliesRows;

    // ===== 2) MENTIONS — /me/tags (posts onde o bar foi marcado) =====
    let mentionsRows = 0;
    try {
      const fields = 'id,caption,media_type,permalink,timestamp,media_url,thumbnail_url,username,owner{id,username}';
      const r = await fetch(`${IG_GRAPH}/me/tags?fields=${fields}&limit=25&access_token=${token}`);
      if (r.ok) {
        const j = await r.json();
        const tagged: any[] = j.data || [];
        for (const t of tagged) {
          if (t.timestamp && new Date(t.timestamp).getTime() < desdeMs) continue;
          const row = {
            bar_id: barId,
            ig_media_id: t.id,
            ig_comment_id: null,
            tipo_mencao: 'post_tag',
            autor_username: t.username ?? t.owner?.username ?? null,
            autor_id: t.owner?.id ?? null,
            autor_picture_url: null,
            caption: t.caption ?? null,
            texto_comment: null,
            media_type: t.media_type ?? null,
            media_url: t.media_url ?? null,
            thumbnail_url: t.thumbnail_url ?? null,
            permalink: t.permalink ?? null,
            timestamp_post: t.timestamp ?? null,
            raw_data: t,
            capturado_em: new Date().toISOString(),
          };
          // Upsert via select + insert (constraint parcial complica .upsert)
          const { data: existente } = await supabase
            .schema('integrations').from('instagram_mencoes')
            .select('id').eq('bar_id', barId).eq('ig_media_id', t.id).is('ig_comment_id', null).maybeSingle();
          if (existente?.id) {
            await supabase.schema('integrations').from('instagram_mencoes').update(row).eq('id', existente.id);
          } else {
            await supabase.schema('integrations').from('instagram_mencoes').insert(row);
            mentionsRows++;
          }
        }
      } else {
        console.warn(`[ig-mentions] /me/tags:`, await r.text());
      }
    } catch (e) {
      console.warn(`[ig-mentions] erro:`, e);
    }
    result.mentions_inseridas = mentionsRows;

    result.tempo_ms = Date.now() - t0;
    if (logId) {
      await supabase.schema('integrations').from('instagram_sync_logs').update({
        status: 'ok',
        itens_processados: result.posts_processados,
        itens_atualizados: result.comments_inseridos + result.replies_inseridas + result.mentions_inseridas,
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
        status: 'erro', erro_mensagem: result.erro,
        duracao_ms: result.tempo_ms, concluido_em: new Date().toISOString(),
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
    const diasPosts: number = body?.dias_posts ?? 30;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = supabase.schema('integrations').from('instagram_contas')
      .select('bar_id, ig_username, access_token, ativo').eq('ativo', true);
    if (filterBarId) q = q.eq('bar_id', filterBarId);
    const { data: contas } = await q;
    if (!contas?.length) {
      return new Response(JSON.stringify({ success: true, contas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados: BarResult[] = [];
    for (const conta of contas) {
      if (!conta.access_token) {
        resultados.push({
          bar_id: conta.bar_id, ig_username: conta.ig_username, status: 'sem_token',
          comments_inseridos: 0, replies_inseridas: 0, posts_processados: 0,
          mentions_inseridas: 0, tempo_ms: 0,
        });
        continue;
      }
      resultados.push(await syncBar(supabase, conta, diasPosts));
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
