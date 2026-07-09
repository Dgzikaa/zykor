import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

/**
 * KPIs orgânicos de Comunicação — Instagram (Graph API, já integrado).
 * Soma os snapshots diários de integrations.instagram_conta_metricas no período
 * (mesma lógica da tela /marketing/instagram). Alcance e engajamento são somas
 * dos valores diários (proxy de período, como o Reportei faz).
 *
 * GET ?bar_id=&inicio=&fim=
 * Retorna { conectado, alcance, engajamento, contas_engajadas, visitas_perfil, seguidores, dias }
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

  let q = (supabase as any)
    .schema('integrations')
    .from('instagram_conta_metricas')
    .select('data_snapshot, reach, total_interactions, accounts_engaged, profile_views, followers_count')
    .eq('bar_id', barId)
    .order('data_snapshot', { ascending: true });
  if (de) q = q.gte('data_snapshot', de);
  if (ate) q = q.lte('data_snapshot', ate);

  // Stories (integrations.instagram_stories) — timestamp_post é timestamp; usa o dia inteiro do fim.
  let sq = (supabase as any)
    .schema('integrations')
    .from('instagram_stories')
    .select('timestamp_post, reach')
    .eq('bar_id', barId);
  if (de) sq = sq.gte('timestamp_post', de);
  if (ate) sq = sq.lte('timestamp_post', `${ate}T23:59:59`);

  const [metr, sto] = await Promise.all([q, sq]);
  if (metr.error) return NextResponse.json({ success: false, error: metr.error.message }, { status: 500 });

  const data = metr.data || [];
  if (!data.length) {
    return NextResponse.json({ success: true, conectado: false });
  }

  const soma = (k: string) => (data as any[]).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const ultimo = (data as any[])[data.length - 1];
  const stories = sto.error ? [] : sto.data || [];
  const alcanceStories = (stories as any[]).reduce((s, r) => s + (Number(r.reach) || 0), 0);

  return NextResponse.json({
    success: true,
    conectado: true,
    alcance: soma('reach'),
    engajamento: soma('total_interactions'),
    contas_engajadas: soma('accounts_engaged'),
    visitas_perfil: soma('profile_views'),
    seguidores: ultimo?.followers_count ?? null,
    qtd_stories: (stories as any[]).length,
    alcance_stories: alcanceStories,
    dias: data.length,
  });
}
