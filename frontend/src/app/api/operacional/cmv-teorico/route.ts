import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * CMV Teórico do cardápio (gold.produto_cmv): custo da ficha (último preço) × preço de venda (CH).
 * GET ?bar_id → lista + Δ vs o snapshot anterior (gold.produto_cmv_historico).
 * POST { action:'recalcular' } → roda gold.fn_cmv_teorico + grava snapshot do dia.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const gold = (await getAdminClient() as any).schema('gold');

  const { data, error } = await gold.from('produto_cmv').select('*').eq('bar_id', barId).order('cmv_pct', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // snapshot anterior (data_ref mais recente antes de hoje) p/ comparativo
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: datasHist } = await gold.from('produto_cmv_historico').select('data_ref').eq('bar_id', barId).lt('data_ref', hoje).order('data_ref', { ascending: false }).limit(1);
  const dataAnterior = datasHist?.[0]?.data_ref || null;
  const prevMap = new Map<number, any>();
  if (dataAnterior) {
    const { data: prev } = await gold.from('produto_cmv_historico').select('produto_id, custo, preco_venda, cmv_pct').eq('bar_id', barId).eq('data_ref', dataAnterior);
    (prev || []).forEach((p: any) => prevMap.set(p.produto_id, p));
  }

  const produtos = (data || []).map((p: any) => {
    const prev = prevMap.get(p.produto_id);
    return {
      ...p,
      cmv_pct_anterior: prev?.cmv_pct ?? null,
      delta_cmv: (prev?.cmv_pct != null && p.cmv_pct != null) ? Number((p.cmv_pct - prev.cmv_pct).toFixed(2)) : null,
    };
  });
  return NextResponse.json({ success: true, produtos, data_anterior: dataAnterior });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  if (body.action !== 'recalcular') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
  const admin = await getAdminClient();
  const gold = (admin as any).schema('gold');

  const { error } = await gold.rpc('fn_cmv_teorico', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // snapshot do dia (atualiza se já existir)
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: atual } = await gold.from('produto_cmv').select('produto_id, codigo, nome, custo, preco_venda, cmv_pct').eq('bar_id', barId);
  if (atual?.length) {
    await gold.from('produto_cmv_historico').upsert(
      atual.map((p: any) => ({ bar_id: barId, produto_id: p.produto_id, data_ref: hoje, codigo: p.codigo, nome: p.nome, custo: p.custo, preco_venda: p.preco_venda, cmv_pct: p.cmv_pct })),
      { onConflict: 'bar_id,produto_id,data_ref' },
    );
  }
  return NextResponse.json({ success: true });
}
