import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 180;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const tipo = sp.get('tipo');
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    let q = (supabase as any).schema('financial').from('contas_a_vencer')
      .select('*').eq('bar_id', barId).order('dias_pra_vencer');
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q.limit(500);
    if (error) throw error;

    const lista = data ?? [];
    const stats = {
      total_em_aberto: lista.reduce((s: number, l: any) => s + Number(l.valor_nao_pago || 0), 0),
      atrasados_qtd: lista.filter((l: any) => l.status_traduzido === 'ATRASADO').length,
      atrasados_valor: lista.filter((l: any) => l.status_traduzido === 'ATRASADO').reduce((s: number, l: any) => s + Number(l.valor_nao_pago || 0), 0),
      proximos_7d_qtd: lista.filter((l: any) => l.dias_pra_vencer >= 0 && l.dias_pra_vencer <= 7).length,
      proximos_7d_valor: lista.filter((l: any) => l.dias_pra_vencer >= 0 && l.dias_pra_vencer <= 7).reduce((s: number, l: any) => s + Number(l.valor_nao_pago || 0), 0),
    };
    return NextResponse.json({ contas: lista, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
