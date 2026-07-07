import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// GET — carrega a config da calculadora salva para (bar, ano, mes). null se não existe.
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  const url = new URL(request.url);
  const ano = parseInt(url.searchParams.get('ano') || '', 10);
  const mes = parseInt(url.searchParams.get('mes') || '', 10);
  if (!ano || !mes) return NextResponse.json({ success: false, error: 'ano/mes obrigatórios' }, { status: 400 });

  const { data, error } = await (supabase as any)
    .schema('operations')
    .from('planejamento_distribuicao_config')
    .select('bar_id, ano, mes, target_m1, m2_pct, m3_pct, dias_venda, pesos, atualizado_em')
    .eq('bar_id', barId).eq('ano', ano).eq('mes', mes)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, config: data || null });
}

// POST — salva (upsert) a config da calculadora para (bar, ano, mes).
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  // apiCall (cliente) manda o body double-encoded → request.json() pode vir STRING.
  let body: any = {};
  try { const raw = await request.json(); body = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { body = {}; }
  const ano = parseInt(String(body.ano), 10);
  const mes = parseInt(String(body.mes), 10);
  if (!ano || !mes || mes < 1 || mes > 12) return NextResponse.json({ success: false, error: 'ano/mes inválidos' }, { status: 400 });

  const row = {
    bar_id: barId,
    ano,
    mes,
    target_m1: body.target_m1 != null ? Number(body.target_m1) : null,
    m2_pct: body.m2_pct != null ? Number(body.m2_pct) : null,
    m3_pct: body.m3_pct != null ? Number(body.m3_pct) : null,
    dias_venda: body.dias_venda != null ? Math.round(Number(body.dias_venda)) : null,
    pesos: body.pesos && typeof body.pesos === 'object' ? body.pesos : {},
    atualizado_em: new Date().toISOString(),
    atualizado_por: request.headers.get('x-user-email') || null,
  };

  const { error } = await (supabase as any)
    .schema('operations')
    .from('planejamento_distribuicao_config')
    .upsert(row, { onConflict: 'bar_id,ano,mes' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
