import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🌅 Cron diário SGB iniciado');

    // Verificar se é uma requisição de cron válida
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Acesso negado - token inválido');
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
    console.log('📊 Etapa 1: Disparando orchestrator de sincronizações...');
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
      console.log('✅ Orchestrator diário disparado com sucesso');
    } else {
      const errorText = await orchestratorResponse.text();
      console.log('⚠️ Erro no orchestrator:', orchestratorResponse.status, errorText);
      resultados.orchestrator = { error: errorText, status: orchestratorResponse.status };
    }

    // 2. Disparar recálculo de desempenho (após sincronizações)
    console.log('📊 Etapa 2: Disparando recálculo de desempenho...');
    const desempenhoResponse = await fetch(
      `${supabaseUrl}/functions/v1/desempenho-semanal-auto`,
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
      console.log('✅ Recálculo de desempenho concluído');
    } else {
      const errorText = await desempenhoResponse.text();
      console.log('⚠️ Erro no recálculo de desempenho:', desempenhoResponse.status, errorText);
      resultados.desempenho = { error: errorText, status: desempenhoResponse.status };
    }

    console.log('🎉 Cron diário SGB concluído');

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
