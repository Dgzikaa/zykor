import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Análises de insumo:
 *  - ?tipo=abc&ini&fim  → curva ABC (Pareto do custo teórico de insumos no período)
 *  - ?tipo=impacto      → impacto de variação de preço (insumo variou → produtos afetados + Δ CMV)
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const tipo = sp.get('tipo') || 'abc';
  const gold = (await getAdminClient() as any).schema('gold');

  if (tipo === 'impacto') {
    const { data, error } = await gold.rpc('fn_impacto_variacao', { p_bar_id: barId });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    // agrupa por insumo: var% + produtos afetados
    const map = new Map<string, any>();
    for (const r of (data || []) as any[]) {
      const k = r.insumo_codigo;
      const g = map.get(k) || { insumo_codigo: k, insumo_nome: r.insumo_nome, var_pct: r.var_pct, produtos: [] };
      if (r.produto_cod) g.produtos.push({ produto_cod: r.produto_cod, produto_nome: r.produto_nome, delta_custo: r.delta_custo, cmv_atual: r.cmv_atual, delta_cmv_pp: r.delta_cmv_pp });
      map.set(k, g);
    }
    const insumos = Array.from(map.values()).map(g => ({ ...g, n_produtos: g.produtos.length }))
      .sort((a, b) => Math.abs(b.var_pct ?? 0) - Math.abs(a.var_pct ?? 0));
    return NextResponse.json({ success: true, tipo, insumos });
  }

  // ABC
  const fim = sp.get('fim') || new Date().toISOString().slice(0, 10);
  const ini = sp.get('ini') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await gold.rpc('fn_curva_abc_insumos', { p_bar_id: barId, p_ini: ini, p_fim: fim });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const linhas = (data || []) as any[];
  const resumo: Record<string, any> = {};
  for (const cl of ['A', 'B', 'C']) {
    const arr = linhas.filter(l => l.classe === cl);
    resumo[cl] = { n: arr.length, custo: arr.reduce((s, l) => s + Number(l.custo_total || 0), 0) };
  }
  return NextResponse.json({ success: true, tipo: 'abc', periodo: { ini, fim }, resumo, insumos: linhas });
}
