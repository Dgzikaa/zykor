import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/previsao?bar_id=N → próximos 14 dias
 * POST → dispara recalc via edge fn
 */
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const hoje = new Date().toISOString().split('T')[0];
    const supabase = await getAdminClient();
    const { data } = await (supabase as any).schema('gold').from('demanda_previsoes')
      .select('*').eq('bar_id', barId).gte('data_evento', hoje)
      .order('data_evento', { ascending: true });

    return NextResponse.json({ success: true, previsoes: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const r = await fetch(`${supabaseUrl}/functions/v1/prever-demanda`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(barId ? { bar_id: barId } : {}),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
