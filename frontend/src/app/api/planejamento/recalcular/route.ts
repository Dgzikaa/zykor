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

/**
 * Recálculo pontual de UM evento (bar + dia) — força calculate_evento_metrics.
 * Usado pelo botão "Recalcular agora" no modal de composição de custo do Planejamento,
 * quando o valor cacheado (eventos_base.c_art/c_prod) diverge do CA ao vivo (correção
 * feita no Conta Azul que ainda não passou pelo cron diário das 11:45).
 *
 * POST { data: 'YYYY-MM-DD' }  (bar via header x-selected-bar-id)
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });

  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  let body: any = {};
  try { body = await request.json(); } catch { /* sem corpo — cai na validação de data abaixo */ }
  const data = String(body.data || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'data inválida (YYYY-MM-DD)' }, { status: 400 });
  }

  // Evento do bar naquele dia (escopado — nunca recalcula de outro bar).
  const { data: ev, error: evErr } = await (supabase as any).schema('operations')
    .from('eventos_base')
    .select('id, c_art, c_prod')
    .eq('bar_id', barId).eq('data_evento', data).maybeSingle();
  if (evErr) return NextResponse.json({ success: false, error: evErr.message }, { status: 500 });
  if (!ev) return NextResponse.json({ success: false, error: 'Nenhum evento cadastrado nesse dia' }, { status: 404 });

  const c_art_antes = Number(ev.c_art) || 0;
  const c_prod_antes = Number(ev.c_prod) || 0;

  const { error: calcErr } = await supabase.rpc('calculate_evento_metrics', { evento_id: ev.id });
  if (calcErr) return NextResponse.json({ success: false, error: calcErr.message }, { status: 500 });

  const { data: depois } = await (supabase as any).schema('operations')
    .from('eventos_base').select('c_art, c_prod').eq('id', ev.id).maybeSingle();

  return NextResponse.json({
    success: true,
    evento_id: ev.id,
    c_art_antes, c_prod_antes,
    c_art: Number(depois?.c_art) || 0,
    c_prod: Number(depois?.c_prod) || 0,
  });
}
