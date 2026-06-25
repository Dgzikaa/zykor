import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

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
  const { data, error } = await supabase
    .from('produto_cardapio')
    .select('id,codigo,nome,categoria,ativo,origem,atualizado_em')
    .eq('bar_id', barId).order('codigo', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // contagem de itens da ficha (finalização) por produto
  const ids = (data || []).map((p: any) => p.id);
  const contagem: Record<number, number> = {};
  if (ids.length) {
    const { data: itens } = await supabase.from('producao_ficha_item').select('produto_id').in('produto_id', ids);
    (itens || []).forEach((i: any) => { if (i.produto_id) contagem[i.produto_id] = (contagem[i.produto_id] || 0) + 1; });
  }

  // cód ContaHub (prd) por cod_interno — um produto pode ter vários (HH/PP/variações)
  const chMap: Record<string, number[]> = {};
  const { data: chRows } = await supabase.from('produto_contahub_map').select('prd, cod_interno').eq('bar_id', barId);
  (chRows || []).forEach((r: any) => { if (r.cod_interno) (chMap[r.cod_interno] ??= []).push(r.prd); });

  // cód Yuzer por cod_interno
  const yzMap: Record<string, string[]> = {};
  const { data: yzRows } = await supabase.from('produto_yuzer_map').select('cod_yuzer, cod_interno').eq('bar_id', barId);
  (yzRows || []).forEach((r: any) => { if (r.cod_interno) (yzMap[r.cod_interno] ??= []).push(r.cod_yuzer); });

  return NextResponse.json({
    success: true,
    produtos: (data || []).map((p: any) => ({ ...p, qtd_componentes: contagem[p.id] || 0, cods_ch: chMap[p.codigo] || [], cods_yuzer: yzMap[p.codigo] || [] })),
  });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();

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

  // ----- CADASTRO MANUAL -----
  const codigo = String(body.codigo || '').trim();
  const nome = String(body.nome || '').trim();
  if (!codigo || !nome) return NextResponse.json({ success: false, error: 'Código e nome obrigatórios' }, { status: 400 });
  const { data, error } = await supabase.from('produto_cardapio').insert({
    bar_id: barId, codigo, nome,
    categoria: body.categoria ? String(body.categoria) : categoriaPorCodigo(codigo),
    ativo: body.ativo !== false, origem: 'manual',
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, produto: data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const patch: any = { atualizado_em: new Date().toISOString() };
  for (const k of ['nome', 'categoria', 'ativo', 'codigo']) if (k in body) patch[k] = body[k];
  const { data, error } = await supabase.from('produto_cardapio').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, produto: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await supabase.from('produto_cardapio').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
