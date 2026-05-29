/**
 * 🤖 IG AI Relatório (semanal + on-demand)
 *
 * Coleta métricas de IG de um período + envia pro Claude gerar:
 *   - tipo='semanal': resumo executivo de 5 parágrafos
 *   - tipo='insights_periodo': 5-10 insights acionáveis em JSON
 *
 * Body: { bar_id, tipo, periodo_ini?, periodo_fim? }
 *   - tipo padrao 'semanal', usa últimos 7 dias se periodo_* omitido
 *
 * Salva em integrations.instagram_relatorios_ai. Opcionalmente envia Discord.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-haiku-4-5-20251001';

async function chamarClaude(prompt: string, maxTokens = 3000): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');

  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic erro: ${await r.text()}`);
  const j = await r.json();
  return {
    text: j.content?.[0]?.text || '',
    tokensIn: j.usage?.input_tokens || 0,
    tokensOut: j.usage?.output_tokens || 0,
  };
}

async function coletarMetricas(supabase: any, barId: number, di: string, df: string) {
  // Perfil + conta
  const { data: conta } = await supabase.schema('integrations').from('instagram_contas')
    .select('ig_username, name, account_type').eq('bar_id', barId).maybeSingle();

  // Snapshots no período
  const { data: snaps } = await supabase.schema('integrations').from('instagram_conta_metricas')
    .select('data_snapshot, followers_count, reach, impressions, profile_views, website_clicks, accounts_engaged, total_interactions')
    .eq('bar_id', barId).gte('data_snapshot', di).lte('data_snapshot', df)
    .order('data_snapshot', { ascending: true });

  const primeiro = snaps?.[0];
  const ultimo = snaps?.[snaps.length - 1];
  const totais = (snaps ?? []).reduce((acc: any, s: any) => ({
    reach: acc.reach + (s.reach ?? 0),
    impressions: acc.impressions + (s.impressions ?? 0),
    profile_views: acc.profile_views + (s.profile_views ?? 0),
    accounts_engaged: acc.accounts_engaged + (s.accounts_engaged ?? 0),
    total_interactions: acc.total_interactions + (s.total_interactions ?? 0),
  }), { reach: 0, impressions: 0, profile_views: 0, accounts_engaged: 0, total_interactions: 0 });

  // Posts + insights
  const { data: posts } = await supabase.schema('integrations').from('instagram_posts')
    .select('ig_media_id, media_type, media_product_type, caption, timestamp_post, like_count, comments_count')
    .eq('bar_id', barId).gte('timestamp_post', `${di}T00:00:00`).lte('timestamp_post', `${df}T23:59:59`)
    .order('timestamp_post', { ascending: false });

  let topPosts: any[] = [];
  if (posts?.length) {
    const ids = posts.map((p: any) => p.ig_media_id);
    const { data: insights } = await supabase.schema('integrations').from('instagram_post_insights')
      .select('ig_media_id, reach, likes, comments, shares, saved, video_views, total_interactions, data_snapshot')
      .eq('bar_id', barId).in('ig_media_id', ids)
      .order('data_snapshot', { ascending: false });

    const insMap = new Map<string, any>();
    for (const ins of insights ?? []) if (!insMap.has(ins.ig_media_id)) insMap.set(ins.ig_media_id, ins);

    topPosts = posts.slice(0, 30).map((p: any) => {
      const ins = insMap.get(p.ig_media_id) ?? {};
      return {
        tipo: p.media_product_type === 'REELS' ? 'Reel' : p.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : p.media_type === 'VIDEO' ? 'Video' : 'Foto',
        caption_curta: (p.caption || '').slice(0, 200),
        timestamp: p.timestamp_post,
        reach: ins.reach ?? 0,
        likes: ins.likes ?? p.like_count ?? 0,
        comments: ins.comments ?? p.comments_count ?? 0,
        shares: ins.shares ?? 0,
        saves: ins.saved ?? 0,
        video_views: ins.video_views ?? 0,
      };
    }).sort((a: any, b: any) => b.reach - a.reach).slice(0, 10);
  }

  // DMs categorizadas (cliente)
  const { data: msgs } = await supabase.schema('integrations').from('instagram_mensagens')
    .select('categoria, sentimento').eq('bar_id', barId).eq('autor', 'cliente')
    .gte('enviada_em', `${di}T00:00:00`).lte('enviada_em', `${df}T23:59:59`);

  const dmsPorCategoria: Record<string, number> = {};
  const sentimentoCount: Record<string, number> = { positivo: 0, neutro: 0, negativo: 0 };
  for (const m of msgs ?? []) {
    if (m.categoria) dmsPorCategoria[m.categoria] = (dmsPorCategoria[m.categoria] || 0) + 1;
    if (m.sentimento) sentimentoCount[m.sentimento] = (sentimentoCount[m.sentimento] || 0) + 1;
  }

  // Demographics atuais
  const demoSnap = snaps?.[snaps.length - 1];

  return {
    conta,
    periodo: { ini: di, fim: df, dias: snaps?.length ?? 0 },
    followers: {
      inicio: primeiro?.followers_count ?? 0,
      fim: ultimo?.followers_count ?? 0,
      diff: (ultimo?.followers_count ?? 0) - (primeiro?.followers_count ?? 0),
    },
    totais_periodo: totais,
    posts_count: posts?.length ?? 0,
    top_posts: topPosts,
    dms: { total: msgs?.length ?? 0, por_categoria: dmsPorCategoria, sentimento: sentimentoCount },
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const tipo: string = body?.tipo ?? 'semanal';
    const filterBarId: number | undefined = body?.bar_id;

    // Período: últimos 7 dias se não enviar
    const hoje = new Date();
    const di = body?.periodo_ini ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const df = body?.periodo_fim ?? hoje.toISOString().split('T')[0];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = supabase.schema('integrations').from('instagram_contas')
      .select('bar_id, ig_username, ativo').eq('ativo', true);
    if (filterBarId) q = q.eq('bar_id', filterBarId);
    const { data: contas } = await q;
    if (!contas?.length) return new Response(JSON.stringify({ success: true, contas: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const resultados: any[] = [];

    for (const conta of contas) {
      const dados = await coletarMetricas(supabase, conta.bar_id, di, df);

      const prompt = tipo === 'insights_periodo'
        ? `Você é analista de marketing para bares. Receba estes dados de Instagram de @${dados.conta?.ig_username || conta.ig_username} (${di} a ${df}) e gere 6-10 INSIGHTS ACIONÁVEIS — coisa que o sócio do bar deve fazer DIFERENTE com base nos dados. Cada insight curto, direto, com referência ao dado.

Dados:
${JSON.stringify(dados, null, 2)}

Responda APENAS com JSON array no formato:
[
  {"titulo": "...", "explicacao": "...", "acao_sugerida": "...", "prioridade": "alta|media|baixa"},
  ...
]`
        : `Você é analista de marketing de bar. Gere um RESUMO EXECUTIVO da semana (${di} a ${df}) de @${dados.conta?.ig_username || conta.ig_username} em 5 parágrafos:

1. **Crescimento e Alcance** — followers, reach, mudanças
2. **Conteúdo que Performou** — top posts e o porquê
3. **Engajamento e Audiência** — interações, profile views, DMs
4. **Atenção / Riscos** — quedas, reclamações, oportunidades perdidas
5. **Recomendações pra Próxima Semana** — 3 ações concretas

Tom direto, números específicos, sem floreio. Markdown ok.

Dados:
${JSON.stringify(dados, null, 2)}`;

      const claude = await chamarClaude(prompt, tipo === 'insights_periodo' ? 4000 : 3000);

      let insights: any = null;
      let resumo = claude.text;
      if (tipo === 'insights_periodo') {
        const m = claude.text.match(/\[[\s\S]*\]/);
        if (m) {
          try { insights = JSON.parse(m[0]); resumo = null as any; } catch { /* deixa texto */ }
        }
      }

      const { data: relRow } = await supabase.schema('integrations').from('instagram_relatorios_ai').insert({
        bar_id: conta.bar_id,
        tipo,
        periodo_ini: di,
        periodo_fim: df,
        semana_ano: tipo === 'semanal' ? `${hoje.getFullYear()}-W${Math.ceil((hoje.getTime() - new Date(hoje.getFullYear(), 0, 1).getTime()) / 604800000)}` : null,
        resumo,
        insights,
        modelo_usado: MODELO,
        tokens_input: claude.tokensIn,
        tokens_output: claude.tokensOut,
      }).select('id').single();

      resultados.push({
        bar_id: conta.bar_id,
        ig_username: conta.ig_username,
        relatorio_id: relRow?.id,
        tokens: { in: claude.tokensIn, out: claude.tokensOut },
        tipo,
      });
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[ig-ai-relatorio]', e);
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
