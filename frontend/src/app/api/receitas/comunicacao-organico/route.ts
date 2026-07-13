import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * KPIs orgânicos de Comunicação — Instagram (Graph API, já integrado).
 *
 * Alcance e Interações são somados POR POST (feed + reels), pegando o último snapshot
 * de cada mídia em integrations.instagram_post_insights — a mesma base da tela de Feed
 * e da ferramenta de referência (que também soma post a post). Antes o hub somava os
 * snapshots diários da CONTA (instagram_conta_metricas), o que inflava o número (contava
 * a conta inteira por dia). Perfil/seguidores continuam vindo do snapshot da conta.
 *
 * GET ?bar_id=&inicio=&fim=
 * Retorna { conectado, alcance, engajamento, visitas_perfil, seguidores,
 *           qtd_stories, alcance_stories, serie_mensal, dias }
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('inicio') || sp.get('de');
  const ate = sp.get('fim') || sp.get('ate');

  // Conta (perfil/seguidores) — snapshots diários
  let q = (supabase as any)
    .schema('integrations')
    .from('instagram_conta_metricas')
    .select('data_snapshot, profile_views, followers_count')
    .eq('bar_id', barId)
    .order('data_snapshot', { ascending: true });
  if (de) q = q.gte('data_snapshot', de);
  if (ate) q = q.lte('data_snapshot', ate);

  // Posts do feed (feed + reels) — alcance/interações somados por post
  let pq = (supabase as any)
    .schema('integrations')
    .from('instagram_posts')
    .select('ig_media_id, timestamp_post')
    .eq('bar_id', barId)
    .in('media_product_type', ['FEED', 'REELS']);
  if (de) pq = pq.gte('timestamp_post', de);
  if (ate) pq = pq.lte('timestamp_post', `${ate}T23:59:59`);

  // Stories (integrations.instagram_stories)
  let sq = (supabase as any)
    .schema('integrations')
    .from('instagram_stories')
    .select('timestamp_post, reach')
    .eq('bar_id', barId);
  if (de) sq = sq.gte('timestamp_post', de);
  if (ate) sq = sq.lte('timestamp_post', `${ate}T23:59:59`);

  const [metr, pst, sto] = await Promise.all([q, pq, sq]);
  if (metr.error) return NextResponse.json({ success: false, error: metr.error.message }, { status: 500 });

  const conta = metr.data || [];
  const posts = pst.error ? [] : pst.data || [];

  // Sem dados de conta E sem posts => não conectado
  if (!conta.length && !posts.length) {
    return NextResponse.json({ success: true, conectado: false });
  }

  // Último snapshot de insights por mídia (reach + interações por post)
  const ids = (posts as any[]).map((p) => p.ig_media_id);
  const insMap = new Map<string, any>();
  if (ids.length) {
    const { data: insights } = await (supabase as any)
      .schema('integrations')
      .from('instagram_post_insights')
      .select('ig_media_id, reach, likes, comments, shares, saved, data_snapshot')
      .eq('bar_id', barId)
      .in('ig_media_id', ids)
      .order('data_snapshot', { ascending: false });
    for (const i of insights ?? []) if (!insMap.has(i.ig_media_id)) insMap.set(i.ig_media_id, i);
  }

  const postMetric = (p: any) => {
    const i = insMap.get(p.ig_media_id) ?? {};
    const reach = Number(i.reach) || 0;
    const engajamento = (Number(i.likes) || 0) + (Number(i.comments) || 0) + (Number(i.shares) || 0) + (Number(i.saved) || 0);
    return { reach, engajamento };
  };

  let alcance = 0;
  let engajamento = 0;
  const mensalMap = new Map<string, { label: string; alcance: number; engajamento: number }>();
  for (const p of posts as any[]) {
    const { reach, engajamento: eng } = postMetric(p);
    alcance += reach;
    engajamento += eng;
    const { key, label } = bucketDe(String(p.timestamp_post), 'mes');
    let m = mensalMap.get(key);
    if (!m) { m = { label, alcance: 0, engajamento: 0 }; mensalMap.set(key, m); }
    m.alcance += reach;
    m.engajamento += eng;
  }
  const serie_mensal = [...mensalMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, m]) => m);

  const ultimo = (conta as any[])[conta.length - 1];
  const somaConta = (k: string) => (conta as any[]).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const stories = sto.error ? [] : sto.data || [];
  const alcanceStories = (stories as any[]).reduce((s, r) => s + (Number(r.reach) || 0), 0);

  return NextResponse.json({
    success: true,
    conectado: true,
    alcance,
    engajamento,
    visitas_perfil: somaConta('profile_views'),
    seguidores: ultimo?.followers_count ?? null,
    qtd_stories: (stories as any[]).length,
    alcance_stories: alcanceStories,
    serie_mensal,
    dias: conta.length,
  });
}
