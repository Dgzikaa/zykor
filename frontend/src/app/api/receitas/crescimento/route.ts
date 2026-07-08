import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * Taxa de Crescimento (Dashboard de Receitas) — FATURAMENTO POR DIA ABERTO.
 *
 * Fonte: dado diário de eventos (operations.eventos_base via view public.eventos_base),
 * a mesma de /api/graficos/por-dia-semana. Para cada bucket (dia/semana/mês):
 *   faturamento    = SUM(real_r)
 *   dias_abertos   = COUNT(real_r > 0)   ← já exclui dias fechados (ex.: 2ª do Deboche)
 *   fat_por_dia    = faturamento / dias_abertos
 *   variacao_pct   = variação do fat_por_dia vs bucket anterior
 *
 * GET ?bar_id=&granularidade=dia|semana|mes&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 *     (bar também via header x-selected-bar-id; aceita de/ate como sinônimo de inicio/fim)
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

  let q = supabase
    .from('eventos_base')
    .select('data_evento, real_r')
    .eq('bar_id', barId)
    .order('data_evento', { ascending: true });
  if (de) q = q.gte('data_evento', de);
  if (ate) q = q.lte('data_evento', ate);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const acc = new Map<string, { label: string; fat: number; dias: number }>();
  for (const e of (data || []) as any[]) {
    const fat = Number(e.real_r) || 0;
    const { key, label } = bucketDe(String(e.data_evento), gran);
    const a = acc.get(key) || { label, fat: 0, dias: 0 };
    a.fat += fat;
    if (fat > 0) a.dias += 1;
    acc.set(key, a);
  }

  const pontos = [...acc.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([key, a]) => ({
      key,
      label: a.label,
      faturamento: Math.round(a.fat),
      dias_abertos: a.dias,
      fat_por_dia: a.dias ? Math.round(a.fat / a.dias) : 0,
      variacao_pct: null as number | null,
    }));

  for (let i = 1; i < pontos.length; i++) {
    const prev = pontos[i - 1].fat_por_dia;
    if (prev > 0) pontos[i].variacao_pct = Math.round(((pontos[i].fat_por_dia - prev) / prev) * 1000) / 10;
  }

  return NextResponse.json({ success: true, granularidade: gran, pontos });
}
