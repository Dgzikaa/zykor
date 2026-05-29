import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/crm/clube?bar_id=N&segmento=vip&nivel=ouro&limit=200
 *  → membros do Clube + agregados por nivel/segmento
 */
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const segmento = sp.get('segmento');
    const nivel = sp.get('nivel');
    const limit = Number(sp.get('limit') ?? 200);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();

    // Agregados por nivel e segmento
    const { data: stats } = await (supabase as any).schema('crm').from('clube_ordi_membros')
      .select('nivel, segmento, pontos_total, valor_total_consumo')
      .eq('bar_id', barId);

    const porNivel: Record<string, any> = {};
    const porSegmento: Record<string, any> = {};
    for (const r of stats ?? []) {
      const n = r.nivel;
      porNivel[n] = porNivel[n] || { qtd: 0, gasto_total: 0 };
      porNivel[n].qtd++;
      porNivel[n].gasto_total += Number(r.valor_total_consumo || 0);
      const s = r.segmento;
      porSegmento[s] = porSegmento[s] || { qtd: 0, gasto_total: 0 };
      porSegmento[s].qtd++;
      porSegmento[s].gasto_total += Number(r.valor_total_consumo || 0);
    }

    // Lista filtrada
    let q = (supabase as any).schema('crm').from('clube_ordi_membros').select('*').eq('bar_id', barId);
    if (segmento) q = q.eq('segmento', segmento);
    if (nivel) q = q.eq('nivel', nivel);
    const { data: membros } = await q.order('pontos_total', { ascending: false }).limit(limit);

    return NextResponse.json({
      success: true,
      total_membros: (stats ?? []).length,
      por_nivel: porNivel,
      por_segmento: porSegmento,
      membros: membros ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
