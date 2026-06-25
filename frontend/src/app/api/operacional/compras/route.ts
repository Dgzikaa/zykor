import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operacional/compras
 *  - ?bar_id&id_pedido=N   -> itens do pedido (gold.vmarket_pedido_item)
 *  - ?bar_id&de&ate        -> pedidos (gold.vmarket_pedido) + cotacoes + resumo do periodo
 * Lê das gold views do VMarket (não bronze cru).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const gold = (supabase as any).schema('gold');

  // --- itens de um pedido ---
  const idPedido = sp.get('id_pedido');
  if (idPedido) {
    const { data, error } = await gold.from('vmarket_pedido_item')
      .select('id_pedido_item,id_produto_sisfood_cotacao,nome_cotacao,marca_cotacao,gramatura_cotacao,preco,quantidade,total,cod_interno,nome_secao')
      .eq('bar_id', barId).eq('id_pedido', Number(idPedido))
      .order('total', { ascending: false });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, itens: data ?? [] });
  }

  // --- lista do período ---
  const de = sp.get('de');
  const ate = sp.get('ate');
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate obrigatórios' }, { status: 400 });

  const [pedRes, cotRes] = await Promise.all([
    gold.from('vmarket_pedido')
      .select('id_pedido,data,fornecedor,cnpj,origem,id_pedido_status,qtd_itens,valor_total,url_nfe,id_cotacao_sisfood')
      .eq('bar_id', barId).gte('data', de).lte('data', ate)
      .order('data', { ascending: false }).order('valor_total', { ascending: false }),
    gold.from('vmarket_cotacao')
      .select('id_cotacao_sisfood,data,nome,fornecedor,valor_economizado,cotacao_fechada')
      .eq('bar_id', barId).gte('data', de).lte('data', ate)
      .order('data', { ascending: false }),
  ]);
  if (pedRes.error) return NextResponse.json({ success: false, error: pedRes.error.message }, { status: 500 });

  const pedidos = pedRes.data ?? [];
  const cotacoes = cotRes.data ?? [];

  const totalComprado = pedidos.reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
  const porFornecedor: Record<string, { fornecedor: string; valor: number; pedidos: number }> = {};
  for (const p of pedidos) {
    const f = p.fornecedor || '—';
    (porFornecedor[f] ??= { fornecedor: f, valor: 0, pedidos: 0 });
    porFornecedor[f].valor += Number(p.valor_total || 0);
    porFornecedor[f].pedidos += 1;
  }
  const topFornecedores = Object.values(porFornecedor).sort((a, b) => b.valor - a.valor).slice(0, 8);

  return NextResponse.json({
    success: true,
    pedidos,
    cotacoes,
    resumo: {
      total_comprado: totalComprado,
      n_pedidos: pedidos.length,
      ticket_medio: pedidos.length ? totalComprado / pedidos.length : 0,
      n_fornecedores: Object.keys(porFornecedor).length,
      economia_cotacoes: cotacoes.reduce((s: number, c: any) => s + Number(c.valor_economizado || 0), 0),
    },
    topFornecedores,
  });
}
