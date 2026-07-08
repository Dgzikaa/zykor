import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * Satisfação / NPS (Dashboard de Receitas) — a partir de silver.nps_diario (Falae).
 * NPS agregado por bucket = 100 × (promotores − detratores) / respostas (forma correta,
 * não média de scores diários). `nps_periodo` = NPS de todas as respostas do período.
 *
 * GET ?bar_id=&granularidade=dia|semana|mes&inicio=&fim=
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
  const gran = (sp.get('granularidade') || 'mes').toLowerCase();
  const de = sp.get('inicio') || sp.get('de');
  const ate = sp.get('fim') || sp.get('ate');

  let q = (supabase as any)
    .schema('silver')
    .from('nps_diario')
    .select('data_referencia, total_respostas, promotores, detratores')
    .eq('bar_id', barId)
    .order('data_referencia', { ascending: true });
  if (de) q = q.gte('data_referencia', de);
  if (ate) q = q.lte('data_referencia', ate);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const acc = new Map<string, { label: string; promo: number; detra: number; total: number }>();
  let gPromo = 0, gDetra = 0, gTotal = 0;
  for (const r of (data || []) as any[]) {
    const { key, label } = bucketDe(String(r.data_referencia), gran);
    let a = acc.get(key);
    if (!a) { a = { label, promo: 0, detra: 0, total: 0 }; acc.set(key, a); }
    const p = Number(r.promotores) || 0, d = Number(r.detratores) || 0, t = Number(r.total_respostas) || 0;
    a.promo += p; a.detra += d; a.total += t;
    gPromo += p; gDetra += d; gTotal += t;
  }

  const pontos = [...acc.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([key, a]) => ({
      key,
      label: a.label,
      respostas: a.total,
      nps: a.total ? Math.round((100 * (a.promo - a.detra)) / a.total) : null,
    }));

  const npsPeriodo = gTotal ? Math.round((100 * (gPromo - gDetra)) / gTotal) : null;

  return NextResponse.json({ success: true, nps_periodo: npsPeriodo, respostas_periodo: gTotal, pontos });
}
