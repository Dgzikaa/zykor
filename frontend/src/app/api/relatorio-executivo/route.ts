import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/relatorio-executivo?bar_id=3&limit=8
 *   Lista relatórios já gerados.
 *
 * POST /api/relatorio-executivo
 *   body { bar_id?, semana_ini?, semana_fim? }
 *   Dispara geração de novo relatório (chama edge fn).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('bar_id');
    const limit = parseInt(searchParams.get('limit') ?? '12', 10);

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let q = sb.schema('gold').from('relatorios_executivos')
      .select('id, bar_id, tipo, periodo_ini, periodo_fim, resumo_executivo, dados_brutos, modelo_usado, tokens_input, tokens_output, criado_em')
      .order('periodo_fim', { ascending: false })
      .limit(limit);
    if (barId) q = q.eq('bar_id', parseInt(barId, 10));
    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ relatorios: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/relatorio-executivo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
