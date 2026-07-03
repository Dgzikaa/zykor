import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/financeiro/dfc/fora-depara?bar_id=3&ano=2026
 * TODAS as categorias do CA com movimento + grupo_dfc atual (null = não classificada).
 * Fonte: financial.get_dfc_categorias.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).schema('financial')
      .rpc('get_dfc_categorias', { p_bar_id: barId, p_ano: ano });
    if (error) throw error;

    return NextResponse.json({ categorias: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

const GRUPOS_DFC = ['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO', 'AJUSTE'];

/**
 * POST /api/financeiro/dfc/fora-depara
 * Classifica uma categoria do CA num grupo do DFC, COMO EXCEÇÃO DAQUELE BAR
 * (override por bar). Body: { bar_id, categoria, grupo_dfc }.
 */
export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, req); if (nega) return nega;
  try {
    const body = await req.json();
    const barId = Number(body.bar_id);
    const categoria = String(body.categoria || '').trim();
    const grupo = String(body.grupo_dfc || '').trim().toUpperCase();
    if (!barId || !categoria) return NextResponse.json({ error: 'bar_id e categoria obrigatorios' }, { status: 400 });
    if (!GRUPOS_DFC.includes(grupo)) return NextResponse.json({ error: 'grupo_dfc invalido' }, { status: 400 });

    const supabase = await getAdminClient();
    const { error } = await (supabase as any).schema('meta')
      .rpc('set_categoria_dfc', { p_bar_id: barId, p_categoria: categoria, p_grupo: grupo });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
