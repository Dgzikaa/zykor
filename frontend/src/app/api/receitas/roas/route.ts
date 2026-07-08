import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * ROAS / gasto comercial (Dashboard de Receitas).
 *   gasto_comercial = c_art + c_prod (eventos_base) + marketing (meta.marketing_semanal:
 *                     m_valor_investido + g_valor_investido)
 *   roas            = faturamento / gasto_comercial   (retorno por R$1 de gasto comercial)
 *
 * Nota: marketing_semanal é SEMANAL — bucketizado pelo mês de data_inicio (aproximação;
 * marketing é ~2% do gasto, então o impacto da borda é pequeno).
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

  let evQ = supabase
    .from('eventos_base')
    .select('data_evento, real_r, c_art, c_prod')
    .eq('bar_id', barId)
    .order('data_evento', { ascending: true });
  if (de) evQ = evQ.gte('data_evento', de);
  if (ate) evQ = evQ.lte('data_evento', ate);

  let mkQ = (supabase as any)
    .schema('meta')
    .from('marketing_semanal')
    .select('data_inicio, m_valor_investido, g_valor_investido')
    .eq('bar_id', barId);
  if (de) mkQ = mkQ.gte('data_inicio', de);
  if (ate) mkQ = mkQ.lte('data_inicio', ate);

  const [ev, mk] = await Promise.all([evQ, mkQ]);
  if (ev.error) return NextResponse.json({ success: false, error: ev.error.message }, { status: 500 });
  // marketing é opcional: se falhar (schema/grant), segue com art+prod
  const mkData = mk.error ? [] : (mk.data || []);

  const acc = new Map<string, { label: string; fat: number; art: number; prod: number; mkt: number }>();
  const bucket = (dataStr: string) => {
    const { key, label } = bucketDe(dataStr, gran);
    let a = acc.get(key);
    if (!a) { a = { label, fat: 0, art: 0, prod: 0, mkt: 0 }; acc.set(key, a); }
    return a;
  };

  for (const e of (ev.data || []) as any[]) {
    const a = bucket(String(e.data_evento));
    a.fat += Number(e.real_r) || 0;
    a.art += Number(e.c_art) || 0;
    a.prod += Number(e.c_prod) || 0;
  }
  for (const m of mkData as any[]) {
    bucket(String(m.data_inicio)).mkt += (Number(m.m_valor_investido) || 0) + (Number(m.g_valor_investido) || 0);
  }

  const pontos = [...acc.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([key, a]) => {
      const gasto = a.art + a.prod + a.mkt;
      return {
        key,
        label: a.label,
        faturamento: Math.round(a.fat),
        gasto_comercial: Math.round(gasto),
        marketing: Math.round(a.mkt),
        artistas: Math.round(a.art),
        producao: Math.round(a.prod),
        roas: gasto > 0 ? Math.round((a.fat / gasto) * 100) / 100 : null,
      };
    });

  const totFat = pontos.reduce((s, p) => s + p.faturamento, 0);
  const totGasto = pontos.reduce((s, p) => s + p.gasto_comercial, 0);
  const roasPeriodo = totGasto > 0 ? Math.round((totFat / totGasto) * 100) / 100 : null;

  return NextResponse.json({ success: true, roas_periodo: roasPeriodo, pontos });
}
