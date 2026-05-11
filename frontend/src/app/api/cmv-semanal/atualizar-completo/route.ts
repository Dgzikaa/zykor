import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cmv-semanal/atualizar-completo
 *
 * Fluxo completo de atualização de CMV para /ferramentas/cmv-semanal/tabela.
 * Etapas:
 *   Fase 1 (em paralelo): contaazul-sync + sync-cmv-sheets
 *     - contaazul-sync   — puxa lançamentos do Conta Azul (compras corrigidas)
 *     - sync-cmv-sheets  — puxa contagem, bonificações e CMV teórico da planilha
 *   Fase 2: cmv-semanal-auto — recalcula CMV com dados já atualizados
 *
 * Body: { bar_id: number, ano?: number }
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = body.bar_id;
    const ano = body.ano ?? new Date().getFullYear();

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    };

    const callFn = async (fn: string, payload: any) => {
      const r = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, json };
    };

    // Fase 1 — paralelo: Conta Azul + Sheets
    const [caz, sheets] = await Promise.all([
      callFn('contaazul-sync', { bar_id: barId, sync_mode: 'daily_incremental' }),
      callFn('sync-cmv-sheets', { bar_id: barId, todas_semanas: true, ano }),
    ]);

    if (!caz.ok) {
      return NextResponse.json(
        { success: false, etapa_falhou: 'contaazul', error: caz.json.error || 'Erro Conta Azul', sheets: sheets.json },
        { status: caz.status },
      );
    }
    if (!sheets.ok) {
      return NextResponse.json(
        { success: false, etapa_falhou: 'sync_sheets', error: sheets.json.error || 'Erro planilha', contaazul: caz.json },
        { status: sheets.status },
      );
    }

    // Fase 2 — recalcular CMV
    const recalc = await callFn('cmv-semanal-auto', { bar_id: barId, todas_semanas: true, ano });
    if (!recalc.ok) {
      return NextResponse.json(
        {
          success: false,
          etapa_falhou: 'recalcular',
          error: recalc.json.error || 'Erro recálculo',
          contaazul: caz.json,
          sync_sheets: sheets.json,
        },
        { status: recalc.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'CMV atualizado com sucesso',
      etapas: {
        contaazul: caz.json,
        sync_sheets: sheets.json,
        recalcular: recalc.json,
      },
    });
  } catch (error: any) {
    console.error('[atualizar-completo] erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 },
    );
  }
}
