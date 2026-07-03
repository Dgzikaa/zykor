import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarSeNaoPode } from '@/lib/permissions/guard';
import { recalcCmvFromFichaParent } from '@/lib/cmv-recalc';

export const dynamic = 'force-dynamic';

/**
 * Uso de um insumo nas Fichas Técnicas.
 *  GET  ?insumo=<termo>  → lista as FTs (produtos + produções) que usam o insumo (busca por código ou nome).
 *  POST { de_codigo, para_codigo } → substitui o insumo em TODAS as FTs do bar de uma vez.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const termo = (sp.get('insumo') || '').trim();
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  if (termo.length < 2) return NextResponse.json({ success: true, insumos: [], usos: [] });

  const supabase = await getAdminClient();

  // 1) insumos que casam com o termo (por código exato ou nome parecido)
  const { data: cat } = await (supabase as any).schema('silver').from('insumo_catalogo')
    .select('codigo, nome').eq('bar_id', barId);
  const t = termo.toLowerCase();
  const matched = (cat || []).filter((c: any) =>
    c.codigo && ((c.codigo.toLowerCase() === t) || (c.nome || '').toLowerCase().includes(t)));
  const codes = Array.from(new Set(matched.map((c: any) => c.codigo)));
  if (codes.length === 0) return NextResponse.json({ success: true, insumos: [], usos: [] });
  const codesUpper = codes.map((c: any) => String(c).toUpperCase());

  // 2) linhas de ficha que usam esses códigos (case-insensitive)
  const { data: linhas } = await supabase.from('producao_ficha_item')
    .select('id, producao_id, produto_id, insumo_codigo, quantidade, unidade')
    .eq('componente_tipo', 'insumo');
  const usa = (linhas || []).filter((l: any) => l.insumo_codigo && codesUpper.includes(String(l.insumo_codigo).toUpperCase()));

  // 3) resolve nome/código do parent (produção ou produto), filtrando pelo bar
  const prodIds = Array.from(new Set(usa.filter((l: any) => l.producao_id).map((l: any) => l.producao_id)));
  const produtoIds = Array.from(new Set(usa.filter((l: any) => l.produto_id).map((l: any) => l.produto_id)));
  const prodMap = new Map<number, any>();
  const produtoMap = new Map<number, any>();
  if (prodIds.length) {
    const { data } = await supabase.from('producao_base').select('id, codigo, nome, bar_id').in('id', prodIds);
    (data || []).forEach((r: any) => { if (r.bar_id === barId) prodMap.set(r.id, r); });
  }
  if (produtoIds.length) {
    const { data } = await supabase.from('produto_cardapio').select('id, codigo, nome, bar_id').in('id', produtoIds);
    (data || []).forEach((r: any) => { if (r.bar_id === barId) produtoMap.set(r.id, r); });
  }

  const usos = usa.map((l: any) => {
    const p = l.producao_id ? prodMap.get(l.producao_id) : produtoMap.get(l.produto_id);
    if (!p) return null; // parent de outro bar
    return {
      ficha_id: l.id,
      tipo: l.producao_id ? 'producao' : 'produto',
      insumo_codigo: l.insumo_codigo,
      parent_codigo: p.codigo,
      parent_nome: p.nome,
      quantidade: l.quantidade,
      unidade: l.unidade,
    };
  }).filter(Boolean).sort((a: any, b: any) => (a.parent_nome || '').localeCompare(b.parent_nome || ''));

  const insumos = matched.map((c: any) => ({ codigo: c.codigo, nome: c.nome }));
  return NextResponse.json({ success: true, insumos, usos, total: usos.length });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, ['/operacional/fichas-tecnicas'], 'editar'); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  const de = String(body.de_codigo || '').trim();
  const para = String(body.para_codigo || '').trim();
  if (!barId || !de || !para) return NextResponse.json({ success: false, error: 'bar_id, de_codigo e para_codigo obrigatórios' }, { status: 400 });
  if (de.toUpperCase() === para.toUpperCase()) return NextResponse.json({ success: false, error: 'insumo de origem e destino são iguais' }, { status: 400 });

  const supabase = await getAdminClient();

  // nome canônico do insumo destino (pra atualizar nome_componente)
  const { data: destino } = await (supabase as any).schema('silver').from('insumo_catalogo')
    .select('codigo, nome').eq('bar_id', barId).ilike('codigo', para).maybeSingle();
  if (!destino) return NextResponse.json({ success: false, error: `insumo destino ${para} não encontrado no bar` }, { status: 400 });

  // fichas do bar (produções + produtos) — pra escopar a troca ao bar
  const [{ data: prods }, { data: produtos }] = await Promise.all([
    supabase.from('producao_base').select('id').eq('bar_id', barId),
    supabase.from('produto_cardapio').select('id').eq('bar_id', barId),
  ]);
  const prodIds = (prods || []).map((r: any) => r.id);
  const produtoIds = (produtos || []).map((r: any) => r.id);

  // linhas alvo: insumo=de, no bar (producao_id ou produto_id do bar)
  const { data: linhas } = await supabase.from('producao_ficha_item')
    .select('id, producao_id, produto_id, insumo_codigo')
    .eq('componente_tipo', 'insumo');
  const alvo = (linhas || []).filter((l: any) =>
    l.insumo_codigo && l.insumo_codigo.toUpperCase() === de.toUpperCase() &&
    ((l.producao_id && prodIds.includes(l.producao_id)) || (l.produto_id && produtoIds.includes(l.produto_id))));

  if (alvo.length === 0) return NextResponse.json({ success: true, afetadas: 0 });

  const ids = alvo.map((l: any) => l.id);
  const { error } = await supabase.from('producao_ficha_item')
    .update({ insumo_codigo: destino.codigo, nome_componente: destino.nome, insumo_id_vmarket: null })
    .in('id', ids);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // recalcula CMV dos parents afetados (dedupe)
  const parents = new Map<string, { producao_id: number | null; produto_id: number | null }>();
  for (const l of alvo) {
    const k = l.producao_id ? `pc${l.producao_id}` : `pd${l.produto_id}`;
    parents.set(k, { producao_id: l.producao_id ?? null, produto_id: l.produto_id ?? null });
  }
  for (const p of parents.values()) {
    try { await recalcCmvFromFichaParent(supabase, p); } catch { /* segue */ }
  }

  return NextResponse.json({ success: true, afetadas: alvo.length });
}
