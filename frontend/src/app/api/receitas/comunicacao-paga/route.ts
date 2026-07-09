import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

/**
 * KPIs de mídia PAGA (Meta Ads) — a partir de meta.marketing_semanal (hoje preenchido
 * manualmente via Reportei; a automação via API Meta/ads_read é pendente).
 * Agrega as semanas que sobrepõem o período. CPM/CTR recalculados dos totais.
 *
 * GET ?bar_id=&inicio=&fim=
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const meta = () => (supabase as any).schema('meta');

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

  let q = meta()
    .from('marketing_semanal')
    .select('data_inicio, data_fim, m_valor_investido, m_alcance, m_impressoes, m_cpm, m_cliques, m_conversas_iniciadas, g_valor_investido')
    .eq('bar_id', barId);
  if (ate) q = q.lte('data_inicio', ate); // semana começa antes do fim
  if (de) q = q.gte('data_fim', de); // e termina depois do início → sobreposição

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (!data || !data.length) return NextResponse.json({ success: true, tem_dados: false });

  const soma = (k: string) => (data as any[]).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const investMeta = soma('m_valor_investido');
  const investGoogle = soma('g_valor_investido');
  const alcance = soma('m_alcance');
  const cliques = soma('m_cliques');
  const conversas = soma('m_conversas_iniciadas');

  // Impressões às vezes não vêm preenchidas no Reportei, mas o CPM por semana sim.
  // Nesse caso reconstrói impressões da semana via investimento/CPM (impr = inv/cpm×1000).
  let impressoes = soma('m_impressoes');
  if (impressoes <= 0) {
    impressoes = Math.round(
      (data as any[]).reduce((s, r) => {
        const cpm = Number(r.m_cpm) || 0;
        const inv = Number(r.m_valor_investido) || 0;
        return s + (cpm > 0 ? (inv / cpm) * 1000 : 0);
      }, 0),
    );
  }

  return NextResponse.json({
    success: true,
    tem_dados: true,
    investimento_meta: Math.round(investMeta),
    investimento_google: Math.round(investGoogle),
    alcance,
    impressoes,
    cliques,
    conversas,
    cpm: impressoes > 0 ? Math.round((investMeta / impressoes) * 1000 * 100) / 100 : null,
    ctr: impressoes > 0 ? Math.round((cliques / impressoes) * 100 * 100) / 100 : null,
    semanas: data.length,
  });
}
