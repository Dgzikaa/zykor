import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * Inputs de Crescimento (Dashboard de Receitas) — reservas, clientes/dia e ticket médio.
 *
 * Fontes (validadas contra docs/dash/dashCrescimento2):
 *   - eventos_base (real_r, cl_real): clientes_por_dia = SUM(cl_real)/dias_abertos;
 *     ticket_medio = SUM(real_r)/SUM(cl_real).
 *   - silver.getin_reservas_diarias (total_pessoas): reservas = SUM(total_pessoas)
 *     (o "Reservas" do modelo é nº de PESSOAS das reservas), reservas_por_dia = /dias_abertos.
 *
 * GET ?bar_id=&granularidade=dia|semana|mes&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
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
    .select('data_evento, real_r, cl_real')
    .eq('bar_id', barId)
    .order('data_evento', { ascending: true });
  if (de) evQ = evQ.gte('data_evento', de);
  if (ate) evQ = evQ.lte('data_evento', ate);

  let resQ = supabase
    .schema('silver')
    .from('getin_reservas_diarias')
    .select('data_referencia, total_pessoas')
    .eq('bar_id', barId);
  if (de) resQ = resQ.gte('data_referencia', de);
  if (ate) resQ = resQ.lte('data_referencia', ate);

  const [ev, res] = await Promise.all([evQ, resQ]);
  if (ev.error) return NextResponse.json({ success: false, error: ev.error.message }, { status: 500 });
  if (res.error) return NextResponse.json({ success: false, error: res.error.message }, { status: 500 });

  const acc = new Map<string, { label: string; fat: number; clientes: number; dias: number; reservas: number }>();
  const bucket = (dataStr: string) => {
    const { key, label } = bucketDe(dataStr, gran);
    let a = acc.get(key);
    if (!a) { a = { label, fat: 0, clientes: 0, dias: 0, reservas: 0 }; acc.set(key, a); }
    return a;
  };

  for (const e of (ev.data || []) as any[]) {
    const a = bucket(String(e.data_evento));
    const fat = Number(e.real_r) || 0;
    a.fat += fat;
    a.clientes += Number(e.cl_real) || 0;
    if (fat > 0) a.dias += 1;
  }
  for (const r of (res.data || []) as any[]) {
    bucket(String(r.data_referencia)).reservas += Number(r.total_pessoas) || 0;
  }

  const pontos = [...acc.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([key, a]) => ({
      key,
      label: a.label,
      dias_abertos: a.dias,
      reservas: Math.round(a.reservas),
      reservas_por_dia: a.dias ? Math.round(a.reservas / a.dias) : 0,
      clientes_por_dia: a.dias ? Math.round(a.clientes / a.dias) : 0,
      ticket_medio: a.clientes ? Math.round((a.fat / a.clientes) * 100) / 100 : 0,
    }));

  return NextResponse.json({ success: true, granularidade: gran, pontos });
}
