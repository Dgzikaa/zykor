import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

const DOW_LABEL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

// GET — faturamento real (e M1 planejado) médio por dia da semana nas últimas N
// semanas. Base pro histórico de referência da calculadora de distribuição de metas.
// Só dias com venda (real_r > 0) entram na média real.
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const semanas = Math.min(52, Math.max(1, parseInt(new URL(request.url).searchParams.get('semanas') || '8', 10) || 8));
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - semanas * 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data, error } = await (supabase as any)
    .schema('operations')
    .from('eventos_base')
    .select('data_evento, real_r, m1_r')
    .eq('bar_id', barId)
    .gte('data_evento', iso(inicio))
    .lt('data_evento', iso(hoje));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // agrega por dia da semana
  const acc: Record<number, { somaReal: number; nReal: number; somaM1: number; nM1: number }> = {};
  for (let d = 0; d < 7; d++) acc[d] = { somaReal: 0, nReal: 0, somaM1: 0, nM1: 0 };
  for (const r of data || []) {
    const dow = new Date(`${r.data_evento}T12:00:00Z`).getUTCDay();
    const real = Number(r.real_r) || 0;
    const m1 = Number(r.m1_r) || 0;
    if (real > 0) { acc[dow].somaReal += real; acc[dow].nReal += 1; }
    if (m1 > 0) { acc[dow].somaM1 += m1; acc[dow].nM1 += 1; }
  }

  const porDia = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    dow,
    dia: DOW_LABEL[dow],
    dias_com_venda: acc[dow].nReal,
    media_real: acc[dow].nReal ? Math.round(acc[dow].somaReal / acc[dow].nReal) : 0,
    media_m1: acc[dow].nM1 ? Math.round(acc[dow].somaM1 / acc[dow].nM1) : 0,
  }));

  return NextResponse.json({ success: true, semanas, porDia });
}
