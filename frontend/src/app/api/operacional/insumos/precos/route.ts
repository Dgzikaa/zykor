import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operacional/insumos/precos
 *  - ?bar_id            -> lista de insumos com último preço, preço anterior e variação
 *  - ?bar_id&id_prod=N  -> série histórica de preço daquele insumo (cada pedido)
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const gold = (supabase as any).schema('gold');

  // histórico de um insumo
  const idProd = sp.get('id_prod');
  if (idProd) {
    const { data, error } = await gold.from('vmarket_insumo_preco_hist')
      .select('data, preco, preco_anterior, fornecedor, id_pedido')
      .eq('bar_id', barId).eq('id_prod', Number(idProd))
      .order('dt_inclusao', { ascending: true });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, serie: data ?? [] });
  }

  // lista com variação
  const [precoRes, prodRes] = await Promise.all([
    gold.from('vmarket_insumo_preco').select('id_prod, preco_atual, data_atual, preco_anterior, data_anterior').eq('bar_id', barId),
    supabase.from('bronze_vmarket_produtos').select('id_produto_sisfood_cotacao, nome, cod_interno, nome_secao').eq('bar_id', barId),
  ]);
  if (precoRes.error) return NextResponse.json({ success: false, error: precoRes.error.message }, { status: 500 });
  const nomeMap = new Map<number, any>((prodRes.data || []).map((p: any) => [p.id_produto_sisfood_cotacao, p]));
  // Materiais (limpeza/descartáveis/outros: tabaco, impostos, frete) não são insumos — fora da variação
  const ehMaterial = (s: string | null) => /limpeza|descart|outros/i.test(s || '');
  const rows = (precoRes.data || [])
    .filter((p: any) => p.preco_atual != null && !ehMaterial(nomeMap.get(p.id_prod)?.nome_secao))
    .map((p: any) => {
      const info = nomeMap.get(p.id_prod) || {};
      const atual = Number(p.preco_atual), ant = p.preco_anterior != null ? Number(p.preco_anterior) : null;
      const var_pct = ant && ant > 0 ? ((atual - ant) / ant) * 100 : null;
      return {
        id_prod: p.id_prod, nome: info.nome || `#${p.id_prod}`, cod_interno: info.cod_interno || null, secao: info.nome_secao || null,
        preco_atual: atual, data_atual: p.data_atual, preco_anterior: ant, var_pct,
      };
    })
    .sort((a: any, b: any) => Math.abs(b.var_pct ?? 0) - Math.abs(a.var_pct ?? 0));

  return NextResponse.json({ success: true, insumos: rows });
}
