import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { recalcCmvTeorico } from '@/lib/cmv-recalc';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SHEET = '1klPn-uVLKeoJ9UA9TkiSYqa7sV7NdUdDEELdgd1q4b8';
const parseNumBR = (s: string): number => { const v = String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''); const n = Number(v); return Number.isFinite(n) ? n : 0; };
async function fetchSheet(range: string, key: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(range)}?key=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const j = await r.json();
  return (j.values as string[][]) || [];
}

/** Cadastro de produções (preparos internos). CRUD master. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .from('producao_base')
    .select('id,codigo,nome,unidade,rendimento,unidade_contagem,fator_contagem,secao,ativo,observacao,atualizado_em,controle_producao,curva_a,entra_contagem,decompor_contagem')
    .eq('bar_id', barId)
    .order('nome', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // contagem de itens + custo total (da ficha) por produção — sem .in() (URL grande trunca)
  const contagem: Record<number, number> = {};
  const custo: Record<number, number> = {};
  const temMestre: Record<number, boolean> = {};
  {
    const { data: itens } = await supabase.from('producao_ficha_item').select('producao_id, custo_planilha, is_mestre').not('producao_id', 'is', null);
    (itens || []).forEach((i: any) => {
      contagem[i.producao_id] = (contagem[i.producao_id] || 0) + 1;
      custo[i.producao_id] = (custo[i.producao_id] || 0) + Number(i.custo_planilha || 0);
      if (i.is_mestre) temMestre[i.producao_id] = true;
    });
  }
  return NextResponse.json({ success: true, producoes: (data || []).map((p) => ({ ...p, qtd_componentes: contagem[p.id] || 0, custo_total: custo[p.id] || 0, tem_mestre: !!temMestre[p.id] })) });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();

  // ----- IMPORTAR PREPAROS (planilha 'Lista - Preparos': A=cód, B=nome, C=rendimento) -----
  if (body.action === 'importar') {
    const { data: creds } = await (supabase as any)
      .from('api_credentials').select('configuracoes').eq('sistema', 'google_sheets').eq('bar_id', 3).limit(1);
    const key = creds?.[0]?.configuracoes?.api_key;
    if (!key) return NextResponse.json({ success: false, error: 'API key do Google Sheets não encontrada' }, { status: 500 });
    let rows: string[][];
    try { rows = await fetchSheet("'Lista - Preparos'!A5:F2000", key); }
    catch (e: any) { return NextResponse.json({ success: false, error: `Falha ao ler planilha: ${e?.message}` }, { status: 502 }); }
    const { data: existentes } = await supabase.from('producao_base').select('codigo').eq('bar_id', barId).not('codigo', 'is', null);
    const jaExiste = new Set((existentes || []).map((e: any) => e.codigo));
    // Deriva a unidade do rendimento (a planilha não tem coluna de unidade):
    // custo/un baixo (centavos) = peso/volume (g/ml); rend decimal pequeno = kg/L; rend=1 = un; "Molho/Bar"/nome líquido = ml/L
    const ehLiquido = (nome: string, cat: string) => /^(molho|bar)$/i.test(cat.trim()) || /molho|calda|caldo|base|bechamel|suco|xarope|leite|agua|água|creme|maionese|vinagre|redu|caramelo|espuma|infus|bisque|demi|chá|drink|coquetel|\bmel\b|\bcha\b/i.test(nome);
    const derivaUni = (rend: number | null, custo: number | null, nome: string, cat: string) => {
      const liq = ehLiquido(nome, cat);
      if (custo != null && custo < 0.5) return liq ? 'ml' : 'g';
      if (rend === 1) return 'un';
      if (rend != null && rend <= 5) return liq ? 'L' : 'kg';
      return 'un';
    };
    const novos: any[] = [];
    for (const row of rows) {
      const codigo = (row[0] || '').toString().trim();
      const nm = (row[1] || '').toString().trim();
      const rend = parseNumBR((row[2] || '').toString());
      const custo = parseNumBR((row[3] || '').toString());
      const cat = (row[5] || '').toString().trim();
      if (!codigo || !nm || !/^[a-z]/i.test(codigo)) continue;
      if (jaExiste.has(codigo)) continue;
      jaExiste.add(codigo);
      novos.push({ bar_id: barId, codigo, nome: nm, unidade: derivaUni(rend, custo, nm, cat), rendimento: rend || 1 });
    }
    if (novos.length) { const { error } = await supabase.from('producao_base').insert(novos); if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
    return NextResponse.json({ success: true, importados: novos.length });
  }

  const nome = String(body.nome || '').trim();
  if (!nome) return NextResponse.json({ success: false, error: 'Nome obrigatório' }, { status: 400 });

  // gera o próximo código do prefixo (pc=Cozinha, pd=Bar) quando não vier um código pronto
  let codigo: string | null = body.codigo ? String(body.codigo).trim() : null;
  const prefixo = body.prefixo === 'pd' ? 'pd' : body.prefixo === 'pc' ? 'pc' : null;
  if (!codigo && prefixo) {
    const { data: existts } = await supabase.from('producao_base').select('codigo').eq('bar_id', barId).ilike('codigo', `${prefixo}%`);
    const maxn = (existts || []).reduce((m: number, r: any) => Math.max(m, Number(String(r.codigo).replace(/\D/g, '')) || 0), 0);
    codigo = `${prefixo}${String(maxn + 1).padStart(4, '0')}`;
  }

  const payload = {
    bar_id: barId, nome, codigo,
    unidade: body.unidade ? String(body.unidade) : 'un',
    rendimento: body.rendimento != null ? Number(body.rendimento) : 1,
    secao: body.secao ? String(body.secao) : (prefixo === 'pd' ? 'Bar' : prefixo === 'pc' ? 'Cozinha' : null),
    observacao: body.observacao ? String(body.observacao) : null,
  };
  const { data, error } = await supabase.from('producao_base').insert(payload).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // copia a ficha de um modelo (outra produção) quando informado
  if (body.modelo_id && data?.id) {
    const { data: src } = await supabase.from('producao_ficha_item').select('*').eq('producao_id', Number(body.modelo_id));
    const novos = (src || []).map((it: any) => { const { id, created_at, updated_at, ...rest } = it; void id; void created_at; void updated_at; return { ...rest, producao_id: data.id, produto_id: null }; });
    if (novos.length) await supabase.from('producao_ficha_item').insert(novos);
  }
  return NextResponse.json({ success: true, producao: data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const patch: any = { atualizado_em: new Date().toISOString() };
  for (const k of ['nome', 'codigo', 'unidade', 'unidade_contagem', 'secao', 'observacao', 'ativo', 'controle_producao', 'curva_a', 'entra_contagem', 'decompor_contagem']) if (k in body) patch[k] = body[k];
  if ('rendimento' in body) patch.rendimento = Number(body.rendimento);
  // conversor de contagem: quanto da unidade-base (rendimento) cabe em 1 unidade de contagem (ex.: 0,4 kg/porção)
  if ('fator_contagem' in body) patch.fator_contagem = (body.fator_contagem == null || body.fator_contagem === '') ? null : Number(body.fator_contagem);
  const { data, error } = await supabase.from('producao_base').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // rendimento muda o custo da produção (e dos produtos que a usam) → recalcula o CMV teórico
  if ('rendimento' in body && data?.bar_id) await recalcCmvTeorico(supabase, data.bar_id);
  return NextResponse.json({ success: true, producao: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await supabase.from('producao_base').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
