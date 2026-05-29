import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/qualidade?bar_id=N&semanas=12
 *
 * Retorna Quality Scorecard (gold.quality_scorecard) das últimas N semanas
 * + componentes individuais pra drilldown.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 120;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const semanas = Number(sp.get('semanas') ?? 12);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data } = await (supabase as any)
      .schema('gold')
      .from('quality_scorecard')
      .select('*')
      .eq('bar_id', barId)
      .order('ano', { ascending: false })
      .order('numero_semana', { ascending: false })
      .limit(semanas);

    const linhas = (data ?? []).reverse();
    const atual = linhas[linhas.length - 1];
    const anterior = linhas[linhas.length - 2];

    // Variação WoW
    const variacao = atual && anterior
      ? Number(atual.score) - Number(anterior.score)
      : 0;

    // Média do período
    const scores = linhas.map((l: any) => Number(l.score)).filter((s: number) => !isNaN(s));
    const media = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

    return NextResponse.json({
      success: true,
      atual,
      anterior,
      variacao,
      media_periodo: Math.round(media * 10) / 10,
      historico: linhas,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
