import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, selectAll } from '@/lib/supabase-admin';
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

    // o VMarket manda nome_cotacao em branco em ~70% dos itens — resolve pelo código do cadastro (cod_interno → insumo)
    const itens = data ?? [];
    const cods = Array.from(new Set(itens.map((i: any) => (i.cod_interno || '').toUpperCase()).filter(Boolean)));
    const nomeMap = new Map<string, string>();
    if (cods.length) {
      const { data: ins } = await (supabase as any).schema('operations').from('insumos')
        .select('codigo,nome').eq('bar_id', barId);
      for (const r of (ins || []) as any[]) if (r.codigo) nomeMap.set(String(r.codigo).toUpperCase(), r.nome);
    }
    const out = itens.map((i: any) => ({
      ...i,
      nome: (i.nome_cotacao && String(i.nome_cotacao).trim()) || nomeMap.get((i.cod_interno || '').toUpperCase()) || i.cod_interno || '—',
    }));
    return NextResponse.json({ success: true, itens: out });
  }

  // --- análises do período (insights de compras) ---
  if (sp.get('analises')) {
    const de = sp.get('de'); const ate = sp.get('ate');
    if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate obrigatórios' }, { status: 400 });
    const { data, error } = await gold.rpc('fn_compras_analises', { p_bar: barId, p_ini: de, p_fim: ate });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, analises: data });
  }

  // --- lista do período ---
  const de = sp.get('de');
  const ate = sp.get('ate');
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate obrigatórios' }, { status: 400 });

  // paginado (selectAll): bar movimentado pode passar de 1000 pedidos/cotações no período → truncava
  const [pedidosAll, cotacoes] = await Promise.all([
    selectAll<any>((from, to) => gold.from('vmarket_pedido')
      .select('id_pedido,data,fornecedor,cnpj,origem,id_pedido_status,nm_status,dt_entrega,dt_prazo_entrega,qtd_itens,valor_total,url_nfe,id_cotacao_sisfood')
      .eq('bar_id', barId).gte('data', de).lte('data', ate)
      .order('data', { ascending: false }).order('valor_total', { ascending: false }).range(from, to)),
    selectAll<any>((from, to) => gold.from('vmarket_cotacao')
      .select('id_cotacao_sisfood,data,nome,fornecedor,valor_economizado,cotacao_fechada')
      .eq('bar_id', barId).gte('data', de).lte('data', ate)
      .order('data', { ascending: false }).range(from, to)),
  ]);

  let pedidos = pedidosAll;

  // busca por PRODUTO (ex.: abacaxi, Spaten): filtra os pedidos que têm algum item com o nome.
  // O VMarket manda nome_cotacao em branco em ~70% dos itens (ex.: AMBEV), então além do
  // nome_cotacao a gente resolve pelo cadastro: acha os insumos cujo nome casa e pega os
  // itens por cod_interno (mesmo de-para que a exibição do pedido usa).
  const produto = (sp.get('produto') || '').trim();
  if (produto) {
    const porNome = await selectAll((from, to) => gold.from('vmarket_pedido_item')
      .select('id_pedido').eq('bar_id', barId).ilike('nome_cotacao', `%${produto}%`).range(from, to)).catch(() => []);

    const { data: insMatch } = await (supabase as any).schema('operations').from('insumos')
      .select('codigo').eq('bar_id', barId).ilike('nome', `%${produto}%`);
    const cods = Array.from(new Set(((insMatch || []) as any[]).map((r: any) => r.codigo).filter(Boolean)));
    let porCodigo: any[] = [];
    if (cods.length) {
      porCodigo = await selectAll((from, to) => gold.from('vmarket_pedido_item')
        .select('id_pedido').eq('bar_id', barId).in('cod_interno', cods).range(from, to)).catch(() => []) as any[];
    }

    const ids = new Set([...(porNome as any[]), ...porCodigo].map((r: any) => r.id_pedido));
    pedidos = pedidos.filter((p: any) => ids.has(p.id_pedido));
  }

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
