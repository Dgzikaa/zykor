import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).schema('crm').from('clientes_em_queda')
      .select('*').eq('bar_id', barId).limit(200);
    if (error) throw error;

    const clientes = data ?? [];
    const valorRiscoTotal = clientes.reduce((s: number, c: any) => s + Number(c.valor_anual_risco || 0), 0);
    const porNivel = { diamante: 0, ouro: 0, prata: 0 } as Record<string, number>;
    for (const c of clientes) porNivel[c.nivel] = (porNivel[c.nivel] ?? 0) + 1;

    return NextResponse.json({
      success: true,
      clientes,
      stats: {
        total: clientes.length,
        valor_risco_total: valorRiscoTotal,
        por_nivel: porNivel,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
