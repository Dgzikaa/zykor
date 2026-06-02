import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/noshow/lista?bar_id=N&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Lista TODOS os no-shows do período (reserva a reserva), não só reincidentes.
 * Fonte: bronze.bronze_getin_reservations (status='no-show').
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
    const { data, error } = await (supabase as any)
      .schema('bronze')
      .from('bronze_getin_reservations')
      .select('reservation_date, reservation_time, customer_name, customer_phone, customer_email, people, status')
      .eq('bar_id', barId)
      .eq('status', 'no-show')
      .gte('reservation_date', inicio)
      .lte('reservation_date', fim)
      .order('reservation_date', { ascending: false })
      .order('reservation_time', { ascending: true })
      .limit(5000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const noshows = data ?? [];
    const pessoas = noshows.reduce((s: number, r: { people: number | null }) => s + Number(r.people || 0), 0);
    return NextResponse.json({ success: true, total: noshows.length, pessoas, noshows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message }, { status: 500 });
  }
}
