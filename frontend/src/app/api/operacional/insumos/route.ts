import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, selectAll } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { recalcCmvTeorico } from '@/lib/cmv-recalc';
import { deriveUnid } from '@/lib/insumo-unidade';

export const dynamic = 'force-dynamic';

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
    // As 5 fontes são independentes (só dependem do bar) → rodam EM PARALELO (antes, em fila).
    const [insumosRaw, semCadastro, fichaRes, secoesRes, freshRes] = await Promise.all([
      // catálogo = cadastro Zykor 1:1 (já com última compra VMarket por código)
      selectAll((from, to) => (supabase as any).schema('silver').from('insumo_catalogo')
        .select('*').eq('bar_id', barId).order('nome', { ascending: true }).range(from, to)),
      // comprado no VMarket sem cadastro no Zykor (lista separada)
      selectAll((from, to) => (supabase as any).schema('silver').from('insumo_sem_cadastro')
        .select('*').eq('bar_id', barId).order('nome', { ascending: true }).range(from, to)).catch(() => []),
      // insumos em ficha técnica DO BAR (código i0XXX é reusado entre bares → por bar)
      (supabase as any).schema('operations').rpc('fn_insumos_em_ficha', { p_bar_id: barId }),
      supabase.from('bronze_vmarket_secoes').select('id_secao_cotacao,nome,fl_calc_cmv_faturamento').eq('bar_id', barId).order('nome', { ascending: true }),
      supabase.from('bronze_vmarket_produtos').select('synced_em').eq('bar_id', barId).order('synced_em', { ascending: false }).limit(1),
    ]);
    const fichaCods = new Set<string>();
    (fichaRes?.data || []).forEach((r: any) => { if (r.insumo_codigo) fichaCods.add(r.insumo_codigo); });
    const secoes = secoesRes?.data;
    const fresh = freshRes?.data;

    const insumos = (insumosRaw || []).map((i: any) => {
      const u = (i.base && Number(i.embalagem) > 0) ? { base: i.base, embalagem: Number(i.embalagem) } : deriveUnid(i.nome, i.unidade_medida);
      return {
        id: i.id, codigo: i.codigo, nome: i.nome, categoria: i.categoria,
        secao_vmarket: i.secao_vmarket || null, secao_vmarket_manual: i.secao_vmarket_manual || null, secao_vmarket_auto: i.secao_vmarket_auto || null,
        unidade_medida: i.unidade_medida,
        fator_correcao: !!i.fator_correcao,
        curva_a: !!i.curva_a, curva_a_proteina: !!i.curva_a_proteina, frequencia: i.frequencia,
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
  const nega = negarPorRota(user, request); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const ops = (supabase as any).schema('operations');
  // toda edição de insumo (preço/embalagem/código/cadastro/exclusão/sync) muda o custo da ficha →
  // recalcula o CMV teórico na hora pra refletir na tela sem depender do botão Recalcular.
  const ok = async (extra: Record<string, any> = {}) => {
    await recalcCmvTeorico(supabase, barId);
    return NextResponse.json({ success: true, ...extra });
  };

  // Editar insumo do cadastro (operations.insumos por id) — nome/categoria/unidade/FC + base/embalagem
  if (body.action === 'editar') {
    const id = Number(body.id);
    if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
    // troca de código (corrige de-para errado / código feio): valida + renomeia em cascata (cadastro, fichas, de-para, unidade)
    if ('codigo' in body) {
      const novoCod = String(body.codigo || '').trim().toLowerCase();
      const { data: atual } = await ops.from('insumos').select('codigo').eq('bar_id', barId).eq('id', id).maybeSingle();
      const oldCod = atual?.codigo;
      if (novoCod && oldCod && novoCod !== oldCod) {
        if (!/^i\d{2,}$/.test(novoCod)) return NextResponse.json({ success: false, error: 'Código deve ser i + números (ex.: i0084)' }, { status: 400 });
        const { data: ja } = await ops.from('insumos').select('id').eq('bar_id', barId).eq('codigo', novoCod).maybeSingle();
        if (ja) return NextResponse.json({ success: false, error: `Código ${novoCod} já existe em outro insumo` }, { status: 409 });
        const { error: rErr } = await supabase.rpc('fn_renomear_insumo_codigo', { p_bar: barId, p_old: oldCod, p_new: novoCod });
        if (rErr) return NextResponse.json({ success: false, error: rErr.message }, { status: 500 });
      }
    }
    const patch: any = {};
    if ('nome' in body) patch.nome = String(body.nome || '').trim();
    if ('categoria' in body) patch.categoria = String(body.categoria || '').trim() || null;
    // override manual da Seção VMarket (categoria de compra) — vence o derivado do de-para VMarket
    if ('secao_vmarket' in body) patch.secao_vmarket_manual = String(body.secao_vmarket || '').trim() || null;
    if ('unidade_medida' in body) patch.unidade_medida = mapUnidade(String(body.unidade_medida || ''));
    if ('fator_correcao' in body) patch.fator_correcao = !!body.fator_correcao;
    if ('curva_a' in body) { patch.curva_a = !!body.curva_a; patch.frequencia = body.curva_a ? 'diaria' : 'semanal'; }
    if ('curva_a_proteina' in body) patch.curva_a_proteina = !!body.curva_a_proteina;
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
    return ok();
  }

  // Vincular um SKU comprado no VMarket a um insumo JÁ cadastrado (sem criar novo)
  if (body.action === 'vincular_vmarket') {
    const idVm = Number(body.id_prod_vmarket);
    const codigo = String(body.codigo || '').trim().toLowerCase();
    if (!idVm || !codigo) return NextResponse.json({ success: false, error: 'id e código obrigatórios' }, { status: 400 });
    const { data: ins } = await ops.from('insumos').select('id').eq('bar_id', barId).eq('codigo', codigo).maybeSingle();
    if (!ins) return NextResponse.json({ success: false, error: `Insumo ${codigo} não existe no cadastro` }, { status: 404 });
    const { error } = await supabase.from('bronze_vmarket_produtos').update({ codigo_planilha: codigo }).eq('bar_id', barId).eq('id_produto_sisfood_cotacao', idVm);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return ok({ codigo });
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
      const { data: dupFichaRows } = await ops.rpc('fn_insumos_em_ficha', { p_bar_id: barId });
      const dupEmFicha = (dupFichaRows || []).some((r: any) => r.insumo_codigo === dup.codigo);
      if (dupJunk && !dupEmFicha) {
        await ops.from('insumos').update({ ativo: false }).eq('bar_id', barId).eq('codigo', dup.codigo);
      } else if (vmId > 0) {
        await supabase.from('bronze_vmarket_produtos').update({ codigo_planilha: dup.codigo }).eq('bar_id', barId).eq('id_produto_sisfood_cotacao', vmId);
        return ok({ codigo: dup.codigo, ligado: true });
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
    return ok({ codigo });
  }

  // Excluir insumo do cadastro — SÓ se não estiver em ficha. Desvincula as compras VMarket (não apaga o bronze).
  if (body.action === 'excluir_insumo') {
    const id = Number(body.id);
    const codigo = String(body.codigo || '').trim().toLowerCase();
    if (!id && !codigo) return NextResponse.json({ success: false, error: 'insumo inválido' }, { status: 400 });
    if (codigo) {
      // em ficha DO BAR (código i0XXX é reusado entre bares — não bloquear por ficha de outro bar)
      const { data: fichaRows } = await ops.rpc('fn_insumos_em_ficha', { p_bar_id: barId });
      if ((fichaRows || []).some((r: any) => r.insumo_codigo === codigo)) return NextResponse.json({ success: false, error: 'Insumo está em ficha técnica — não pode excluir.' }, { status: 409 });
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
    return ok();
  }

  // Sincronizar VMarket (compras): atualiza bronze + reconcilia de-para
  if (body.action !== 'sync') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
  const { data, error } = await supabase.rpc('fn_vmarket_sync', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await supabase.rpc('fn_vmarket_seed_unidades', { p_bar_id: barId });
  await supabase.rpc('fn_vmarket_reconciliar_codigos', { p_bar_id: barId });
  return ok({ resultado: data });
}
