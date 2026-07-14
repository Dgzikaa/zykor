import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarSeNaoPode } from '@/lib/permissions/guard';
import { recalcCmvFromFichaParent } from '@/lib/cmv-recalc';

// telas que usam esta rota (itens de ficha) — pra checar permissão por ação
const FICHA_PATHS = ['/operacional/fichas-tecnicas'];

export const dynamic = 'force-dynamic';

// Fichas vinculadas: irmãos do mesmo ficha_grupo_id (mesmo tipo de parent). Edição propaga pra eles.
async function irmaosDoGrupo(supabase: any, parent: { producao_id?: number | null; produto_id?: number | null }): Promise<{ col: 'producao_id' | 'produto_id'; ids: number[] }> {
  const isProd = !!parent.producao_id;
  const table = isProd ? 'producao_base' : 'produto_cardapio';
  const col: 'producao_id' | 'produto_id' = isProd ? 'producao_id' : 'produto_id';
  const selfId = isProd ? parent.producao_id : parent.produto_id;
  if (!selfId) return { col, ids: [] };
  const { data: self } = await supabase.from(table).select('ficha_grupo_id, bar_id').eq('id', selfId).maybeSingle();
  if (!self?.ficha_grupo_id) return { col, ids: [] };
  const { data: irmaos } = await supabase.from(table).select('id').eq('bar_id', self.bar_id).eq('ficha_grupo_id', self.ficha_grupo_id).neq('id', selfId);
  return { col, ids: (irmaos || []).map((r: any) => r.id) };
}

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
  // Produto AGRUPADO (agrupado_em): mostra a ficha do PRINCIPAL (o custo/receita vem dele). A tela
  // exibe read-only e manda editar no principal. Sem isso, a ficha do agrupado (própria, vazia) some.
  let fichaProdutoId = produtoId ? Number(produtoId) : null;
  let agrupadoEm: string | null = null;
  if (produtoId) {
    const { data: selfProd } = await supabase.from('produto_cardapio')
      .select('bar_id, agrupado_em').eq('id', Number(produtoId)).maybeSingle();
    if (selfProd?.agrupado_em) {
      agrupadoEm = selfProd.agrupado_em;
      const { data: principal } = await supabase.from('produto_cardapio')
        .select('id').eq('bar_id', selfProd.bar_id).eq('codigo', selfProd.agrupado_em).maybeSingle();
      if (principal?.id) fichaProdutoId = principal.id;
    }
  }
  let q = supabase.from('producao_ficha_item')
    .select('id,componente_tipo,insumo_codigo,insumo_id_vmarket,producao_ref,nome_componente,quantidade,unidade,is_mestre,custo_planilha,fator_correcao')
    .order('is_mestre', { ascending: false }).order('id', { ascending: true });
  q = producaoId ? q.eq('producao_id', Number(producaoId)) : q.eq('produto_id', fichaProdutoId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = data || [];

  // insumos marcados com Fator de Correção (flag no cadastro) — por código (a ficha não aponta pra SKU do VMarket)
  const fcCods = new Set<string>();
  if (barId) {
    const { data: fcRows } = await supabase.from('bronze_vmarket_produtos')
      .select('codigo_planilha, cod_interno').eq('bar_id', barId).eq('fator_correcao', true);
    for (const r of (fcRows || []) as any[]) { const c = r.codigo_planilha || r.cod_interno; if (c) fcCods.add(c); }
    const { data: fcPlan } = await (supabase as any).schema('operations').from('insumos')
      .select('codigo').eq('bar_id', barId).eq('fator_correcao', true);
    for (const r of (fcPlan || []) as any[]) { if (r.codigo) fcCods.add(r.codigo); }
  }
  const ehFc = (cod: string | null) => (!!cod && fcCods.has(cod));
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
  // catálogo por CÓDIGO (silver.insumo_catalogo já traz nome canônico + preço da última compra + base/embalagem)
  const catMap = new Map<string, { precoUn: number | null; base: string | null; preco: number | null }>();
  const nomeCanonMap = new Map<string, string>(); // código → nome canônico do cadastro (Zykor)
  if (barId) {
    const { data: cat } = await (supabase as any).schema('silver').from('insumo_catalogo').select('codigo, nome, unidade_medida, preco, base, embalagem').eq('bar_id', barId);
    for (const c of (cat || [])) {
      if (!c.codigo) continue;
      if (c.nome && !nomeCanonMap.has(c.codigo)) nomeCanonMap.set(c.codigo, c.nome);
      if (catMap.has(c.codigo)) continue;
      const u = (c.base && Number(c.embalagem) > 0) ? { base: c.base as string, embalagem: Number(c.embalagem) } : deriveUnid(c.nome, c.unidade_medida);
      const preco = c.preco != null ? Number(c.preco) : null;
      catMap.set(c.codigo, { precoUn: (preco != null && u.embalagem > 0) ? preco / u.embalagem : null, base: u.base, preco });
    }
  }
  // preço por unidade-base de um insumo: SÓ por código (sem qualquer SKU do VMarket)
  const insumoUn = (cod: string | null): { precoUn: number | null; base: string | null; preco: number | null } =>
    (cod ? (catMap.get(cod) ?? { precoUn: null, base: null, preco: null }) : { precoUn: null, base: null, preco: null });

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
        const info = insumoUn(ri.insumo_codigo);
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
    const info = it.componente_tipo === 'insumo' ? insumoUn(it.insumo_codigo) : null;
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
      // nome do componente = nome canônico do cadastro (Zykor), não a grafia do VMarket
      nome_componente: it.componente_tipo === 'insumo' ? (nomeCanonMap.get(it.insumo_codigo) ?? it.nome_componente) : it.nome_componente,
      preco_atual: it.componente_tipo === 'insumo' ? (info?.preco ?? null) : null,
      preco_un,
      base,
      unidade_exib,
      componente_codigo: it.componente_tipo === 'producao' ? (ref?.codigo ?? null) : it.insumo_codigo,
      fator_correcao: fc,
      insumo_fc: it.componente_tipo === 'insumo' ? ehFc(it.insumo_codigo) : false,
      qtd_efetiva: qtdEf,
      custo_atual,
    };
  });
  // agrupado_em setado → a ficha exibida é a do principal (read-only na tela).
  return NextResponse.json({ success: true, itens, agrupado_em: agrupadoEm });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, FICHA_PATHS, 'inserir'); if (nega) return nega;
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
    insumo_id_vmarket: null, // a ficha NÃO aponta pra SKU do VMarket — vínculo é por código do cadastro
    producao_ref: tipo === 'producao' && body.producao_ref != null ? Number(body.producao_ref) : null,
    nome_componente: body.nome_componente ? String(body.nome_componente) : null,
    quantidade: body.quantidade != null ? Number(body.quantidade) : 0,
    unidade: body.unidade ? String(body.unidade) : null,
  };
  const { data, error } = await supabase.from('producao_ficha_item').insert(payload).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recalcCmvFromFichaParent(supabase, { producao_id: producaoId, produto_id: produtoId });
  // fichas vinculadas: adiciona o mesmo componente nas irmãs
  const { col, ids } = await irmaosDoGrupo(supabase, { producao_id: producaoId, produto_id: produtoId });
  for (const sid of ids) {
    await supabase.from('producao_ficha_item').insert({ ...payload, producao_id: null, produto_id: null, [col]: sid });
    await recalcCmvFromFichaParent(supabase, { [col]: sid } as any);
  }
  return NextResponse.json({ success: true, item: data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, FICHA_PATHS, 'editar'); if (nega) return nega;
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
  await recalcCmvFromFichaParent(supabase, { producao_id: data?.producao_id, produto_id: data?.produto_id });
  // fichas vinculadas: aplica o mesmo patch no item correspondente das irmãs (mesma chave de componente)
  const { col, ids } = await irmaosDoGrupo(supabase, { producao_id: data?.producao_id, produto_id: data?.produto_id });
  for (const sid of ids) {
    let mq = supabase.from('producao_ficha_item').select('id').eq(col, sid).eq('componente_tipo', data.componente_tipo);
    mq = data.componente_tipo === 'insumo' ? mq.eq('insumo_codigo', data.insumo_codigo) : mq.eq('producao_ref', data.producao_ref);
    const { data: match } = await mq;
    const matchIds = (match || []).map((r: any) => r.id);
    if (matchIds.length) {
      if (body.is_mestre === true) await supabase.from('producao_ficha_item').update({ is_mestre: false }).eq(col, sid);
      await supabase.from('producao_ficha_item').update(patch).in('id', matchIds);
      await recalcCmvFromFichaParent(supabase, { [col]: sid } as any);
    }
  }
  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, FICHA_PATHS, 'excluir'); if (nega) return nega;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { data: alvo } = await supabase.from('producao_ficha_item').select('producao_id,produto_id,componente_tipo,insumo_codigo,producao_ref').eq('id', id).single();
  const { error } = await supabase.from('producao_ficha_item').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (alvo) {
    await recalcCmvFromFichaParent(supabase, { producao_id: alvo.producao_id, produto_id: alvo.produto_id });
    // fichas vinculadas: remove o item correspondente das irmãs
    const { col, ids } = await irmaosDoGrupo(supabase, { producao_id: alvo.producao_id, produto_id: alvo.produto_id });
    for (const sid of ids) {
      let dq = supabase.from('producao_ficha_item').delete().eq(col, sid).eq('componente_tipo', alvo.componente_tipo);
      dq = alvo.componente_tipo === 'insumo' ? dq.eq('insumo_codigo', alvo.insumo_codigo) : dq.eq('producao_ref', alvo.producao_ref);
      await dq;
      await recalcCmvFromFichaParent(supabase, { [col]: sid } as any);
    }
  }
  return NextResponse.json({ success: true });
}
