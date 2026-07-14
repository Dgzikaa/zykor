import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * Despesas Comerciais + ROI (Dashboard de Receitas).
 *   Buckets por período (segue a granularidade): mídia (Meta+Google), artista (c_art),
 *   produção (c_prod), benefício (consumo_beneficios).
 *   despesas = mídia + artista + produção + benefício
 *   ROI      = (faturamento × 0,6) / despesas   ← margem de contribuição assumida
 *
 * Nota de granularidade: mídia (meta.marketing_semanal) e benefício (financial.cmv_semanal)
 * são SEMANAIS, bucketizados pelo período de data_inicio (aproximação em dia/mês). Artista e
 * produção vêm por evento de eventos_base (exatos).
 *
 * GET ?bar_id=&granularidade=dia|semana|mes&inicio=&fim=
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const MARGEM = 0.6; // margem de contribuição assumida no ROI

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

  // Artista/produção/faturamento — por evento (exatos)
  let evQ = supabase
    .from('eventos_base')
    .select('data_evento, real_r, c_art, c_prod')
    .eq('bar_id', barId)
    .order('data_evento', { ascending: true });
  if (de) evQ = evQ.gte('data_evento', de);
  if (ate) evQ = evQ.lte('data_evento', ate);

  // Mídia — Meta + Google (semanal)
  let mkQ = (supabase as any)
    .schema('meta')
    .from('marketing_semanal')
    .select('data_inicio, m_valor_investido, g_valor_investido')
    .eq('bar_id', barId);
  if (de) mkQ = mkQ.gte('data_inicio', de);
  if (ate) mkQ = mkQ.lte('data_inicio', ate);

  // Benefício — consumação de benefícios (semanal)
  let bnQ = (supabase as any)
    .schema('financial')
    .from('cmv_semanal')
    .select('data_inicio, consumo_beneficios')
    .eq('bar_id', barId);
  if (de) bnQ = bnQ.gte('data_inicio', de);
  if (ate) bnQ = bnQ.lte('data_inicio', ate);

  const [ev, mk, bn] = await Promise.all([evQ, mkQ, bnQ]);
  if (ev.error) return NextResponse.json({ success: false, error: ev.error.message }, { status: 500 });
  // mídia/benefício são opcionais: se falharem (schema/grant), segue com o que tem
  const mkData = mk.error ? [] : (mk.data || []);
  const bnData = bn.error ? [] : (bn.data || []);

  const acc = new Map<string, { label: string; fat: number; midia: number; artista: number; producao: number; beneficio: number }>();
  const bucket = (dataStr: string) => {
    const { key, label } = bucketDe(dataStr, gran);
    let a = acc.get(key);
    if (!a) { a = { label, fat: 0, midia: 0, artista: 0, producao: 0, beneficio: 0 }; acc.set(key, a); }
    return a;
  };

  for (const e of (ev.data || []) as any[]) {
    const a = bucket(String(e.data_evento));
    a.fat += Number(e.real_r) || 0;
    a.artista += Number(e.c_art) || 0;
    a.producao += Number(e.c_prod) || 0;
  }
  for (const m of mkData as any[]) {
    bucket(String(m.data_inicio)).midia += (Number(m.m_valor_investido) || 0) + (Number(m.g_valor_investido) || 0);
  }
  for (const b of bnData as any[]) {
    bucket(String(b.data_inicio)).beneficio += Number(b.consumo_beneficios) || 0;
  }

  const pontos = [...acc.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([key, a]) => {
      const despesas = a.midia + a.artista + a.producao + a.beneficio;
      return {
        key,
        label: a.label,
        faturamento: Math.round(a.fat),
        midia: Math.round(a.midia),
        artista: Math.round(a.artista),
        producao: Math.round(a.producao),
        beneficio: Math.round(a.beneficio),
        despesas: Math.round(despesas),
        roi: despesas > 0 ? Math.round(((a.fat * MARGEM) / despesas) * 100) / 100 : null,
      };
    });

  const totFat = pontos.reduce((s, p) => s + p.faturamento, 0);
  const totDesp = pontos.reduce((s, p) => s + p.despesas, 0);
  const roiPeriodo = totDesp > 0 ? Math.round(((totFat * MARGEM) / totDesp) * 100) / 100 : null;

  return NextResponse.json({
    success: true,
    faturamento_periodo: totFat,
    despesas_periodo: totDesp,
    roi_periodo: roiPeriodo,
    pontos,
  });
}
