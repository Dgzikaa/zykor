import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 30);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('garcom_performance', { p_bar_id: barId, p_dias: dias });
    if (error) throw error;

    const garcons = data ?? [];
    const totalFat = garcons.reduce((s: number, g: any) => s + Number(g.faturamento || 0), 0);
    const totalComandas = garcons.reduce((s: number, g: any) => s + Number(g.qtd_comandas || 0), 0);

    return NextResponse.json({
      success: true,
      garcons,
      stats: {
        qtd_garcons: garcons.length,
        fat_total: totalFat,
        comandas_total: totalComandas,
        ticket_medio_geral: totalComandas > 0 ? totalFat / totalComandas : 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
