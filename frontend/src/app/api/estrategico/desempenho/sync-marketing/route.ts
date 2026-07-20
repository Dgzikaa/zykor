import { NextRequest, NextResponse } from 'next/server';
import { syncMarketingTodos, syncMarketingSemana } from '@/lib/receitas/marketing-semanal-sync';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Sincroniza meta.marketing_semanal [O] Orgânico + [M] Mídia automaticamente.
 *
 * GET  → cron diário (semana atual + anterior, todos os bares). Preserva stories manuais.
 * POST → autenticado; aceita { bar_id, ano, semana } para reprocessar uma semana específica
 *        (backfill), ou sem corpo faz o mesmo que o GET.
 */
export async function GET() {
  try {
    const resultados = await syncMarketingTodos();
    return NextResponse.json({ success: true, resultados, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error('[sync-marketing] erro:', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'erro' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const ano = Number(body?.ano);
    const semana = Number(body?.semana);

    // Backfill pontual: bar + semana específicos
    if (barId && ano && semana) {
      const r = await syncMarketingSemana(barId, ano, semana);
      return NextResponse.json({ success: true, resultado: r, timestamp: new Date().toISOString() });
    }

    const resultados = await syncMarketingTodos();
    return NextResponse.json({ success: true, resultados, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error('[sync-marketing] erro:', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'erro' }, { status: 500 });
  }
}
