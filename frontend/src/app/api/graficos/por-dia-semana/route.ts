import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// Ordem de exibição: segunda → domingo (getUTCDay: 1..6,0).
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const LABEL: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

/**
 * Análise POR DIA DA SEMANA (hub de Gráficos). Média de faturamento, público e ticket
 * por dia da semana, a partir do dado DIÁRIO de eventos (operations.eventos_base via view
 * public.eventos_base). Mesma régua de "evento válido" das outras análises: real_r > 1000.
 *
 * GET ?bar_id=&de=YYYY-MM-DD&ate=YYYY-MM-DD  (bar também via header x-selected-bar-id)
 */
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('de');
  const ate = sp.get('ate');

  let q = supabase
    .from('eventos_base')
    .select('data_evento, real_r, cl_real, publico_real, t_medio')
    .eq('bar_id', barId)
    .gt('real_r', 1000);
  if (de) q = q.gte('data_evento', de);
  if (ate) q = q.lte('data_evento', ate);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Agrega por dia da semana (getUTCDay sobre a data do evento, meio-dia UTC p/ evitar borda).
  const acc = new Map<number, { n: number; fat: number; publico: number; ticketSoma: number; ticketN: number }>();
  for (const e of (data || []) as any[]) {
    const dow = new Date(String(e.data_evento).slice(0, 10) + 'T12:00:00Z').getUTCDay();
    const a = acc.get(dow) || { n: 0, fat: 0, publico: 0, ticketSoma: 0, ticketN: 0 };
    a.n += 1;
    a.fat += Number(e.real_r) || 0;
    a.publico += Math.max(Number(e.cl_real) || 0, Number(e.publico_real) || 0);
    const tm = Number(e.t_medio) || 0;
    if (tm > 0) { a.ticketSoma += tm; a.ticketN += 1; }
    acc.set(dow, a);
  }

  const dias = ORDEM.map((dow) => {
    const a = acc.get(dow);
    const n = a?.n || 0;
    return {
      dow,
      dia: LABEL[dow],
      eventos: n,
      fat_medio: n ? Math.round((a!.fat) / n) : 0,
      publico_medio: n ? Math.round((a!.publico) / n) : 0,
      ticket_medio: a && a.ticketN ? Math.round((a.ticketSoma / a.ticketN) * 100) / 100 : 0,
      fat_total: Math.round(a?.fat || 0),
    };
  });

  return NextResponse.json({ success: true, dias });
}
