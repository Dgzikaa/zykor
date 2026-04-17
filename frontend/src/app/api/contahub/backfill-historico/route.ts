import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

interface BackfillRequest {
  bar_id: number;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  batch_size?: number; // Quantos dias processar por vez (padrão: 7)
}

export async function POST(request: NextRequest) {
  try {
    const body: BackfillRequest = await request.json();
    const { bar_id, data_inicio, data_fim, batch_size = 7 } = body;

    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json(
        { success: false, error: 'bar_id, data_inicio e data_fim são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 Iniciando backfill histórico: ${data_inicio} a ${data_fim} para bar_id=${bar_id}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    // Calcular total de dias
    const startDate = new Date(data_inicio);
    const endDate = new Date(data_fim);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    console.log(`📊 Total de dias para processar: ${totalDays}`);

    // Processar em lotes
    const results = {
      total_dias: totalDays,
      dias_processados: 0,
      dias_erro: 0,
      batches: [] as any[]
    };

    let currentDate = new Date(startDate);
    let batchNumber = 0;

    while (currentDate <= endDate) {
      batchNumber++;
      const batchDates: string[] = [];
      
      // Coletar datas do lote
      for (let i = 0; i < batch_size && currentDate <= endDate; i++) {
        batchDates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`\n📦 Lote ${batchNumber}: ${batchDates[0]} a ${batchDates[batchDates.length - 1]}`);

      const batchResult = {
        batch_number: batchNumber,
        data_inicio: batchDates[0],
        data_fim: batchDates[batchDates.length - 1],
        dias: batchDates.length,
        sucesso: 0,
        erro: 0,
        detalhes: [] as any[]
      };

      // Processar cada dia do lote
      for (const dataDate of batchDates) {
        try {
          console.log(`📅 Sincronizando ${dataDate}...`);

          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/contahub-sync-automatico`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              bar_id: bar_id,
              data_date: dataDate
            })
          });

          if (!syncResponse.ok) {
            const errorText = await syncResponse.text();
            throw new Error(`Erro na sincronização: ${syncResponse.status} - ${errorText}`);
          }

          const syncResult = await syncResponse.json();
          
          batchResult.sucesso++;
          results.dias_processados++;
          
          batchResult.detalhes.push({
            data: dataDate,
            status: 'sucesso',
            registros: syncResult.summary?.total_records_collected || 0
          });

          console.log(`✅ ${dataDate}: ${syncResult.summary?.total_records_collected || 0} registros`);

          // Pequeno delay entre datas
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Erro em ${dataDate}:`, error);
          batchResult.erro++;
          results.dias_erro++;
          
          batchResult.detalhes.push({
            data: dataDate,
            status: 'erro',
            erro: error instanceof Error ? error.message : String(error)
          });
        }
      }

      results.batches.push(batchResult);

      console.log(`✅ Lote ${batchNumber} concluído: ${batchResult.sucesso}/${batchResult.dias} dias`);

      // Delay entre lotes
      if (currentDate <= endDate) {
        console.log('⏳ Aguardando 5 segundos antes do próximo lote...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`\n📊 BACKFILL CONCLUÍDO: ${results.dias_processados}/${results.total_dias} dias processados`);

    return NextResponse.json({
      success: true,
      message: `Backfill concluído: ${results.dias_processados}/${results.total_dias} dias`,
      summary: {
        periodo: `${data_inicio} a ${data_fim}`,
        total_dias: results.total_dias,
        dias_processados: results.dias_processados,
        dias_erro: results.dias_erro,
        total_batches: batchNumber
      },
      batches: results.batches
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro no backfill histórico:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    // Importar createClient
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar quantos dias já foram sincronizados desde 01/01/2026
    const { data: syncedDates, error } = await supabase
      .schema('bronze')
      .from('bronze_contahub_raw_data')
      .select('data_date')
      .eq('bar_id', barId)
      .gte('data_date', '2026-01-01')
      .order('data_date', { ascending: false });

    if (error) {
      throw error;
    }

    const uniqueDates = [...new Set(syncedDates?.map(r => r.data_date) || [])];
    const totalDaysInPeriod = Math.ceil(
      (new Date().getTime() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json({
      success: true,
      bar_id: barId,
      periodo: '2026-01-01 até hoje',
      total_dias_periodo: totalDaysInPeriod,
      dias_sincronizados: uniqueDates.length,
      cobertura_percentual: Math.round((uniqueDates.length / totalDaysInPeriod) * 100),
      primeira_data: uniqueDates[uniqueDates.length - 1],
      ultima_data: uniqueDates[0]
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
