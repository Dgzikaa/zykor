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

  const linhas = data || [];
  // último preço + unidade-base por insumo
  let precoMap = new Map<number, number>();
  let unidMap = new Map<number, { base: string; embalagem: number }>();
  if (barId) {
    const [{ data: precos }, { data: unids }] = await Promise.all([
      (supabase as any).schema('gold').from('vmarket_insumo_preco').select('id_prod, preco_atual').eq('bar_id', barId),
      supabase.from('insumo_unidade').select('id_prod, base, embalagem').eq('bar_id', barId),
    ]);
    precoMap = new Map((precos || []).map((p: any) => [p.id_prod, Number(p.preco_atual)]));
    unidMap = new Map((unids || []).map((u: any) => [u.id_prod, { base: u.base, embalagem: Number(u.embalagem) }]));
  }
  // código + unidade + rendimento das produções referenciadas (componentes do tipo produção)
  const refIds = Array.from(new Set(linhas.filter((i: any) => i.producao_ref).map((i: any) => i.producao_ref)));
  const refMap = new Map<number, any>();
  const custoUnitRef = new Map<number, number>(); // custo por unidade do preparo referenciado (da ficha dele)
  if (refIds.length) {
    const { data: refs } = await supabase.from('producao_base').select('id, codigo, unidade, rendimento').in('id', refIds);
    (refs || []).forEach((r: any) => refMap.set(r.id, r));
    // custo da ficha de cada produção referenciada = soma dos itens; por unidade = total / rendimento
    const { data: refItens } = await supabase.from('producao_ficha_item')
      .select('producao_id, insumo_id_vmarket, quantidade, custo_planilha, componente_tipo')
      .in('producao_id', refIds);
    const totalRef = new Map<number, number>();
    for (const ri of refItens || []) {
      let c = 0;
      if (ri.componente_tipo === 'insumo' && ri.insumo_id_vmarket) {
        const p = precoMap.get(ri.insumo_id_vmarket); const u = unidMap.get(ri.insumo_id_vmarket);
        c = (p != null && u && u.embalagem > 0) ? Number(ri.quantidade || 0) * p / u.embalagem : Number(ri.custo_planilha || 0);
      } else {
        c = Number(ri.custo_planilha || 0); // produção aninhada: usa o custo da planilha (1 nível)
      }
      totalRef.set(ri.producao_id, (totalRef.get(ri.producao_id) || 0) + c);
    }
    for (const id of refIds) {
      const rend = Number(refMap.get(id)?.rendimento || 0);
      if (rend > 0) custoUnitRef.set(id, (totalRef.get(id) || 0) / rend);
    }
  }

  const itens = linhas.map((it: any) => {
    const preco = it.insumo_id_vmarket ? (precoMap.get(it.insumo_id_vmarket) ?? null) : null;
    const u = it.insumo_id_vmarket ? unidMap.get(it.insumo_id_vmarket) : null;
    const ref = it.componente_tipo === 'producao' ? refMap.get(it.producao_ref) : null;
    let custo_atual: number | null = null;
    if (preco != null && u && u.embalagem > 0) custo_atual = Number(it.quantidade || 0) * preco / u.embalagem;
    // componente que é produção: custo vem da ficha do preparo (custo/un × qtd usada)
    if (it.componente_tipo === 'producao') {
      const cu = custoUnitRef.get(it.producao_ref);
      if (cu != null) custo_atual = Number(it.quantidade || 0) * cu;
    }
    // unidade de exibição: o que o usuário editou no item vence; senão a base do insumo / a unidade do preparo
    const unidade_exib = it.unidade || u?.base || ref?.unidade || null;
    // preço por unidade-base (insumo: último preço / embalagem; produção: custo da ficha / rendimento)
    const preco_un = it.componente_tipo === 'producao'
      ? (custoUnitRef.get(it.producao_ref) ?? null)
      : (preco != null && u && u.embalagem > 0 ? preco / u.embalagem : null);
    return {
      ...it,
      preco_atual: preco,
      preco_un,
      base: u?.base ?? null,
      unidade_exib,
      componente_codigo: it.componente_tipo === 'producao' ? (ref?.codigo ?? null) : it.insumo_codigo,
      custo_atual,
    };
  });
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
