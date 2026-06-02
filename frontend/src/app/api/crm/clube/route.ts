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

    // Agregados calculados NO BANCO (GROUP BY sobre todos os membros). Antes era
    // agregado no Node sobre um SELECT sem limite -> PostgREST cortava em 1.000 de
    // ~110k membros, zerando níveis altos ("0 consumido") e truncando o total.
    const { data: resumo } = await (supabase as any)
      .schema('crm')
      .rpc('clube_resumo', { p_bar_id: barId });

    // Lista filtrada (top N por pontos — intencionalmente limitada)
    let q = (supabase as any).schema('crm').from('clube_ordi_membros').select('*').eq('bar_id', barId);
    if (segmento) q = q.eq('segmento', segmento);
    if (nivel) q = q.eq('nivel', nivel);
    const { data: membros } = await q.order('pontos_total', { ascending: false }).limit(limit);

    return NextResponse.json({
      success: true,
      total_membros: resumo?.total_membros ?? 0,
      por_nivel: resumo?.por_nivel ?? {},
      por_segmento: resumo?.por_segmento ?? {},
      membros: membros ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
