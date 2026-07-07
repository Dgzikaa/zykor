import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// POST — aplica a distribuição de metas da calculadora: grava m1_r em cada dia do
// mês conforme o M1 do seu dia da semana. Só toca m1_r (não mexe em outros campos).
// body: { ano, mes, m1PorDow: { "0".."6": number } }  (dow: 0=dom .. 6=sab)
export async function POST(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  // apiCall (cliente) manda o body double-encoded → request.json() pode vir STRING.
  let body: any = {};
  try { const raw = await request.json(); body = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { body = {}; }
  const ano = parseInt(String(body.ano), 10);
  const mes = parseInt(String(body.mes), 10); // 1..12
  const m1PorDow: Record<number, number> = body.m1PorDow || {};
  if (!ano || !mes || mes < 1 || mes > 12) {
    return NextResponse.json({ success: false, error: 'ano/mes inválidos' }, { status: 400 });
  }

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proxMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

  const ops = (supabase as any).schema('operations');
  const { data: eventos, error } = await ops
    .from('eventos_base')
    .select('id, data_evento')
    .eq('bar_id', barId)
    .gte('data_evento', inicio)
    .lt('data_evento', proxMes);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let updated = 0;
  let skipped = 0;
  const agora = new Date().toISOString();
  for (const ev of eventos || []) {
    const dow = new Date(`${ev.data_evento}T12:00:00Z`).getUTCDay();
    const m1 = Number(m1PorDow[dow]);
    if (!m1 || m1 <= 0) { skipped++; continue; }
    const { error: upErr } = await ops
      .from('eventos_base')
      .update({ m1_r: Math.round(m1 * 100) / 100, atualizado_em: agora })
      .eq('id', ev.id)
      .eq('bar_id', barId);
    if (upErr) { skipped++; continue; }
    updated++;
  }

  return NextResponse.json({ success: true, updated, skipped, total: (eventos || []).length });
}
