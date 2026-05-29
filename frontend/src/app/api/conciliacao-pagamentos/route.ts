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
    const { data, error } = await (supabase as any).schema('gold').from('conciliacao_pagamentos_diaria')
      .select('*').eq('bar_id', barId).order('data_pagamento', { ascending: false }).limit(1000);
    if (error) throw error;

    const linhas = data ?? [];
    const anomalias = linhas.filter((l: any) => l.anomalia !== 'normal');
    return NextResponse.json({
      linhas,
      anomalias,
      stats: {
        total_dias: new Set(linhas.map((l: any) => l.data_pagamento)).size,
        anomalias_qtd: anomalias.length,
        queda_critica: anomalias.filter((a: any) => a.anomalia === 'queda_critica').length,
        queda_alta: anomalias.filter((a: any) => a.anomalia === 'queda_alta').length,
        picos: anomalias.filter((a: any) => a.anomalia === 'pico_anormal').length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
