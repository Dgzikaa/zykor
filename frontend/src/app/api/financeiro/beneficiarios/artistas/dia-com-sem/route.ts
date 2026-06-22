import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/artistas/dia-com-sem
 * Faturamento médio dos dias COM atração vs SEM atração (geral + por dia da semana).
 * CAVEAT: "sem" = evento sem campo artista preenchido; nem sempre é literalmente "sem show".
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold').rpc('dia_com_sem_atracao', { p_bar_id: user.bar_id });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = (data || []).map((r: any) => ({
    segmento: r.segmento as 'com' | 'sem',
    dia_semana: r.dia_semana === null ? null : Number(r.dia_semana),
    dia_label: r.dia_label,
    qtd_dias: Number(r.qtd_dias) || 0,
    fat_medio: Number(r.fat_medio) || 0,
    publico_medio: Number(r.publico_medio) || 0,
    ticket_medio: Number(r.ticket_medio) || 0,
    custo_art_medio: Number(r.custo_art_medio) || 0,
  }));

  return NextResponse.json({ success: true, linhas });
}
