import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ProcessingRequest {
  raw_data_id?: number
  process_all?: boolean
  bar_id?: number
}

interface ProcessingResult {
  success: boolean
  data_type: string
  raw_data_id: number
  total_records: number
  inserted_records: number
  processing_time_seconds: number
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body: ProcessingRequest = await request.json()

    // Se process_all=true, buscar todos os registros não processados
    if (body.process_all) {
      const { data: rawDataRecords, error } = await supabase
        .from('contahub_raw_data')
        .select('id, data_type, data_date, record_count')
        .eq('processed', false)
        .eq('bar_id', body.bar_id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ [API] Erro ao buscar dados brutos:', error)
        return NextResponse.json(
          { success: false, error: 'Erro ao buscar dados brutos' },
          { status: 500 }
        )
      }

      if (!rawDataRecords || rawDataRecords.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Nenhum dado bruto para processar',
          processed_count: 0,
          results: []
        })
      }

      // Processar em lotes de 100 registros
      const results: ProcessingResult[] = []
      let successCount = 0
      let errorCount = 0
      const batchSize = 100

      for (let i = 0; i < rawDataRecords.length; i += batchSize) {
        const batch = rawDataRecords.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(rawDataRecords.length / batchSize)

        // Processar lote em paralelo
        const batchPromises = batch.map(async (rawRecord) => {
          try {
            const result = await processRawData(rawRecord.id)
            
            if (result.success) {
              successCount++
            } else {
              errorCount++
              console.error(`❌ [API] Erro no registro ${rawRecord.id}: ${result.error}`)
            }
            
            return result
          } catch (error) {
            errorCount++
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error(`❌ [API] Erro ao processar ${rawRecord.id}:`, errorMessage)
            
            return {
              success: false,
              data_type: rawRecord.data_type,
              raw_data_id: rawRecord.id,
              total_records: 0,
              inserted_records: 0,
              processing_time_seconds: 0,
              error: errorMessage
            }
          }
        })

        // Aguardar conclusão do lote
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // Pequena pausa entre lotes para evitar sobrecarga
        if (i + batchSize < rawDataRecords.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processamento concluído: ${successCount} sucessos, ${errorCount} erros`,
        processed_count: rawDataRecords.length,
        success_count: successCount,
        error_count: errorCount,
        results
      })
    }

    // Processar um registro específico
    if (body.raw_data_id) {
      const result = await processRawData(body.raw_data_id)
      
      return NextResponse.json(result, {
        status: result.success ? 200 : 500
      })
    }

    return NextResponse.json(
      { success: false, error: 'raw_data_id ou process_all é obrigatório' },
      { status: 400 }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ [API] Erro no processamento:', errorMessage)
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const barId = searchParams.get('bar_id') || '3'

    // Buscar estatísticas dos dados brutos
    const { data: stats, error } = await supabase
      .from('contahub_raw_data')
      .select('data_type, processed, record_count')
      .eq('bar_id', barId)

    if (error) {
      console.error('❌ [API] Erro ao buscar estatísticas:', error)
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar estatísticas' },
        { status: 500 }
      )
    }

    // Agrupar estatísticas
    const summary = {
      total_records: stats?.length || 0,
      processed: stats?.filter(r => r.processed).length || 0,
      pending: stats?.filter(r => !r.processed).length || 0,
      by_type: {} as Record<string, { total: number, processed: number, pending: number, total_records: number }>
    }

    stats?.forEach(record => {
      const type = record.data_type
      if (!summary.by_type[type]) {
        summary.by_type[type] = { total: 0, processed: 0, pending: 0, total_records: 0 }
      }
      
      summary.by_type[type].total++
      summary.by_type[type].total_records += record.record_count || 0
      
      if (record.processed) {
        summary.by_type[type].processed++
      } else {
        summary.by_type[type].pending++
      }
    })

    return NextResponse.json({
      success: true,
      bar_id: barId,
      summary,
      raw_data: stats
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ [API] Erro ao buscar estatísticas:', errorMessage)
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Função auxiliar para chamar a Edge Function
async function processRawData(rawDataId: number): Promise<ProcessingResult> {
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/contahub-processor`
  
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ raw_data_id: rawDataId })
  })

  if (!response.ok) {
    throw new Error(`Edge Function retornou status ${response.status}`)
  }

  return await response.json()
}
