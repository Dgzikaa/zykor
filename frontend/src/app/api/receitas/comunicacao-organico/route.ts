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

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (!data || !data.length) {
    return NextResponse.json({ success: true, conectado: false });
  }

  const soma = (k: string) => (data as any[]).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const ultimo = (data as any[])[data.length - 1];

  return NextResponse.json({
    success: true,
    conectado: true,
    alcance: soma('reach'),
    engajamento: soma('total_interactions'),
    contas_engajadas: soma('accounts_engaged'),
    visitas_perfil: soma('profile_views'),
    seguidores: ultimo?.followers_count ?? null,
    dias: data.length,
  });
}
