import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Componentes da ficha técnica. Parent = producao_id (Produção) OU produto_id (Finalização).
 * Componente = insumo (i0XXX → catálogo VMarket, com último preço) ou outra produção (pcXXXX).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const producaoId = sp.get('producao_id');
  const produtoId = sp.get('produto_id');
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!producaoId && !produtoId) return NextResponse.json({ success: false, error: 'producao_id ou produto_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  let q = supabase.from('producao_ficha_item')
    .select('id,componente_tipo,insumo_codigo,insumo_id_vmarket,producao_ref,nome_componente,quantidade,unidade,is_mestre,custo_planilha')
    .order('is_mestre', { ascending: false }).order('id', { ascending: true });
  q = producaoId ? q.eq('producao_id', Number(producaoId)) : q.eq('produto_id', Number(produtoId));
  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // último preço por insumo (gold.vmarket_insumo_preco)
  let precoMap = new Map<number, number>();
  if (barId) {
    const { data: precos } = await (supabase as any).schema('gold')
      .from('vmarket_insumo_preco').select('id_prod, preco_atual').eq('bar_id', barId);
    precoMap = new Map((precos || []).map((p: any) => [p.id_prod, Number(p.preco_atual)]));
  }
  const itens = (data || []).map((it: any) => ({
    ...it,
    preco_atual: it.insumo_id_vmarket ? (precoMap.get(it.insumo_id_vmarket) ?? null) : null,
  }));
  return NextResponse.json({ success: true, itens });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const producaoId = body.producao_id ? Number(body.producao_id) : null;
  const produtoId = body.produto_id ? Number(body.produto_id) : null;
  const tipo = String(body.componente_tipo || '');
  if ((!producaoId && !produtoId) || !['insumo', 'producao'].includes(tipo)) {
    return NextResponse.json({ success: false, error: 'parent e componente_tipo válidos obrigatórios' }, { status: 400 });
  }
  const supabase = await getAdminClient();
  const payload = {
    producao_id: producaoId,
    produto_id: produtoId,
    componente_tipo: tipo,
    insumo_codigo: tipo === 'insumo' ? (body.insumo_codigo || null) : null,
    insumo_id_vmarket: tipo === 'insumo' && body.insumo_id_vmarket != null ? Number(body.insumo_id_vmarket) : null,
    producao_ref: tipo === 'producao' && body.producao_ref != null ? Number(body.producao_ref) : null,
    nome_componente: body.nome_componente ? String(body.nome_componente) : null,
    quantidade: body.quantidade != null ? Number(body.quantidade) : 0,
    unidade: body.unidade ? String(body.unidade) : null,
  };
  const { data, error } = await supabase.from('producao_ficha_item').insert(payload).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();

  // marcar como mestre = desmarca os irmãos da mesma ficha
  if (body.is_mestre === true) {
    const { data: item } = await supabase.from('producao_ficha_item').select('producao_id,produto_id').eq('id', id).single();
    if (item) {
      const col = item.producao_id ? 'producao_id' : 'produto_id';
      const val = item.producao_id ?? item.produto_id;
      await supabase.from('producao_ficha_item').update({ is_mestre: false }).eq(col, val);
    }
  }
  const patch: any = {};
  if ('is_mestre' in body) patch.is_mestre = body.is_mestre;
  if ('quantidade' in body) patch.quantidade = Number(body.quantidade);
  if ('unidade' in body) patch.unidade = body.unidade;
  const { data, error } = await supabase.from('producao_ficha_item').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await supabase.from('producao_ficha_item').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
