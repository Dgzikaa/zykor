import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agente/insights-v2/trigger
 * Dispara o pipeline v2 manualmente (detector + narrator)
 * 
 * Body:
 * - bar_id (obrigatório)
 * - data (opcional, formato YYYY-MM-DD, default = ontem)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, data } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🎭 [API] Disparando pipeline v2 para bar_id=${bar_id}, data=${data || 'ontem'}`);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agente-pipeline-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bar_id, data }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [API] Erro na Edge Function:', errorText);
      return NextResponse.json(
        { success: false, error: 'Erro ao executar pipeline v2', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log(`✅ [API] Pipeline v2 concluído: ${result.pipeline?.narrator?.insights_gerados || 0} insights gerados`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [API] Erro ao disparar pipeline v2:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao disparar pipeline' },
      { status: 500 }
    );
  }
}
