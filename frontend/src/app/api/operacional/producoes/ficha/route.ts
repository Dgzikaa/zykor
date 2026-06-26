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
    .select('id,componente_tipo,insumo_codigo,insumo_id_vmarket,producao_ref,nome_componente,quantidade,unidade,is_mestre,custo_planilha,fator_correcao')
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

  // insumos marcados com Fator de Correção (flag no cadastro) — por id VMarket e por código planilha
  const fcIds = new Set<number>();
  const fcCods = new Set<string>();
  if (barId) {
    const { data: fcRows } = await supabase.from('bronze_vmarket_produtos')
      .select('id_produto_sisfood_cotacao, codigo_planilha, cod_interno').eq('bar_id', barId).eq('fator_correcao', true);
    for (const r of (fcRows || []) as any[]) {
      if (r.id_produto_sisfood_cotacao != null) fcIds.add(Number(r.id_produto_sisfood_cotacao));
      const c = r.codigo_planilha || r.cod_interno; if (c) fcCods.add(c);
    }
    // insumos só-planilha marcados com FC (operations.insumos)
    const { data: fcPlan } = await (supabase as any).schema('operations').from('insumos')
      .select('codigo').eq('bar_id', barId).eq('fator_correcao', true);
    for (const r of (fcPlan || []) as any[]) { if (r.codigo) fcCods.add(r.codigo); }
  }
  const ehFc = (idv: number | null, cod: string | null) => (idv != null && fcIds.has(idv)) || (!!cod && fcCods.has(cod));
  const fcDe = (it: any) => { const f = Number(it.fator_correcao); return f > 0 ? f : 1; };

  // preço da PLANILHA (insumo fora do VMarket) por código — base/embalagem derivadas do nome
  const deriveUnid = (nome: string, um: string | null): { base: string; embalagem: number } => {
    const n = (nome || '').toLowerCase();
    const m = n.match(/(\d+[.,]?\d*)\s*(kg|kilo|litro|lt|ml|gr|grama|l|g)\b/);
    if (m) {
      const num = parseFloat(m[1].replace('.', '').replace(',', '.')) || parseFloat(m[1].replace(',', '.'));
      const u = m[2];
      if (u === 'kg' || u === 'kilo') return { base: 'g', embalagem: num * 1000 };
      if (u === 'l' || u === 'lt' || u === 'litro') return { base: 'ml', embalagem: num * 1000 };
      if (u === 'ml') return { base: 'ml', embalagem: num };
      if (u === 'g' || u === 'gr' || u === 'grama') return { base: 'g', embalagem: num };
    }
    const mc = n.match(/c\/\s*(\d+)/) || n.match(/(\d+)\s*(und|unid|cx|caixa|pct|pacote|fardo)\b/);
    if (mc) return { base: 'un', embalagem: parseInt(mc[1], 10) || 1 };
    if (/vinho|espumante|frisante|moscatel|prosecco|sparkling|(^|\s)v\.|(^|\s)esp\./.test(n)) return { base: 'ml', embalagem: 750 };
    if (/whisky|vodka|\bgin\b|tequila|cacha|\brum\b|licor|conhaque|brandy|aperol|campari|cynar|vermouth|jager|bitter|absinto|steinha|amarula|cointreau|frangelico|limoncello|domecq|netuno|presidente|bananinha|\bjambu\b/.test(n)) return { base: 'ml', embalagem: 1000 };
    const s = (um || '').toLowerCase().trim();
    if (s === 'ml' || s === 'l' || s === 'litro') return { base: 'ml', embalagem: 1000 };
    if (s === 'kg' || s === 'g' || s === 'grama') return { base: 'g', embalagem: 1000 };
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
      .select('producao_id, insumo_id_vmarket, insumo_codigo, quantidade, custo_planilha, componente_tipo, fator_correcao')
      .in('producao_id', refIds);
    const totalRef = new Map<number, number>();
    for (const ri of refItens || []) {
      let c = 0;
      if (ri.componente_tipo === 'insumo') {
        const info = insumoUn(ri.insumo_id_vmarket, ri.insumo_codigo);
        const qEf = Number(ri.quantidade || 0) / fcDe(ri);
        c = info.precoUn != null ? qEf * info.precoUn : Number(ri.custo_planilha || 0);
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
    const fc = fcDe(it);
    const qtdEf = Number(it.quantidade || 0) / fc; // peso efetivo = quantidade ÷ FC
    if (it.componente_tipo === 'insumo') {
      preco_un = info?.precoUn ?? null;
      if (preco_un != null) custo_atual = qtdEf * preco_un;
    } else if (it.componente_tipo === 'producao') {
      const cu = custoUnitRef.get(it.producao_ref);
      preco_un = cu ?? null;
      if (cu != null) custo_atual = qtdEf * cu;
    }
    const base = it.componente_tipo === 'insumo' ? (info?.base ?? null) : null;
    // unidade de exibição segue o CADASTRO: base do insumo / unidade do preparo; só cai no it.unidade (legado) se não houver
    const unidade_exib = base || ref?.unidade || it.unidade || null;
    return {
      ...it,
      preco_atual: it.insumo_id_vmarket ? (precoMap.get(it.insumo_id_vmarket) ?? null) : null,
      preco_un,
      base,
      unidade_exib,
      componente_codigo: it.componente_tipo === 'producao' ? (ref?.codigo ?? null) : it.insumo_codigo,
      fator_correcao: fc,
      insumo_fc: it.componente_tipo === 'insumo' ? ehFc(it.insumo_id_vmarket, it.insumo_codigo) : false,
      qtd_efetiva: qtdEf,
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
  if ('fator_correcao' in body) {
    const f = Number(body.fator_correcao);
    // FC = aproveitamento (0 a 1). Rejeita fora da faixa (ex.: 90 em vez de 0,9)
    if (!Number.isFinite(f) || f <= 0 || f > 1) return NextResponse.json({ success: false, error: 'FC deve estar entre 0 e 1 (ex.: 0,9 = 90%)' }, { status: 400 });
    patch.fator_correcao = f;
  }
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
