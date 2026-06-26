import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, selectAll } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?bar_id= -> catálogo de insumos (produtos VMarket) + seções + frescor. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();

  let produtos: any[];
  try {
    produtos = await selectAll((from, to) => supabase
      .from('bronze_vmarket_produtos')
      .select('id_produto_sisfood_cotacao,cod_interno,codigo_planilha,fator_correcao,nome,marca,gramatura,gramatura_contagem,estoque,' +
              'nome_secao,id_secao_cotacao,nome_fornecedor,fator_embalagem,nao_requer_cotacao,fl_depara,' +
              'cod_barras,cod_omie,id_produto_erp,solicitacao_compra,id_status_registro,dt_alteracao')
      .eq('bar_id', barId)
      .order('nome', { ascending: true }).range(from, to));
  } catch (e: any) { return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 }); }

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
  const precos = await selectAll((from, to) => (supabase as any).schema('gold')
    .from('vmarket_insumo_preco')
    .select('id_prod, preco_atual, data_atual, preco_anterior, fornecedor_atual')
    .eq('bar_id', barId).range(from, to)).catch(() => []);
  const precoMap = new Map<number, any>((precos || []).map((p: any) => [p.id_prod, p] as [number, any]));

  // Unidade-base + embalagem por insumo (insumo_unidade)
  const unids = await selectAll((from, to) => supabase.from('insumo_unidade').select('id_prod, base, embalagem').eq('bar_id', barId).range(from, to)).catch(() => []);
  const unidMap = new Map<number, any>((unids || []).map((u: any) => [u.id_prod, u] as [number, any]));

  // Código efetivo = Código Planilha (correto/estável) com fallback no cod_interno do VMarket (cru)
  const codEf = (p: any): string | null => p.codigo_planilha || p.cod_interno || null;
  // Confere de integridade do código: código efetivo duplicado (2+ produtos) ou inválido (não i0XXX)
  const codCount = new Map<string, number>();
  for (const p of (produtos as any[]) || []) { const c = codEf(p); if (c) codCount.set(c, (codCount.get(c) || 0) + 1); }
  const valido = (c: string | null) => !!c && /^i\d/.test(c);

  // deriva base + embalagem do NOME (ex.: "500ml"→ml/500, "11kg"→g/11000, "1L"→ml/1000); senão cai na unidade_medida
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
    // caixa/cartela com N unidades (ex.: "caixa 21und", "bdj c/ 30")
    const mc = n.match(/c\/\s*(\d+)/) || n.match(/(\d+)\s*(und|unid|cx|caixa|pct|pacote|fardo)\b/);
    if (mc) return { base: 'un', embalagem: parseInt(mc[1], 10) || 1 };
    // destilados/vinhos sem volume no nome → garrafa padrão (vinho 750ml, destilado 1000ml)
    if (/vinho|espumante|frisante|moscatel|prosecco|sparkling|(^|\s)v\.|(^|\s)esp\./.test(n)) return { base: 'ml', embalagem: 750 };
    if (/whisky|vodka|\bgin\b|tequila|cacha|\brum\b|licor|conhaque|brandy|aperol|campari|cynar|vermouth|jager|bitter|absinto|steinha|amarula|cointreau|frangelico|limoncello|domecq|netuno|presidente|bananinha|\bjambu\b/.test(n)) return { base: 'ml', embalagem: 1000 };
    // unidade_medida: o preço da planilha é por PACOTE (~ kg/L) quando o nome não traz o tamanho
    const s = (um || '').toLowerCase().trim();
    if (s === 'ml' || s === 'l' || s === 'litro') return { base: 'ml', embalagem: 1000 };
    if (s === 'kg' || s === 'g' || s === 'grama') return { base: 'g', embalagem: 1000 };
    return { base: 'un', embalagem: 1 };
  };
  // catálogo da contagem (planilha) — preço placeholder por cod_interno (quando não há compra no VMarket)
  const contagemIns = await selectAll((from, to) => (supabase as any).schema('operations')
    .from('insumos').select('id, codigo, nome, categoria, unidade_medida, custo_unitario, fator_correcao').eq('bar_id', barId).range(from, to)).catch(() => []);
  const planilhaMap = new Map<string, number>();
  for (const i of (contagemIns || [])) { const pv = Number(i.custo_unitario) || 0; if (i.codigo && pv > 0 && !planilhaMap.has(i.codigo)) planilhaMap.set(i.codigo, pv); }
  // cadastro mestre = operations.insumos. Um produto VMarket é "cadastrado" se o código efetivo está no mestre.
  const masterSet = new Set<string>((contagemIns || []).map((i: any) => i.codigo).filter(Boolean));

  // quais insumos estão em ALGUMA ficha técnica (por código i0XXX ou por id do VMarket)
  const fichaCods = new Set<string>();
  const fichaVmIds = new Set<number>();
  const fichaItens = await selectAll((from, to) => supabase.from('producao_ficha_item').select('insumo_codigo, insumo_id_vmarket').eq('componente_tipo', 'insumo').range(from, to)).catch(() => []);
  fichaItens.forEach((r: any) => { if (r.insumo_codigo) fichaCods.add(r.insumo_codigo); if (r.insumo_id_vmarket != null) fichaVmIds.add(Number(r.insumo_id_vmarket)); });
  const temFicha = (cEf: string | null, vmId: number) => (!!cEf && fichaCods.has(cEf)) || fichaVmIds.has(vmId);

  const produtosComPreco = (produtos || []).map((p: any) => {
    const pr = precoMap.get(p.id_produto_sisfood_cotacao);
    const vmPreco = pr?.preco_atual ?? null;
    const cEf = codEf(p);
    const planPreco = cEf ? (planilhaMap.get(cEf) ?? null) : null;
    // prioridade: último preço do VMarket; se nunca comprou, usa o preço da planilha (placeholder)
    const usaPlan = vmPreco == null && planPreco != null;
    return {
      ...p,
      fonte: usaPlan ? 'planilha' : 'vmarket',
      preco_atual: vmPreco ?? planPreco, preco_data: pr?.data_atual ?? null, preco_anterior: pr?.preco_anterior ?? null,
      // fornecedor = de onde veio a última compra (cai pro cadastro VMarket se nunca comprou)
      fornecedor_ultimo: pr?.fornecedor_atual ?? (usaPlan ? 'Planilha' : (p.nome_fornecedor ?? null)),
      cod_duplicado: !!cEf && (codCount.get(cEf) || 0) > 1,
      cod_invalido: !valido(cEf),
      tem_ficha: temFicha(cEf, p.id_produto_sisfood_cotacao),
      cadastrado: !!(cEf && masterSet.has(cEf)),
      tem_compra: vmPreco != null,
      base: unidMap.get(p.id_produto_sisfood_cotacao)?.base ?? null,
      embalagem: unidMap.get(p.id_produto_sisfood_cotacao)?.embalagem ?? null,
    };
  })
  // Zykor é o catálogo oficial: só mostra produto VMarket que está no mestre OU teve compra (esconde lixo de pré-cadastro do VMarket)
  .filter((p: any) => p.cadastrado || p.tem_compra);

  // Insumos que existem SÓ na contagem (fora do VMarket) — placeholder com preço/unidade da PLANILHA.
  // dedup pelo código EFETIVO (codigo_planilha||cod_interno): bronze com cod_interno lixo ('Sim') mas codigo_planilha=i0XXX já cobre o insumo
  const codsBronze = new Set((produtos || []).map((p: any) => codEf(p)).filter(Boolean));
  const foraVmarket = (contagemIns || [])
    .filter((i: any) => /^i\d+$/.test(i.codigo) && !codsBronze.has(i.codigo))
    .map((i: any) => {
      const u = deriveUnid(i.nome, i.unidade_medida);
      const ov = unidMap.get(-Number(i.id)); // override editado (insumo_unidade com id sintético)
      return {
        id_produto_sisfood_cotacao: -Number(i.id), // chave sintética (negativa, não colide com ids VMarket)
        fonte: 'planilha',
        cod_interno: i.codigo, codigo_planilha: i.codigo, fator_correcao: !!i.fator_correcao, nome: i.nome, marca: null, gramatura: null,
        nome_secao: i.categoria, id_secao_cotacao: null,
        nome_fornecedor: null, fornecedor_ultimo: 'Planilha',
        preco_atual: Number(i.custo_unitario) || null, preco_data: null, preco_anterior: null,
        cod_duplicado: false, cod_invalido: false, tem_ficha: temFicha(i.codigo, -Number(i.id)), cadastrado: true,
        base: ov?.base ?? u.base, embalagem: ov?.embalagem ?? u.embalagem,
      };
    });

  return NextResponse.json({
    success: true,
    produtos: [...produtosComPreco, ...foraVmarket],
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
  const supabase = await getAdminClient();

  // Salvar unidade-base/embalagem de um insumo (manual = não é sobrescrito pelo re-seed)
  if (body.action === 'unidade') {
    const idProd = Number(body.id_prod);
    if (!idProd) return NextResponse.json({ success: false, error: 'id_prod obrigatório' }, { status: 400 });
    const payload = {
      bar_id: barId, id_prod: idProd, cod_interno: body.cod_interno ?? null,
      base: ['g', 'ml', 'un'].includes(body.base) ? body.base : 'g',
      embalagem: Math.max(Number(body.embalagem) || 1, 0.0001),
      origem: 'manual', atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from('insumo_unidade').upsert(payload, { onConflict: 'bar_id,id_prod' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Salvar Código Planilha (correto/estável) de um produto VMarket — não é tocado pelo sync
  if (body.action === 'codigo_planilha') {
    const idProd = Number(body.id_prod);
    if (!idProd || idProd < 0) return NextResponse.json({ success: false, error: 'id_prod inválido' }, { status: 400 });
    const cod = (body.codigo_planilha ?? '').trim() || null;
    const { error } = await supabase.from('bronze_vmarket_produtos')
      .update({ codigo_planilha: cod }).eq('bar_id', barId).eq('id_produto_sisfood_cotacao', idProd);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Marcar/desmarcar Fator de Correção do insumo (checkbox) — não é tocado pelo sync
  if (body.action === 'fator_correcao') {
    const idProd = Number(body.id_prod);
    if (!idProd) return NextResponse.json({ success: false, error: 'id_prod inválido' }, { status: 400 });
    // id negativo = insumo só-planilha (operations.insumos.id); positivo = produto VMarket (bronze)
    const { error } = idProd < 0
      ? await (supabase as any).schema('operations').from('insumos')
          .update({ fator_correcao: !!body.fator_correcao }).eq('bar_id', barId).eq('id', -idProd)
      : await supabase.from('bronze_vmarket_produtos')
          .update({ fator_correcao: !!body.fator_correcao }).eq('bar_id', barId).eq('id_produto_sisfood_cotacao', idProd);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Cadastrar insumo manual no mestre (operations.insumos). Usa o código escolhido (i0XXX) pra casar com o VMarket quando a compra chegar.
  if (body.action === 'criar_insumo') {
    const codigo = String(body.codigo || '').trim().toLowerCase();
    const nome = String(body.nome || '').trim();
    if (!/^i\d{2,}$/.test(codigo)) return NextResponse.json({ success: false, error: 'Código deve ser i + números (ex.: i0638)' }, { status: 400 });
    if (!nome) return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 });
    const ops = (supabase as any).schema('operations');
    const { data: ja } = await ops.from('insumos').select('id').eq('bar_id', barId).eq('codigo', codigo).maybeSingle();
    if (ja) return NextResponse.json({ success: false, error: `Código ${codigo} já existe no cadastro` }, { status: 409 });
    const base = ['g', 'ml', 'un'].includes(body.base) ? body.base : 'un';
    const emb = Number(body.embalagem) > 0 ? Number(body.embalagem) : null;
    const payload: any = {
      bar_id: barId, codigo, nome, unidade_medida: base,
      custo_unitario: Number(body.custo_unitario) || 0,
      fator_correcao: !!body.fator_correcao,
    };
    if (body.categoria && String(body.categoria).trim()) payload.categoria = String(body.categoria).trim();
    const { data: novo, error } = await ops.from('insumos').insert(payload).select('id').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    // unidade-base + embalagem (quantidade) — override por id sintético negativo, como a tela faz
    if (novo?.id && emb) {
      await supabase.from('insumo_unidade').upsert({
        bar_id: barId, id_prod: -Number(novo.id), cod_interno: codigo, base, embalagem: emb,
        origem: 'manual', atualizado_em: new Date().toISOString(),
      }, { onConflict: 'bar_id,id_prod' });
    }
    return NextResponse.json({ success: true, codigo });
  }

  // Excluir insumo — SÓ se não estiver em nenhuma ficha técnica
  if (body.action === 'excluir_insumo') {
    const codigo = String(body.codigo || '').trim().toLowerCase();
    const idProd = Number(body.id_prod);
    let temFicha = false;
    if (codigo && /^i\d+$/.test(codigo)) {
      const { count } = await supabase.from('producao_ficha_item').select('id', { count: 'exact', head: true }).eq('componente_tipo', 'insumo').eq('insumo_codigo', codigo);
      if ((count || 0) > 0) temFicha = true;
    }
    if (!temFicha && idProd > 0) {
      const { count } = await supabase.from('producao_ficha_item').select('id', { count: 'exact', head: true }).eq('componente_tipo', 'insumo').eq('insumo_id_vmarket', idProd);
      if ((count || 0) > 0) temFicha = true;
    }
    if (temFicha) return NextResponse.json({ success: false, error: 'Insumo está em ficha técnica — não pode excluir.' }, { status: 409 });
    const ops = (supabase as any).schema('operations');
    if (codigo && /^i\d+$/.test(codigo)) {
      await ops.from('insumos').delete().eq('bar_id', barId).eq('codigo', codigo);
      await supabase.from('bronze_vmarket_produtos').delete().eq('bar_id', barId).or(`codigo_planilha.eq.${codigo},cod_interno.eq.${codigo}`);
      await supabase.from('insumo_unidade').delete().eq('bar_id', barId).eq('cod_interno', codigo);
    } else if (idProd < 0) {
      await ops.from('insumos').delete().eq('bar_id', barId).eq('id', -idProd);
      await supabase.from('insumo_unidade').delete().eq('bar_id', barId).eq('id_prod', idProd);
    } else if (idProd > 0) {
      await supabase.from('bronze_vmarket_produtos').delete().eq('bar_id', barId).eq('id_produto_sisfood_cotacao', idProd);
      await supabase.from('insumo_unidade').delete().eq('bar_id', barId).eq('id_prod', idProd);
    } else return NextResponse.json({ success: false, error: 'Insumo inválido' }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (body.action !== 'sync') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
  const { data, error } = await supabase.rpc('fn_vmarket_sync', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // semeia unidade-base dos insumos novos (não toca nos existentes/manuais)
  await supabase.rpc('fn_vmarket_seed_unidades', { p_bar_id: barId });
  // reconcilia código planilha: cod_interno válido → nome (não sobrescreve o já gravado)
  await supabase.rpc('fn_vmarket_reconciliar_codigos', { p_bar_id: barId });
  return NextResponse.json({ success: true, resultado: data });
}
