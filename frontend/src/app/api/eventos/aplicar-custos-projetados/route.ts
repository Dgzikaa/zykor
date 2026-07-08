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

// POST — projeta o custo artístico e de produção do mês inteiro como % do faturamento.
// Base do dia: realizado (real_r) se houver; senão a Meta M1 (m1_r).
// Custo artístico do dia = base × %artístico + cachê FIXO (R$) do dia da semana.
//   Ex.: dia com DJ de cachê fixo → só o valor fixo; dia com % negociado + DJ fixo → soma dos dois.
// Grava em c_artistico_plan / c_prod_plan (PREVISÃO MANUAL) — que na cascata do
// planejamento fica ACIMA da projeção automática (c_art_projecao, mexida por cron) e
// ABAIXO do real do Conta Azul (c_art). Logo: sobrevive ao cron e o CA real sempre ganha.
// body: { ano, mes, artPorDow: {0..6:%}, prodPorDow: {0..6:%}, artFixoPorDow: {0..6:R$} }
//   (dow: 0=dom..6=sáb; % em pontos, ex.: 15; fixo em reais, ex.: 800)
export async function POST(request: NextRequest) {
  // authenticateUser PRIMEIRO (antes de qualquer await) → publica o ator no auditContext.
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });

  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  // apiCall (cliente) pode mandar o body double-encoded → request.json() vir STRING.
  let body: any = {};
  try { const raw = await request.json(); body = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { body = {}; }
  const ano = parseInt(String(body.ano), 10);
  const mes = parseInt(String(body.mes), 10); // 1..12
  const artPorDow: Record<number, number> = body.artPorDow || {};
  const prodPorDow: Record<number, number> = body.prodPorDow || {};
  const artFixoPorDow: Record<number, number> = body.artFixoPorDow || {};
  if (!ano || !mes || mes < 1 || mes > 12) {
    return NextResponse.json({ success: false, error: 'ano/mes inválidos' }, { status: 400 });
  }

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proxMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

  const ops = (supabase as any).schema('operations');
  const { data: eventos, error } = await ops
    .from('eventos_base')
    .select('id, data_evento, real_r, m1_r')
    .eq('bar_id', barId)
    .gte('data_evento', inicio)
    .lt('data_evento', proxMes);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let updated_art = 0;
  let updated_prod = 0;
  const agora = new Date().toISOString();
  for (const ev of eventos || []) {
    const dow = new Date(`${ev.data_evento}T12:00:00Z`).getUTCDay();
    // base do dia: realizado se já houve faturamento; senão a Meta M1
    const base = (Number(ev.real_r) || 0) > 0 ? Number(ev.real_r) : (Number(ev.m1_r) || 0);

    const patch: Record<string, any> = {};
    const artPct = Number(artPorDow[dow]) || 0;
    const prodPct = Number(prodPorDow[dow]) || 0;
    const artFixo = Number(artFixoPorDow[dow]) || 0;
    // custo artístico = % do faturamento (só quando há base) + cachê fixo (independe da base).
    const artVal = Math.round(((base > 0 ? base * (artPct / 100) : 0) + artFixo) * 100) / 100;
    if (artVal > 0) patch.c_artistico_plan = artVal;
    // produção só como % → exige base de faturamento.
    if (base > 0 && prodPct > 0) patch.c_prod_plan = Math.round(base * (prodPct / 100) * 100) / 100;
    if (Object.keys(patch).length === 0) continue;

    patch.atualizado_em = agora;
    const { error: upErr } = await ops
      .from('eventos_base')
      .update(patch)
      .eq('id', ev.id)
      .eq('bar_id', barId);
    if (upErr) continue;
    if (patch.c_artistico_plan != null) updated_art++;
    if (patch.c_prod_plan != null) updated_prod++;
  }

  return NextResponse.json({ success: true, updated_art, updated_prod, total: (eventos || []).length });
}
