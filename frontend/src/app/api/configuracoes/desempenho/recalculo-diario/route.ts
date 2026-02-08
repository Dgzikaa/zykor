import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API de Recálculo Diário de Desempenho
 * 
 * Esta API deve ser chamada diariamente após as sincronizações de dados (~08h)
 * para atualizar os indicadores de desempenho com os dados mais recentes.
 * 
 * Recalcula a semana atual e a anterior para garantir dados atualizados.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Recálculo diário de desempenho iniciado');

    // Verificar se é uma requisição de cron válida (opcional para chamadas manuais)
    const authHeader = request.headers.get('authorization');
    const isCronCall = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isCronCall) {
      console.log('⚠️ Chamada manual (sem CRON_SECRET)');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('URL do Supabase não configurada');
    }

    console.log('🚀 Disparando Edge Function de recálculo de desempenho...');

    // Chamar a Edge Function de automação semanal (que agora pode ser usada diariamente)
    const response = await fetch(
      `${supabaseUrl}/functions/v1/desempenho-semanal-auto`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_source: 'recalculo_diario',
          timestamp: new Date().toISOString(),
        }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Recálculo diário concluído com sucesso:', result);

      return NextResponse.json({
        success: true,
        message: 'Recálculo diário de desempenho concluído',
        result,
        timestamp: new Date().toISOString(),
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Erro no recálculo diário:', response.status, errorText);

      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date().toISOString(),
        },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('❌ Erro no recálculo diário:', error);
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

export async function POST(request: NextRequest) {
  return GET(request);
}
