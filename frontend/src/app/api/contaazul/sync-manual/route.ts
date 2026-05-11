import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/contaazul/sync-manual
 *
 * Dispara sync incremental do Conta Azul para um bar e retorna resumo:
 * quantos lançamentos, categorias, centros de custo, pessoas e contas
 * financeiras foram sincronizados, mais a duração.
 *
 * Body: { bar_id: number, sync_mode?: 'daily_incremental' | 'full_month' | 'full_sync' }
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = Number(body.bar_id);
    const syncMode = body.sync_mode || 'daily_incremental';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }

    const resp = await fetch(`${supabaseUrl}/functions/v1/contaazul-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ bar_id: barId, sync_mode: syncMode }),
    });

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok || !result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro no sync Conta Azul' },
        { status: resp.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      bar_id: result.bar_id,
      sync_mode: result.sync_mode,
      period: result.period,
      stats: result.stats,
      duration_seconds: result.duration_seconds,
    });
  } catch (error: any) {
    console.error('[contaazul/sync-manual] erro:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno' },
      { status: 500 },
    );
  }
}
