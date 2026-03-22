import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos de timeout

interface SyncRequest {
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  bar_id: number
}

interface DateResult {
  date: string
  bar_id: number
  success: boolean
  records_collected?: number
  records_processed?: number
  error?: string
}

/**
 * POST /api/contahub/sync-retroativo-real
 * Sincroniza dados retroativos do ContaHub chamando a Edge Function real
 * 
 * Body: {
 *   start_date: "2024-10-03",
 *   end_date: "2025-12-08",
 *   bar_id: 4
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json();
    
    // Validações
    if (!body.start_date || !body.end_date) {
      return NextResponse.json({
        success: false,
        error: 'start_date e end_date são obrigatórios'
      }, { status: 400 });
    }
    
    if (!body.bar_id) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório'
      }, { status: 400 });
    }

    const barId = body.bar_id;

    // Gerar lista de datas
    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);
    const dates: string[] = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const results: DateResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let totalRecordsCollected = 0;
    let totalRecordsProcessed = 0;

    // Processar cada data
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];

      try {
        // Usar nova função consolidada contahub-sync com action=sync
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contahub-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            action: 'sync',
            data_date: date,
            bar_id: barId
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        const recordsCollected = result.summary?.total_records_collected || 0;
        const recordsProcessed = result.summary?.total_records_processed || 0;

        results.push({
          date,
          bar_id: barId,
          success: true,
          records_collected: recordsCollected,
          records_processed: recordsProcessed
        });
        
        successCount++;
        totalRecordsCollected += recordsCollected;
        totalRecordsProcessed += recordsProcessed;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ ${date}: ${errorMessage}`);
        
        results.push({
          date,
          bar_id: barId,
          success: false,
          error: errorMessage
        });
        
        errorCount++;
      }

      // Pequena pausa para não sobrecarregar a API (100ms entre requisições)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: errorCount === 0,
      message: `Sincronização retroativa concluída: ${successCount} sucessos, ${errorCount} erros`,
      summary: {
        bar_id: barId,
        start_date: body.start_date,
        end_date: body.end_date,
        total_dates: dates.length,
        success_count: successCount,
        error_count: errorCount,
        total_records_collected: totalRecordsCollected,
        total_records_processed: totalRecordsProcessed
      },
      results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [SYNC RETROATIVO] Erro:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

/**
 * GET - Informações sobre o endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/contahub/sync-retroativo-real',
    description: 'Sincroniza dados retroativos do ContaHub usando a Edge Function real',
    method: 'POST',
    body: {
      start_date: 'YYYY-MM-DD (obrigatório)',
      end_date: 'YYYY-MM-DD (obrigatório)',
      bar_id: 'number (obrigatório) - 3 para Ordinário, 4 para Deboche'
    },
    example: {
      start_date: '2024-10-03',
      end_date: '2025-12-08',
      bar_id: 4
    },
    notes: [
      'Este endpoint pode demorar vários minutos dependendo do período',
      'Recomendado executar em períodos menores (ex: 1 mês por vez)',
      'Os dados são coletados da API do ContaHub e salvos nas tabelas do Supabase'
    ]
  });
}
