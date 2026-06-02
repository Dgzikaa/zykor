import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/noshow/lista?bar_id=N&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Lista TODOS os no-shows do período (reserva a reserva), não só reincidentes.
 * Fonte: bronze.bronze_getin_reservations (status='no-show').
 * Enriquece com `compareceu`/`valor_dia`: cruza o telefone normalizado da reserva
 * com silver.cliente_visitas na MESMA data — flag de provável erro de operação
 * (reserva marcada como no-show mas o cliente consumiu no bar naquele dia).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const inicio = sp.get('inicio');
    const fim = sp.get('fim');
    if (!barId || !inicio || !fim) {
      return NextResponse.json({ error: 'bar_id, inicio e fim são obrigatórios' }, { status: 400 });
    }

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('noshow_lista_com_presenca', {
      p_bar_id: barId,
      p_inicio: inicio,
      p_fim: fim,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const noshows = data ?? [];
    const pessoas = noshows.reduce((s: number, r: { people: number | null }) => s + Number(r.people || 0), 0);
    const compareceram = noshows.filter((r: { compareceu?: boolean }) => r.compareceu).length;
    return NextResponse.json({ success: true, total: noshows.length, pessoas, compareceram, noshows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message }, { status: 500 });
  }
}
