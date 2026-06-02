import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ferramentas/mix-categoria?dias=30
 * Surfacing de 2 gold views:
 *  - mix: gold.mix_produtos_diario agregado por categoria (BEBIDA/DRINK/COMIDA) no período.
 *  - cmv: gold.cma_alimentacao_mensal (CMV total vs custo de comida, % sobre faturamento) — 6 meses.
 * bar_id sempre do usuário autenticado.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) {
    return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const dias = Math.min(Math.max(Number(searchParams.get('dias')) || 30, 7), 180);
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - dias);
  const desdeIso = desde.toISOString().slice(0, 10);
  // 6 meses de CMV: primeiro dia do mês 5 meses atrás.
  const desdeMes = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1).toISOString().slice(0, 10);
  const ateMesIso = hoje.toISOString().slice(0, 10);

  const supabase = createServiceRoleClient();

  const [mixRes, cmvRes] = await Promise.all([
    supabase
      .schema('gold' as never)
      .from('mix_produtos_diario')
      .select('categoria_mix, quantidade, faturamento, custo, skus')
      .eq('bar_id', user.bar_id)
      .gte('dt_gerencial', desdeIso),
    supabase
      .schema('gold' as never)
      .from('cma_alimentacao_mensal')
      .select('mes, cmv_total, cma_alimentacao, faturamento_liquido, cmv_pct, cma_pct')
      .eq('bar_id', user.bar_id)
      .gte('mes', desdeMes)
      .lte('mes', ateMesIso)
      .gt('faturamento_liquido', 0)
      .order('mes', { ascending: true }),
  ]);

  if (mixRes.error) {
    return NextResponse.json({ success: false, error: mixRes.error.message }, { status: 500 });
  }

  // Agrega o mix por categoria no período (poucas linhas: 3 categorias x N dias).
  const mapa = new Map<string, { faturamento: number; quantidade: number; custo: number; skus: number }>();
  for (const r of (mixRes.data || []) as Array<{
    categoria_mix: string; quantidade: number | null; faturamento: number | null; custo: number | null; skus: number | null;
  }>) {
    const cat = r.categoria_mix || 'SEM_CATEGORIA';
    const cur = mapa.get(cat) || { faturamento: 0, quantidade: 0, custo: 0, skus: 0 };
    cur.faturamento += Number(r.faturamento || 0);
    cur.quantidade += Number(r.quantidade || 0);
    cur.custo += Number(r.custo || 0);
    cur.skus = Math.max(cur.skus, Number(r.skus || 0));
    mapa.set(cat, cur);
  }
  const mix = Array.from(mapa.entries())
    .map(([categoria, v]) => ({
      categoria,
      faturamento: Math.round(v.faturamento * 100) / 100,
      quantidade: Math.round(v.quantidade * 100) / 100,
      custo: Math.round(v.custo * 100) / 100,
      skus: v.skus,
      margem_pct: v.faturamento > 0 ? Math.round(((v.faturamento - v.custo) / v.faturamento) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.faturamento - a.faturamento);

  return NextResponse.json({ success: true, dias, mix, cmv: cmvRes.data || [] });
}
