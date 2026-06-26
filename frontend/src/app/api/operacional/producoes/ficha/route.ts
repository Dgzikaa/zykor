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
  // último preço (VMarket) + unidade-base por insumo
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

  // preço da PLANILHA (insumo fora do VMarket) por código — base/embalagem derivadas do nome
  const deriveUnid = (nome: string, um: string | null): { base: string; embalagem: number } => {
    const m = (nome || '').match(/(\d+[.,]?\d*)\s*(kg|kilo|litro|lt|ml|gr|grama|l|g)\b/i);
    if (m) {
      const num = parseFloat(m[1].replace('.', '').replace(',', '.')) || parseFloat(m[1].replace(',', '.'));
      const u = m[2].toLowerCase();
      if (u === 'kg' || u === 'kilo') return { base: 'g', embalagem: num * 1000 };
      if (u === 'l' || u === 'lt' || u === 'litro') return { base: 'ml', embalagem: num * 1000 };
      if (u === 'ml') return { base: 'ml', embalagem: num };
      if (u === 'g' || u === 'gr' || u === 'grama') return { base: 'g', embalagem: num };
    }
    const s = (um || '').toLowerCase().trim();
    if (s === 'ml') return { base: 'ml', embalagem: 1 };
    if (s === 'l' || s === 'litro') return { base: 'ml', embalagem: 1000 };
    if (s === 'kg') return { base: 'g', embalagem: 1000 };
    if (s === 'g' || s === 'grama') return { base: 'g', embalagem: 1 };
    return { base: 'un', embalagem: 1 };
  };
  const planMap = new Map<string, { precoUn: number | null; base: string }>();
  if (barId) {
    const { data: planIns } = await (supabase as any).schema('operations').from('insumos').select('codigo, nome, unidade_medida, custo_unitario').eq('bar_id', barId);
    for (const i of (planIns || [])) {
      if (!i.codigo || planMap.has(i.codigo)) continue;
      const u = deriveUnid(i.nome, i.unidade_medida);
      const cu = Number(i.custo_unitario) || 0;
      planMap.set(i.codigo, { precoUn: (u.embalagem > 0 && cu > 0) ? cu / u.embalagem : null, base: u.base });
    }
  }
  // preço por unidade-base de um insumo: VMarket (último preço/embalagem) tem prioridade; senão planilha
  const insumoUn = (idv: number | null, cod: string | null): { precoUn: number | null; base: string | null } => {
    if (idv) { const p = precoMap.get(idv); const u = unidMap.get(idv); if (p != null && u && u.embalagem > 0) return { precoUn: p / u.embalagem, base: u.base }; }
    const pl = cod ? planMap.get(cod) : null;
    if (pl && pl.precoUn != null) return { precoUn: pl.precoUn, base: pl.base };
    if (idv && unidMap.get(idv)) return { precoUn: null, base: unidMap.get(idv)!.base };
    if (pl) return { precoUn: null, base: pl.base };
    return { precoUn: null, base: null };
  };

  // código + unidade + rendimento das produções referenciadas (componentes do tipo produção)
  const refIds = Array.from(new Set(linhas.filter((i: any) => i.producao_ref).map((i: any) => i.producao_ref)));
  const refMap = new Map<number, any>();
  const custoUnitRef = new Map<number, number>(); // custo por unidade do preparo referenciado (da ficha dele)
  if (refIds.length) {
    const { data: refs } = await supabase.from('producao_base').select('id, codigo, unidade, rendimento').in('id', refIds);
    (refs || []).forEach((r: any) => refMap.set(r.id, r));
    const { data: refItens } = await supabase.from('producao_ficha_item')
      .select('producao_id, insumo_id_vmarket, insumo_codigo, quantidade, custo_planilha, componente_tipo')
      .in('producao_id', refIds);
    const totalRef = new Map<number, number>();
    for (const ri of refItens || []) {
      let c = 0;
      if (ri.componente_tipo === 'insumo') {
        const info = insumoUn(ri.insumo_id_vmarket, ri.insumo_codigo);
        c = info.precoUn != null ? Number(ri.quantidade || 0) * info.precoUn : Number(ri.custo_planilha || 0);
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
    const ref = it.componente_tipo === 'producao' ? refMap.get(it.producao_ref) : null;
    const info = it.componente_tipo === 'insumo' ? insumoUn(it.insumo_id_vmarket, it.insumo_codigo) : null;
    let preco_un: number | null = null;
    let custo_atual: number | null = null;
    if (it.componente_tipo === 'insumo') {
      preco_un = info?.precoUn ?? null;
      if (preco_un != null) custo_atual = Number(it.quantidade || 0) * preco_un;
    } else if (it.componente_tipo === 'producao') {
      const cu = custoUnitRef.get(it.producao_ref);
      preco_un = cu ?? null;
      if (cu != null) custo_atual = Number(it.quantidade || 0) * cu;
    }
    const base = it.componente_tipo === 'insumo' ? (info?.base ?? null) : null;
    // unidade de exibição: o que o usuário editou no item vence; senão a base do insumo / a unidade do preparo
    const unidade_exib = it.unidade || base || ref?.unidade || null;
    return {
      ...it,
      preco_atual: it.insumo_id_vmarket ? (precoMap.get(it.insumo_id_vmarket) ?? null) : null,
      preco_un,
      base,
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
