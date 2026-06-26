import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operacional/insumos/precos  — ancorado no CÓDIGO PLANILHA
 *  - ?bar_id           -> lista de insumos com último preço, anterior e variação (compra 0 = planilha)
 *  - ?bar_id&codigo=X  -> série histórica do insumo (compra 0 da planilha + compras reais do VMarket)
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const gold = (supabase as any).schema('gold');

  // série de um insumo (por código planilha): compra 0 (planilha) primeiro, depois compras reais
  const codigo = sp.get('codigo');
  if (codigo) {
    const { data, error } = await gold.from('insumo_preco_serie')
      .select('ordem, data, preco, fornecedor, fonte')
      .eq('bar_id', barId).eq('codigo_planilha', codigo)
      .order('ordem', { ascending: true }).order('data', { ascending: true, nullsFirst: true });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, serie: data ?? [] });
  }

  // lista com variação (último × anterior por código planilha)
  const { data, error } = await gold.from('insumo_preco_variacao')
    .select('codigo_planilha, nome, secao, preco_atual, data_atual, fonte_atual, preco_anterior, var_pct')
    .eq('bar_id', barId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // Materiais (limpeza/descartáveis/outros: tabaco, impostos, frete) não são insumos — fora da variação
  const ehMaterial = (s: string | null) => /limpeza|descart|outros/i.test(s || '');
  const rows = (data || [])
    .filter((p: any) => p.preco_atual != null && !ehMaterial(p.secao))
    .map((p: any) => ({
      codigo_planilha: p.codigo_planilha, nome: p.nome || p.codigo_planilha, secao: p.secao || null,
      preco_atual: Number(p.preco_atual), data_atual: p.data_atual, fonte_atual: p.fonte_atual,
      preco_anterior: p.preco_anterior != null ? Number(p.preco_anterior) : null,
      var_pct: p.var_pct != null ? Number(p.var_pct) : null,
    }))
    .sort((a: any, b: any) => Math.abs(b.var_pct ?? 0) - Math.abs(a.var_pct ?? 0));

  return NextResponse.json({ success: true, insumos: rows });
}
