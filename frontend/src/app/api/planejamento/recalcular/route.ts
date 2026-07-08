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
 * Recálculo forçado — roda calculate_evento_metrics (recomputa c_art/c_prod do CA ao vivo,
 * faturamento, público etc.) quando o cache do eventos_base divergiu do Conta Azul e o cron
 * diário das 11:45 ainda não passou.
 *
 * POST (bar via header x-selected-bar-id):
 *   - { data: 'YYYY-MM-DD' }  → 1 evento (botão "Recalcular agora" no modal de composição)
 *   - { ano, mes }            → o MÊS inteiro (botão na lateral "Controles" do Planejamento)
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });

  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  let body: any = {};
  try { body = await request.json(); } catch { /* sem corpo — validado abaixo */ }

  const ano = parseInt(String(body.ano || ''), 10);
  const mes = parseInt(String(body.mes || ''), 10);
  const data = String(body.data || '');

  // ---- Mês inteiro ----
  if (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) {
    const ini = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fim = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const { data: evs, error: evsErr } = await (supabase as any).schema('operations')
      .from('eventos_base')
      .select('id')
      .eq('bar_id', barId).eq('ativo', true)
      .gte('data_evento', ini).lt('data_evento', fim)
      .order('data_evento', { ascending: true });
    if (evsErr) return NextResponse.json({ success: false, error: evsErr.message }, { status: 500 });

    let ok = 0; const falhas: number[] = [];
    for (const e of (evs || [])) {
      const { error } = await supabase.rpc('calculate_evento_metrics', { evento_id: e.id });
      if (error) falhas.push(e.id); else ok++;
    }
    return NextResponse.json({ success: true, escopo: 'mes', total: (evs || []).length, recalculados: ok, falhas });
  }

  // ---- 1 evento (por data) ----
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'informe { data } ou { ano, mes }' }, { status: 400 });
  }
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
    success: true, escopo: 'dia',
    evento_id: ev.id,
    c_art_antes, c_prod_antes,
    c_art: Number(depois?.c_art) || 0,
    c_prod: Number(depois?.c_prod) || 0,
  });
}
