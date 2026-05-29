import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/ai-relatorio?bar_id=N&tipo=semanal|insights_periodo
 *   → último relatório do tipo
 * POST /api/instagram/ai-relatorio?bar_id=N
 *   body { tipo, periodo_ini?, periodo_fim? }
 *   → dispara edge fn ig-ai-relatorio pra gerar novo
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const tipo = sp.get('tipo') ?? 'semanal';
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data } = await (supabase as any).schema('integrations').from('instagram_relatorios_ai')
      .select('*').eq('bar_id', barId).eq('tipo', tipo)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle();

    return NextResponse.json({ success: true, relatorio: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const r = await fetch(`${supabaseUrl}/functions/v1/ig-ai-relatorio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bar_id: barId, ...body }),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
