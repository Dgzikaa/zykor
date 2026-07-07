import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * GET /api/fluxo-caixa?bar_id=3
 *   retorna ultima projecao (3 cenarios, 90d)
 *
 * POST { acao: 'gerar', bar_id? }
 *   dispara recalculo
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('bar_id');

    const s = sb();
    let q = s.schema('financial').from('fluxo_caixa_previsto')
      .select('*')
      .order('data_referencia');
    if (barId) q = q.eq('bar_id', parseInt(barId, 10));
    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ fluxo: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fluxo-caixa-90d`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
