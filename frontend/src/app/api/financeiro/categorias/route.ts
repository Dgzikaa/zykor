import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Macros da DRE oferecidas no dropdown (ordem = posição na DRE). 'IGNORAR' = não entra.
const MACROS_DRE = [
  'Receita', 'Custos Variáveis', 'Custo insumos (CMV)', 'Mão-de-Obra',
  'Despesas Comerciais', 'Despesas Administrativas', 'Despesas Operacionais',
  'Despesas de Ocupação (Contas)', 'Não Operacionais', 'Investimentos', 'Dividendos',
  'IGNORAR',
];

/**
 * GET /api/financeiro/categorias?bar_id=3&ano=2026
 * Árvore de categorias do CA (agrupadas por pai) + mapeamento de grupo + macro atual.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).schema('meta')
      .rpc('get_categorias_arvore', { p_bar: barId, p_ano: ano });
    if (error) throw error;

    return NextResponse.json({ categorias: data ?? [], macros: MACROS_DRE });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

/**
 * POST /api/financeiro/categorias
 * Salva o grupo-pai (nome + macro da DRE) e expande pros filhos (herança).
 * Body: { bar_id, categoria_pai_id, nome_grupo, dre_macro }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const barId = Number(body.bar_id);
    const pai = String(body.categoria_pai_id || '').trim();
    const nome = String(body.nome_grupo || '').trim();
    const macro = String(body.dre_macro || '').trim();
    if (!barId || !pai) return NextResponse.json({ error: 'bar_id e categoria_pai_id obrigatorios' }, { status: 400 });
    if (macro && !MACROS_DRE.includes(macro)) return NextResponse.json({ error: 'dre_macro invalido' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).schema('meta')
      .rpc('set_categoria_grupo', { p_bar: barId, p_pai: pai, p_nome: nome, p_macro: macro });
    if (error) throw error;

    return NextResponse.json({ ok: true, aplicados: data ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
