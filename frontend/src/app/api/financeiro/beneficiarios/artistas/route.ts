import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/artistas?q=texto
 * Lista de artistas/atrações do bar com KPIs agregados (gold.artistas_resumo).
 * Tudo derivado de operations.eventos_base (campo artista).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const q = (new URL(request.url).searchParams.get('q') || '').trim() || null;
  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold').rpc('artistas_resumo', { p_bar_id: user.bar_id, p_q: q });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const artistas = (data || []).map((r: any) => ({
    key: r.artista_key,
    nome: r.artista_label,
    genero: r.genero,
    shows_total: Number(r.shows_total),
    shows_feitos: Number(r.shows_feitos),
    shows_previstos: Number(r.shows_previstos),
    custo_total: Number(r.custo_total) || 0,
    custo_medio: Number(r.custo_medio) || 0,
    fat_total: Number(r.fat_total) || 0,
    fat_medio: Number(r.fat_medio) || 0,
    publico_total: Number(r.publico_total) || 0,
    publico_medio: Number(r.publico_medio) || 0,
    ticket_medio: Number(r.ticket_medio) || 0,
    custo_pct_fat: Number(r.custo_pct_fat) || 0,
    primeira: r.primeira,
    ultima: r.ultima,
    proximo: r.proximo,
  }));

  return NextResponse.json({ success: true, artistas, total: artistas.length });
}
