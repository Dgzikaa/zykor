import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Saídas (consumo teórico) por período: saída de produto/venda explodida na ficha técnica.
 * GET ?bar_id&ini&fim&aba=insumo|producao|geral  → lista normalizada (rows)
 * GET ?...&aba=insumo|producao&codigo=X          → quebra por produto (breakdown)
 *  - insumo: quanto de cada insumo saiu (explosão até insumo)
 *  - producao: quanto de cada produção (preparo) saiu
 *  - geral: finalizações vendidas + produções consumidas, lado a lado
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  const codigo = sp.get('codigo');
  const aba = sp.get('aba') || 'insumo';
  if (!barId || !ini || !fim) return NextResponse.json({ success: false, error: 'bar_id, ini e fim obrigatórios' }, { status: 400 });

  const silver = (await getAdminClient() as any).schema('silver');
  try {
    if (aba === 'producao') {
      if (codigo) {
        const { data, error } = await silver.rpc('fn_consumo_producao_por_produto', { p_bar_id: barId, p_codigo: codigo, p_ini: ini, p_fim: fim });
        if (error) throw error;
        return NextResponse.json({ success: true, breakdown: (data || []).map((p: any) => ({ produto_cod: p.produto_cod, produto_nome: p.produto_nome, qtd: p.qtd })) });
      }
      const { data, error } = await silver.rpc('fn_consumo_producao_periodo', { p_bar_id: barId, p_ini: ini, p_fim: fim });
      if (error) throw error;
      return NextResponse.json({ success: true, rows: (data || []).map((r: any) => ({ codigo: r.producao_cod, nome: r.producao_nome, categoria: r.secao || 'Produção', qtd: r.qtd_base, unidade: r.unidade, dias: r.dias })) });
    }

    if (aba === 'geral') {
      const { data, error } = await silver.rpc('fn_saidas_geral_periodo', { p_bar_id: barId, p_ini: ini, p_fim: fim });
      if (error) throw error;
      return NextResponse.json({ success: true, rows: (data || []).map((r: any) => ({ tipo: r.tipo, codigo: r.codigo, nome: r.nome, categoria: r.categoria, qtd: r.qtd, unidade: r.unidade, valor: r.valor, dias: r.dias })) });
    }

    // aba=insumo (default)
    if (codigo) {
      const { data, error } = await silver.rpc('fn_consumo_insumo_por_produto', { p_bar_id: barId, p_codigo: codigo, p_ini: ini, p_fim: fim });
      if (error) throw error;
      return NextResponse.json({ success: true, breakdown: (data || []).map((p: any) => ({ produto_cod: p.produto_cod, produto_nome: p.produto_nome, qtd_venda: p.qtd_produto, qtd: p.qtd_insumo })) });
    }
    const { data, error } = await silver.rpc('fn_consumo_insumo_periodo', { p_bar_id: barId, p_ini: ini, p_fim: fim });
    if (error) throw error;
    return NextResponse.json({ success: true, rows: (data || []).map((r: any) => ({ codigo: r.insumo_codigo, nome: r.insumo_nome, categoria: r.categoria || 'Outros', qtd: r.qtd_base, unidade: r.unidade, dias: r.dias })) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
