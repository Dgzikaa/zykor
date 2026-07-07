import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/middleware/auth';

/**
 * POST /api/cmv-semanal/atualizar-completo
 *
 * Atualização do CMV para /ferramentas/cmv-semanal/tabela (semanal + mensal).
 *   1. sync-cmv-sheets   — puxa contagem, bonificações e CMV teórico da planilha (semanal)
 *   2. cmv-semanal-auto  — recalcula CMV semanal com dados frescos
 *   3. sync-cmv-mensal   — puxa estoque/consumos da planilha (mensal)
 *   4. agregar_cmv_mensal_auto — re-agrega o mensal (compras do ContaAzul + estoque da planilha)
 *
 * Para sync do Conta Azul, usar o botão global em BarSelector
 * (/api/contaazul/sync-manual) — é independente desta tela.
 *
 * Body: { bar_id: number, ano?: number }
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  await authenticateUser(request);
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

    // Etapa 1 — sincronizar planilha Google Sheets
    const sheets = await callFn('sync-cmv-sheets', { bar_id: barId, todas_semanas: true, ano });
    if (!sheets.ok) {
      return NextResponse.json(
        { success: false, etapa_falhou: 'sync_sheets', error: sheets.json.error || 'Erro planilha' },
        { status: sheets.status },
      );
    }

    // Etapa 2 — recalcular CMV
    const recalc = await callFn('cmv-semanal-auto', { bar_id: barId, todas_semanas: true, ano });
    if (!recalc.ok) {
      return NextResponse.json(
        {
          success: false,
          etapa_falhou: 'recalcular',
          error: recalc.json.error || 'Erro recálculo',
          sync_sheets: sheets.json,
        },
        { status: recalc.status },
      );
    }

    // Etapa 3 — sincronizar o CMV Mensal a partir da planilha. A própria edge function
    // sync-cmv-mensal já chama o agregador (agregar_cmv_mensal_auto) por mês após o upsert,
    // tudo dentro da function — então não há loop de RPC aqui (evita o statement_timeout de
    // 8s do PostgREST). Não aborta o fluxo se falhar: o mensal é complementar ao semanal.
    const sheetsMensal = await callFn('sync-cmv-mensal', { bar_id: barId, ano });

    return NextResponse.json({
      success: true,
      message: 'CMV atualizado com sucesso (semanal + mensal)',
      etapas: {
        sync_sheets: sheets.json,
        recalcular: recalc.json,
        sync_mensal: { ok: sheetsMensal.ok, ...sheetsMensal.json },
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
