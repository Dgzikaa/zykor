import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verificar se é uma requisição de cron válida
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('URL do Supabase não configurada');
    }

    const resultados: any = {
      orchestrator: null,
      desempenho: null,
    };

    // 1. Disparar o orchestrator final que vai iniciar o ciclo de 15 minutos
    const orchestratorResponse = await fetch(
      `${supabaseUrl}/functions/v1/sgb-orchestrator-final`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_source: 'daily_cron',
          start_cycle: true,
          timestamp: new Date().toISOString(),
        }),
      }
    );

    if (orchestratorResponse.ok) {
      resultados.orchestrator = await orchestratorResponse.json();
    } else {
      const errorText = await orchestratorResponse.text();
      resultados.orchestrator = { error: errorText, status: orchestratorResponse.status };
    }

    // 2. Disparar recálculo de desempenho (após sincronizações)
    const desempenhoResponse = await fetch(
      `${supabaseUrl}/functions/v1/recalcular-desempenho-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_source: 'daily_cron_recalculo',
          timestamp: new Date().toISOString(),
        }),
      }
    );

    if (desempenhoResponse.ok) {
      resultados.desempenho = await desempenhoResponse.json();
    } else {
      const errorText = await desempenhoResponse.text();
      resultados.desempenho = { error: errorText, status: desempenhoResponse.status };
    }

    return NextResponse.json({
      success: true,
      message: 'Cron diário executado: sincronizações + recálculo de desempenho',
      resultados,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Erro no cron diário:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
