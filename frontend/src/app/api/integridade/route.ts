import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * GET /api/integridade?bar_id=3&status=aberto&dias=30
 *   lista alertas
 *
 * POST /api/integridade
 *   { acao: 'detectar', bar_id?, data? } - dispara detector
 *
 * PATCH /api/integridade
 *   { alerta_id, status, notas? } - equipe atualiza
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('bar_id');
    const status = searchParams.get('status') ?? 'aberto';
    const dias = parseInt(searchParams.get('dias') ?? '30', 10);

    const desde = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];

    const s = sb();
    let q = s.schema('integridade').from('alertas')
      .select('*')
      .gte('data_referencia', desde)
      .order('severidade', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(500);

    if (barId) q = q.eq('bar_id', parseInt(barId, 10));
    if (status !== 'todos') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ alertas: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.acao === 'detectar') {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/detector-fraude`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: body?.bar_id, data: body?.data, discord: body?.discord ?? false }),
      });
      const j = await r.json();
      return NextResponse.json(j, { status: r.ok ? 200 : 502 });
    }
    return NextResponse.json({ error: 'acao invalida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.alerta_id || !body?.status) {
      return NextResponse.json({ error: 'alerta_id+status obrigatorios' }, { status: 400 });
    }
    const s = sb();
    const { error } = await s.schema('integridade').from('alertas')
      .update({
        status: body.status, notas: body.notas ?? null,
        revisado_em: new Date().toISOString(),
        revisado_por: body.revisado_por ?? null,
      })
      .eq('id', body.alerta_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
