import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Variável global para armazenar o interval
let syncInterval: NodeJS.Timeout | null = null;

export async function POST(request: NextRequest) {
  try {
    const { action, intervalMinutes = 30 } = await request.json();

    if (action === 'start') {
      // Parar interval anterior se existir
      if (syncInterval) {
        clearInterval(syncInterval);
      }

      // Configurar novo interval
      syncInterval = setInterval(
        async () => {
          try {
            // Chamar endpoint de sincronização
            const response = await fetch(
              'http://localhost:3000/api/sync/getin-reservas',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );

            const result = await response.json();

            if (!result.success) {
              console.error(
                '❌ Erro na sincronização automática:',
                result.error
              );
            }
          } catch (error) {
            console.error(
              '❌ Erro ao executar sincronização automática:',
              error
            );
          }
        },
        intervalMinutes * 60 * 1000
      ); // Converter minutos para milliseconds

      return NextResponse.json({
        success: true,
        message: `Sincronização automática iniciada a cada ${intervalMinutes} minutos`,
        intervalMinutes,
      });
    } else if (action === 'stop') {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;

        return NextResponse.json({
          success: true,
          message: 'Sincronização automática parada',
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Nenhuma sincronização automática estava rodando',
        });
      }
    } else if (action === 'status') {
      return NextResponse.json({
        success: true,
        status: syncInterval ? 'running' : 'stopped',
        message: syncInterval
          ? 'Sincronização automática ativa'
          : 'Sincronização automática parada',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Ação inválida. Use: start, stop ou status',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ Erro no cron setup:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno: ' + (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    status: syncInterval ? 'running' : 'stopped',
    message: syncInterval
      ? 'Sincronização automática ativa'
      : 'Sincronização automática parada',
  });
}
