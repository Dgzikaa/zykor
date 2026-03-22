/**
 * API para verificar e executar sync do ContaHub manualmente
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const execute = searchParams.get('execute') === 'true';
    const date = searchParams.get('date'); // formato: YYYY-MM-DD

    // Data alvo (ontem por padrão)
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (execute) {
      // Chamar a Edge Function do Supabase
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contahub-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'sync',
            data_date: targetDate,
            bar_id: 3, // Ordinário Bar
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({
          success: false,
          error: `Erro ao executar sync: ${errorText}`,
          date: targetDate,
        }, { status: 500 });
      }

      const result = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Sync executado com sucesso',
        date: targetDate,
        result,
      });
    }

    // Apenas verificar (não executar)
    return NextResponse.json({
      success: true,
      message: 'Use ?execute=true para executar o sync',
      date: targetDate,
      info: {
        url_executar: `/api/contahub/check-cron?execute=true&date=${targetDate}`,
        cronjob_schedule: '0 7 * * *', // 07:00 BRT diariamente
        edge_function: 'contahub-sync',
      },
    });
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
