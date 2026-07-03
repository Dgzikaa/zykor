import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, selectAll } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarSeNaoPode } from '@/lib/permissions/guard';

const PATHS = ['/operacional/fichas-tecnicas'];

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Planilha mestre (cadastro inicial). Depois o cadastro é feito no Zykor.
const SHEET = '1klPn-uVLKeoJ9UA9TkiSYqa7sV7NdUdDEELdgd1q4b8';
const BAR_PARA_F: Record<number, string> = { 3: '1', 4: '2' };

const categoriaPorCodigo = (cod: string): string | null => {
  const c = cod[0]?.toLowerCase();
  return c === 'b' ? 'Bebida' : c === 'd' ? 'Drink' : c === 'c' ? 'Comida' : null;
};

async function fetchSheet(range: string, key: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(range)}?key=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const j = await r.json();
  return (j.values as string[][]) || [];
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  try {
    // todas as queries paginadas (PostgREST corta em ~1000 linhas)
    const data = await selectAll((from, to) => supabase
      .from('produto_cardapio')
      .select('id,codigo,nome,categoria,ativo,origem,atualizado_em,agrupado_em')
      .eq('bar_id', barId).order('codigo', { ascending: true }).range(from, to));

    // contagem de itens da ficha (finalização) por produto — via view agregada (1 linha por produto)
    const contagem: Record<number, number> = {};
    // ORDER estável é obrigatório: a view tem >1000 linhas e sem ordenação a paginação
    // pula linhas entre páginas → contagem some pra alguns produtos → falso "ficha vazia".
    const itens = await selectAll((from, to) => supabase.from('v_produto_ficha_count').select('produto_id, n').order('produto_id', { ascending: true }).range(from, to));
    itens.forEach((i: any) => { if (i.produto_id) contagem[i.produto_id] = i.n; });

    // cód ContaHub (prd) + preço de venda (cardápio) por cod_interno — um produto pode ter vários (HH/PP/variações)
    const chMap: Record<string, number[]> = {};
    const precoVendaMap: Record<string, number> = {};
    const chRows = await selectAll((from, to) => supabase.from('produto_contahub_map').select('prd, cod_interno, preco_venda').eq('bar_id', barId).range(from, to));
    chRows.forEach((r: any) => {
      if (!r.cod_interno) return;
      (chMap[r.cod_interno] ??= []).push(r.prd);
      const pv = Number(r.preco_venda || 0);
      if (pv > 0) precoVendaMap[r.cod_interno] = Math.max(precoVendaMap[r.cod_interno] || 0, pv);
    });

    // ID Yuzer (produto_id real da Yuzer) por cod_interno
    const yzMap: Record<string, string[]> = {};
    const yzRows = await selectAll((from, to) => supabase.from('produto_yuzer_map').select('yuzer_produto_id, cod_interno').eq('bar_id', barId).not('yuzer_produto_id', 'is', null).range(from, to));
    yzRows.forEach((r: any) => { if (r.cod_interno) (yzMap[r.cod_interno] ??= []).push(String(r.yuzer_produto_id)); });

    // Preço de venda no Yuzer (último, automático) por cod_interno
    const yzPrecoMap: Record<string, number> = {};
    const yzPrecos = await selectAll((from, to) => (supabase as any).schema('gold').from('produto_preco_yuzer').select('cod_interno, preco_yuzer').eq('bar_id', barId).range(from, to));
    yzPrecos.forEach((r: any) => { if (r.cod_interno && r.preco_yuzer != null) yzPrecoMap[r.cod_interno] = Number(r.preco_yuzer); });

    // vendido no ContaHub (30d) mas SEM produto cadastrado/mapeado (exclui [IN]/ajuste de estoque)
    let vendasSemCadastro: any[] = [];
    try {
      const { data: vsc } = await (supabase as any).schema('operations').rpc('fn_vendas_sem_cadastro', { p_bar: barId, p_dias: 30 });
      vendasSemCadastro = (vsc || []).map((r: any) => ({ prd: String(r.prd), desc: r.prd_desc || `prd ${r.prd}`, qtd: Number(r.qtd || 0), valor: Number(r.valor || 0) }));
    } catch { /* sem dado = lista vazia */ }

    return NextResponse.json({
      success: true,
      produtos: data.map((p: any) => ({ ...p, qtd_componentes: contagem[p.id] || 0, cods_ch: chMap[p.codigo] || [], cods_yuzer: yzMap[p.codigo] || [], preco_venda: precoVendaMap[p.codigo] ?? null, preco_yuzer: yzPrecoMap[p.codigo] ?? null })),
      vendas_sem_cadastro: vendasSemCadastro,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, PATHS, 'inserir'); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();

  // ----- ATUALIZAR DO CONTAHUB (catálogo completo → status ativo + preço de venda) -----
  if (body.action === 'sync_contahub') {
    // 1) atualiza o catálogo completo (ativo+inativo) no bronze (edge function, aguarda)
    try { await (supabase as any).functions.invoke('contahub-produtos-catalogo', { body: { bar_id: barId } }); }
    catch (e: any) { return NextResponse.json({ success: false, error: `Falha ao consultar ContaHub: ${e?.message}` }, { status: 502 }); }
    // 2) sincroniza preço + status e recalcula o CMV
    const { data: precos } = await supabase.rpc('fn_sync_preco_contahub', { p_bar_id: barId });
    const { data: ativos } = await supabase.rpc('fn_sync_produto_ativo_contahub', { p_bar_id: barId });
    await (supabase as any).schema('gold').rpc('fn_cmv_teorico', { p_bar_id: barId });
    return NextResponse.json({ success: true, precos_atualizados: precos ?? 0, ativos_atualizados: ativos ?? 0 });
  }

  // ----- IMPORTAR DO CARDÁPIO (planilha) -----
  if (body.action === 'importar') {
    const fAlvo = BAR_PARA_F[barId];
    if (!fAlvo) return NextResponse.json({ success: false, error: 'Bar sem mapeamento na planilha do cardápio' }, { status: 400 });
    const { data: creds } = await (supabase as any)
      .from('api_credentials').select('configuracoes').eq('sistema', 'google_sheets').eq('bar_id', 3).limit(1);
    const key = creds?.[0]?.configuracoes?.api_key;
    if (!key) return NextResponse.json({ success: false, error: 'API key do Google Sheets não encontrada' }, { status: 500 });

    let rows: string[][];
    try { rows = await fetchSheet("'Cardápio'!B7:F2000", key); }
    catch (e: any) { return NextResponse.json({ success: false, error: `Falha ao ler planilha: ${e?.message}` }, { status: 502 }); }

    const { data: existentes } = await supabase.from('produto_cardapio').select('codigo').eq('bar_id', barId);
    const jaExiste = new Set((existentes || []).map((e: any) => e.codigo));

    const novos: any[] = [];
    let ignoradosOutroBar = 0;
    for (const row of rows) {
      const ativo = (row[0] || '').toString().trim().toUpperCase() === 'S';
      const codigo = (row[1] || '').toString().trim();
      const nome = (row[2] || '').toString().trim();
      const bar = (row[4] || '').toString().trim();
      if (!codigo || !nome || !/^[a-z]+\d/i.test(codigo)) continue;
      if (bar !== fAlvo) { ignoradosOutroBar++; continue; }
      if (jaExiste.has(codigo)) continue;
      jaExiste.add(codigo);
      novos.push({ bar_id: barId, codigo, nome, ativo, categoria: categoriaPorCodigo(codigo), origem: 'planilha' });
    }
    if (novos.length) {
      const { error } = await supabase.from('produto_cardapio').insert(novos);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, importados: novos.length, ignorados_outro_bar: ignoradosOutroBar });
  }

  // ----- EDITAR CÓDIGOS (ContaHub / Yuzer) de um produto existente -----
  if (body.action === 'codigos') {
    const codInterno = String(body.codigo || '').trim();
    if (!codInterno) return NextResponse.json({ success: false, error: 'codigo obrigatório' }, { status: 400 });
    const nomeProd = String(body.nome || '').trim();
    const parse = (v: any) => Array.from(new Set((Array.isArray(v) ? v : String(v ?? '').split(',')).map((x: any) => Number(String(x).trim())).filter((n: number) => Number.isFinite(n) && n > 0)));
    const chArr = parse(body.cods_ch);
    const yzArr = parse(body.cods_yuzer);
    // ContaHub: adiciona os novos (preserva preço), remove os tirados
    const { data: curCh } = await supabase.from('produto_contahub_map').select('prd').eq('bar_id', barId).eq('cod_interno', codInterno);
    const curChSet = new Set((curCh || []).map((r: any) => Number(r.prd)));
    const chRemove = [...curChSet].filter(p => !chArr.includes(p));
    if (chRemove.length) await supabase.from('produto_contahub_map').delete().eq('bar_id', barId).eq('cod_interno', codInterno).in('prd', chRemove);
    for (const prd of chArr) if (!curChSet.has(prd)) await supabase.from('produto_contahub_map').upsert({ bar_id: barId, prd, cod_interno: codInterno }, { onConflict: 'bar_id,prd' });
    // Yuzer
    const { data: curYz } = await supabase.from('produto_yuzer_map').select('yuzer_produto_id').eq('bar_id', barId).eq('cod_interno', codInterno);
    const curYzSet = new Set((curYz || []).map((r: any) => Number(r.yuzer_produto_id)));
    const yzRemove = [...curYzSet].filter(p => !yzArr.includes(p));
    if (yzRemove.length) await supabase.from('produto_yuzer_map').delete().eq('bar_id', barId).eq('cod_interno', codInterno).in('yuzer_produto_id', yzRemove);
    for (const yid of yzArr) if (!curYzSet.has(yid)) await supabase.from('produto_yuzer_map').upsert({ bar_id: barId, cod_yuzer: String(yid), yuzer_produto_id: yid, nome: nomeProd, cod_interno: codInterno }, { onConflict: 'bar_id,cod_yuzer,cod_interno' });
    return NextResponse.json({ success: true });
  }

  // ----- CADASTRO MANUAL -----
  const nome = String(body.nome || '').trim();
  if (!nome) return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 });
  // gera o próximo código do prefixo da categoria (c=Comida, b=Bebida, d=Drink, o=Outros)
  let codigo = String(body.codigo || '').trim();
  const prefixo = ['b', 'c', 'd', 'o'].includes(String(body.prefixo)) ? String(body.prefixo) : null;
  if (!codigo && prefixo) {
    const { data: existts } = await supabase.from('produto_cardapio').select('codigo').eq('bar_id', barId).ilike('codigo', `${prefixo}%`);
    const maxn = (existts || []).reduce((m: number, r: any) => Math.max(m, Number(String(r.codigo).replace(/\D/g, '')) || 0), 0);
    codigo = `${prefixo}${String(maxn + 1).padStart(4, '0')}`;
  }
  if (!codigo) return NextResponse.json({ success: false, error: 'Código (ou categoria p/ gerar) obrigatório' }, { status: 400 });
  const { data, error } = await supabase.from('produto_cardapio').insert({
    bar_id: barId, codigo, nome,
    categoria: body.categoria ? String(body.categoria) : categoriaPorCodigo(codigo),
    ativo: body.ativo !== false, origem: 'manual',
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // de-paras opcionais informados na criação
  const codCh = String(body.cod_ch || '').trim();
  const codYuzer = String(body.cod_yuzer || '').trim();
  if (codCh && /^\d+$/.test(codCh)) await supabase.from('produto_contahub_map').upsert({ bar_id: barId, prd: Number(codCh), cod_interno: codigo }, { onConflict: 'bar_id,prd' });
  if (codYuzer && /^\d+$/.test(codYuzer)) await supabase.from('produto_yuzer_map').upsert({ bar_id: barId, cod_yuzer: codYuzer, yuzer_produto_id: Number(codYuzer), nome, cod_interno: codigo }, { onConflict: 'bar_id,cod_yuzer,cod_interno' });
  // copia a ficha de um modelo (outro produto) quando informado
  if (body.modelo_id && data?.id) {
    const { data: src } = await supabase.from('producao_ficha_item').select('*').eq('produto_id', Number(body.modelo_id));
    const novos = (src || []).map((it: any) => { const { id, created_at, updated_at, ...rest } = it; void id; void created_at; void updated_at; return { ...rest, produto_id: data.id, producao_id: null }; });
    if (novos.length) await supabase.from('producao_ficha_item').insert(novos);
  }
  return NextResponse.json({ success: true, produto: data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, PATHS, 'editar'); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const patch: any = { atualizado_em: new Date().toISOString() };
  for (const k of ['nome', 'categoria', 'ativo', 'codigo']) if (k in body) patch[k] = body[k];
  if ('agrupado_em' in body) patch.agrupado_em = String(body.agrupado_em || '').trim() || null;
  const { data, error } = await supabase.from('produto_cardapio').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, produto: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, PATHS, 'excluir'); if (nega) return nega;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  // limpa a ficha do produto antes (evita órfãos); o de-para (ContaHub/Yuzer) é mantido
  await supabase.from('producao_ficha_item').delete().eq('produto_id', id);
  const { error } = await supabase.from('produto_cardapio').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
