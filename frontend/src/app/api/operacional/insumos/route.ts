import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, selectAll } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

// base+embalagem derivados do NOME quando não há override salvo (ex.: "500ml"→ml/500, "11kg"→g/11000)
function deriveUnid(nome: string, um: string | null): { base: string; embalagem: number } {
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
}

/**
 * GET ?bar_id= -> catálogo de insumos (cadastro Zykor 1:1, silver.insumo_catalogo) + comprados sem cadastro.
 * O VMarket (bronze) só alimenta o preço/última compra via silver; a tela mostra 1 nome por insumo.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();

  try {
    // catálogo = cadastro Zykor 1:1 (já com última compra VMarket por código)
    const insumosRaw = await selectAll((from, to) => (supabase as any).schema('silver').from('insumo_catalogo')
      .select('*').eq('bar_id', barId).order('nome', { ascending: true }).range(from, to));
    // comprado no VMarket sem cadastro no Zykor (lista separada)
    const semCadastro = await selectAll((from, to) => (supabase as any).schema('silver').from('insumo_sem_cadastro')
      .select('*').eq('bar_id', barId).order('nome', { ascending: true }).range(from, to)).catch(() => []);
    // insumos que estão em alguma ficha técnica (por código)
    const fichaCods = new Set<string>();
    const fichaItens = await selectAll((from, to) => supabase.from('producao_ficha_item').select('insumo_codigo').eq('componente_tipo', 'insumo').range(from, to)).catch(() => []);
    fichaItens.forEach((r: any) => { if (r.insumo_codigo) fichaCods.add(r.insumo_codigo); });
    const { data: secoes } = await supabase.from('bronze_vmarket_secoes').select('id_secao_cotacao,nome,fl_calc_cmv_faturamento').eq('bar_id', barId).order('nome', { ascending: true });
    const { data: fresh } = await supabase.from('bronze_vmarket_produtos').select('synced_em').eq('bar_id', barId).order('synced_em', { ascending: false }).limit(1);

    const insumos = (insumosRaw || []).map((i: any) => {
      const u = (i.base && Number(i.embalagem) > 0) ? { base: i.base, embalagem: Number(i.embalagem) } : deriveUnid(i.nome, i.unidade_medida);
      return {
        id: i.id, codigo: i.codigo, nome: i.nome, categoria: i.categoria, unidade_medida: i.unidade_medida,
        fator_correcao: !!i.fator_correcao,
        preco_atual: i.preco != null ? Number(i.preco) : null,
        preco_anterior: i.preco_anterior != null ? Number(i.preco_anterior) : null,
        preco_data: i.preco_data,
        fornecedor: i.fornecedor || (i.tem_compra ? null : 'Planilha'),
        tem_compra: !!i.tem_compra,
        tem_ficha: fichaCods.has(i.codigo),
        base: u.base, embalagem: u.embalagem,
      };
    });

    return NextResponse.json({ success: true, insumos, sem_cadastro: semCadastro || [], secoes: secoes || [], synced_em: fresh?.[0]?.synced_em || null });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

const UNID_OK = ['g', 'kg', 'ml', 'l', 'unid', 'pct'];
const mapUnidade = (b: string) => (b === 'un' ? 'unid' : (UNID_OK.includes(b) ? b : 'unid'));

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const ops = (supabase as any).schema('operations');

  // Editar insumo do cadastro (operations.insumos por id) — nome/categoria/unidade/FC + base/embalagem
  if (body.action === 'editar') {
    const id = Number(body.id);
    if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
    const patch: any = {};
    if ('nome' in body) patch.nome = String(body.nome || '').trim();
    if ('categoria' in body) patch.categoria = String(body.categoria || '').trim() || null;
    if ('unidade_medida' in body) patch.unidade_medida = mapUnidade(String(body.unidade_medida || ''));
    if ('fator_correcao' in body) patch.fator_correcao = !!body.fator_correcao;
    if (Object.keys(patch).length) {
      const { error } = await ops.from('insumos').update(patch).eq('bar_id', barId).eq('id', id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (body.base || body.embalagem != null) {
      await supabase.from('insumo_unidade').upsert({
        bar_id: barId, id_prod: -id, base: ['g', 'ml', 'un'].includes(body.base) ? body.base : 'g',
        embalagem: Math.max(Number(body.embalagem) || 1, 0.0001), origem: 'manual', atualizado_em: new Date().toISOString(),
      }, { onConflict: 'bar_id,id_prod' });
    }
    return NextResponse.json({ success: true });
  }

  // Cadastrar insumo no mestre (operations.insumos). Opcional id_prod_vmarket: liga o SKU comprado a esse código.
  if (body.action === 'criar_insumo') {
    const codigo = String(body.codigo || '').trim().toLowerCase();
    const nome = String(body.nome || '').trim();
    if (!/^i\d{2,}$/.test(codigo)) return NextResponse.json({ success: false, error: 'Código deve ser i + números (ex.: i0638)' }, { status: 400 });
    if (!nome) return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 });
    const vmId = Number(body.id_prod_vmarket) || 0;
    const { data: ja } = await ops.from('insumos').select('id').eq('bar_id', barId).eq('codigo', codigo).maybeSingle();
    if (ja) return NextResponse.json({ success: false, error: `Código ${codigo} já existe no cadastro` }, { status: 409 });
    const base = ['g', 'ml', 'un'].includes(body.base) ? body.base : 'un';
    const emb = Number(body.embalagem) > 0 ? Number(body.embalagem) : null;
    // nome já existe? (índice único lower+unaccent WHERE ativo)
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const { data: ativos } = await ops.from('insumos').select('codigo, nome').eq('bar_id', barId).eq('ativo', true);
    const dup = (ativos || []).find((i: any) => norm(i.nome || '') === norm(nome));
    if (dup) {
      const dupJunk = !/^i\d+$/.test(dup.codigo);
      const { count: dupFicha } = await supabase.from('producao_ficha_item').select('id', { count: 'exact', head: true }).eq('componente_tipo', 'insumo').eq('insumo_codigo', dup.codigo);
      if (dupJunk && (dupFicha || 0) === 0) {
        await ops.from('insumos').update({ ativo: false }).eq('bar_id', barId).eq('codigo', dup.codigo);
      } else if (vmId > 0) {
        await supabase.from('bronze_vmarket_produtos').update({ codigo_planilha: dup.codigo }).eq('bar_id', barId).eq('id_produto_sisfood_cotacao', vmId);
        return NextResponse.json({ success: true, codigo: dup.codigo, ligado: true });
      } else {
        return NextResponse.json({ success: false, error: `Já existe o insumo "${dup.nome}" (${dup.codigo}). Use esse código.` }, { status: 409 });
      }
    }
    const payload: any = {
      bar_id: barId, codigo, nome, unidade_medida: base === 'un' ? 'unid' : base,
      custo_unitario: Number(body.custo_unitario) || 0, fator_correcao: !!body.fator_correcao,
    };
    if (body.categoria && String(body.categoria).trim()) payload.categoria = String(body.categoria).trim();
    const { data: novo, error } = await ops.from('insumos').insert(payload).select('id').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    if (vmId > 0) {
      await supabase.from('bronze_vmarket_produtos').update({ codigo_planilha: codigo }).eq('bar_id', barId).eq('id_produto_sisfood_cotacao', vmId);
      if (emb) await supabase.from('insumo_unidade').upsert({ bar_id: barId, id_prod: vmId, cod_interno: codigo, base, embalagem: emb, origem: 'manual', atualizado_em: new Date().toISOString() }, { onConflict: 'bar_id,id_prod' });
    }
    if (novo?.id && emb) await supabase.from('insumo_unidade').upsert({ bar_id: barId, id_prod: -Number(novo.id), cod_interno: codigo, base, embalagem: emb, origem: 'manual', atualizado_em: new Date().toISOString() }, { onConflict: 'bar_id,id_prod' });
    return NextResponse.json({ success: true, codigo });
  }

  // Excluir insumo do cadastro — SÓ se não estiver em ficha. Desvincula as compras VMarket (não apaga o bronze).
  if (body.action === 'excluir_insumo') {
    const id = Number(body.id);
    const codigo = String(body.codigo || '').trim().toLowerCase();
    if (!id && !codigo) return NextResponse.json({ success: false, error: 'insumo inválido' }, { status: 400 });
    if (codigo) {
      const { count } = await supabase.from('producao_ficha_item').select('id', { count: 'exact', head: true }).eq('componente_tipo', 'insumo').eq('insumo_codigo', codigo);
      if ((count || 0) > 0) return NextResponse.json({ success: false, error: 'Insumo está em ficha técnica — não pode excluir.' }, { status: 409 });
      // bloqueia se tem compra vinculada no VMarket
      const { data: cat } = await (supabase as any).schema('silver').from('insumo_catalogo').select('tem_compra').eq('bar_id', barId).eq('codigo', codigo).maybeSingle();
      if (cat?.tem_compra) return NextResponse.json({ success: false, error: 'Insumo tem compra vinculada no VMarket — não pode excluir.' }, { status: 409 });
    }
    if (id) await ops.from('insumos').delete().eq('bar_id', barId).eq('id', id);
    else await ops.from('insumos').delete().eq('bar_id', barId).eq('codigo', codigo);
    if (codigo) {
      await supabase.from('bronze_vmarket_produtos').update({ codigo_planilha: null }).eq('bar_id', barId).eq('codigo_planilha', codigo);
      await supabase.from('insumo_unidade').delete().eq('bar_id', barId).eq('cod_interno', codigo);
    }
    if (id) await supabase.from('insumo_unidade').delete().eq('bar_id', barId).eq('id_prod', -id);
    return NextResponse.json({ success: true });
  }

  // Sincronizar VMarket (compras): atualiza bronze + reconcilia de-para
  if (body.action !== 'sync') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
  const { data, error } = await supabase.rpc('fn_vmarket_sync', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await supabase.rpc('fn_vmarket_seed_unidades', { p_bar_id: barId });
  await supabase.rpc('fn_vmarket_reconciliar_codigos', { p_bar_id: barId });
  return NextResponse.json({ success: true, resultado: data });
}
