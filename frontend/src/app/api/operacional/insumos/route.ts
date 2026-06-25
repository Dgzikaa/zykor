import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?bar_id= -> catálogo de insumos (produtos VMarket) + seções + frescor. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();

  const { data: produtos, error } = await supabase
    .from('bronze_vmarket_produtos')
    .select('id_produto_sisfood_cotacao,cod_interno,nome,marca,gramatura,gramatura_contagem,estoque,' +
            'nome_secao,id_secao_cotacao,nome_fornecedor,fator_embalagem,nao_requer_cotacao,fl_depara,' +
            'cod_barras,cod_omie,id_produto_erp,solicitacao_compra,id_status_registro,dt_alteracao')
    .eq('bar_id', barId)
    .order('nome', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const { data: secoes } = await supabase
    .from('bronze_vmarket_secoes')
    .select('id_secao_cotacao,nome,fl_calc_cmv_faturamento')
    .eq('bar_id', barId)
    .order('nome', { ascending: true });

  const { data: fresh } = await supabase
    .from('bronze_vmarket_produtos')
    .select('synced_em')
    .eq('bar_id', barId)
    .order('synced_em', { ascending: false })
    .limit(1);

  // Último preço (e o anterior) de cada insumo, vindo dos pedidos (gold.vmarket_insumo_preco)
  const { data: precos } = await (supabase as any).schema('gold')
    .from('vmarket_insumo_preco')
    .select('id_prod, preco_atual, data_atual, preco_anterior, fornecedor_atual')
    .eq('bar_id', barId);
  const precoMap = new Map<number, any>((precos || []).map((p: any) => [p.id_prod, p]));
  const produtosComPreco = (produtos || []).map((p: any) => {
    const pr = precoMap.get(p.id_produto_sisfood_cotacao);
    return {
      ...p,
      preco_atual: pr?.preco_atual ?? null, preco_data: pr?.data_atual ?? null, preco_anterior: pr?.preco_anterior ?? null,
      // fornecedor = de onde veio a última compra (cai pro cadastro VMarket se nunca comprou)
      fornecedor_ultimo: pr?.fornecedor_atual ?? p.nome_fornecedor ?? null,
    };
  });

  return NextResponse.json({
    success: true,
    produtos: produtosComPreco,
    secoes: secoes || [],
    synced_em: fresh?.[0]?.synced_em || null,
  });
}

/** POST { bar_id, action:'sync' } -> dispara o sync VMarket (login + produtos/seções/fornecedores). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  if (body.action !== 'sync') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase.rpc('fn_vmarket_sync', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, resultado: data });
}
