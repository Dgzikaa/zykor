import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { bucketDe } from '@/lib/receitas/periodo';

/**
 * Taxa de Lotação (Dashboard de Receitas) — capacidade máxima vs atendidos.
 *
 *   capacidade  = dias_abertos × operations.bares.capacidade_dia (os "650" do Ordinário)
 *   atendidos   = SUM(cl_real) do eventos_base
 *   ocupacao_%  = atendidos / capacidade × 100
 *
 * Se o bar não tem capacidade_dia configurada, retorna capacidade_dia=null (o card
 * mostra aviso pra configurar em vez de números furados).
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

  const barRes = await (supabase as any)
    .schema('operations')
    .from('bares')
    .select('config')
    .eq('id', barId)
    .maybeSingle();
  const capRaw = barRes.data?.config?.capacidade_dia;
  const capacidadeDia = capRaw != null && capRaw !== '' ? Number(capRaw) : null;

  let q = supabase
    .from('eventos_base')
    .select('data_evento, real_r, cl_real')
    .eq('bar_id', barId)
    .order('data_evento', { ascending: true });
  if (de) q = q.gte('data_evento', de);
  if (ate) q = q.lte('data_evento', ate);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const acc = new Map<string, { label: string; atendidos: number; dias: number }>();
  for (const e of (data || []) as any[]) {
    const { key, label } = bucketDe(String(e.data_evento), gran);
    let a = acc.get(key);
    if (!a) { a = { label, atendidos: 0, dias: 0 }; acc.set(key, a); }
    a.atendidos += Number(e.cl_real) || 0;
    if ((Number(e.real_r) || 0) > 0) a.dias += 1;
  }

  const pontos = [...acc.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([key, a]) => {
      const capacidade = capacidadeDia ? a.dias * capacidadeDia : 0;
      return {
        key,
        label: a.label,
        capacidade,
        atendidos: Math.round(a.atendidos),
        ocupacao_pct: capacidade > 0 ? Math.round((a.atendidos / capacidade) * 1000) / 10 : null,
      };
    });

  return NextResponse.json({ success: true, capacidade_dia: capacidadeDia, pontos });
}
