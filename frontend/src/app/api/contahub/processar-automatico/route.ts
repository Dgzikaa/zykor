import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// SEM FALLBACK: Se banco não retornar, retornar erro
async function getBaresAtivos(supabase: any): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('bares')
    .select('id')
    .eq('ativo', true)
    .order('id')
  
  if (error || !data || data.length === 0) {
    console.error('❌ [ERRO CONFIG] Nenhum bar ativo encontrado na tabela bares.')
    return null
  }
  
  return (data as { id: number }[]).map(b => b.id)
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results = {
      bars_processed: [] as any[],
      total_success: 0,
      total_errors: 0,
      total_records: 0
    }
    
    // Buscar bares ativos do banco - erro se não configurado
    const barIds = await getBaresAtivos(supabase)
    if (!barIds) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuração ausente: nenhum bar ativo encontrado na tabela bares.',
          processing_time_seconds: (Date.now() - startTime) / 1000
        },
        { status: 500 }
      )
    }
    
    for (const barId of barIds) {
      const { data: pendingData, error: fetchError } = await supabase
        .from('contahub_raw_data')
        .select('id, data_type, data_date, bar_id')
        .eq('processed', false)
        .eq('bar_id', barId)
        .order('created_at', { ascending: true })
        .limit(50)
      
      if (fetchError) {
        console.error(`❌ [CRON] Erro ao buscar dados pendentes para bar ${barId}:`, fetchError.message)
        continue
      }
      
      if (!pendingData || pendingData.length === 0) {
        results.bars_processed.push({
          bar_id: barId,
          pending_count: 0,
          processed: 0,
          success: 0,
          errors: 0
        })
        continue
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/contahub-processor`
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ 
          process_all: true, 
          bar_id: barId 
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [CRON] Erro na Edge Function para bar ${barId}:`, errorText)
        results.bars_processed.push({
          bar_id: barId,
          pending_count: pendingData.length,
          processed: 0,
          success: 0,
          errors: pendingData.length,
          error: errorText
        })
        results.total_errors += pendingData.length
        continue
      }
      
      const result = await response.json()
      
      results.bars_processed.push({
        bar_id: barId,
        pending_count: pendingData.length,
        processed: result.processed_count || 0,
        success: result.success_count || 0,
        errors: result.error_count || 0
      })
      
      results.total_success += result.success_count || 0
      results.total_errors += result.error_count || 0
      results.total_records += result.processed_count || 0
    }

    const processingTime = (Date.now() - startTime) / 1000

    return NextResponse.json({
      success: true,
      message: `Processamento automático concluído`,
      processing_time_seconds: processingTime,
      ...results
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ [CRON] Erro no processamento automático:', errorMessage)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        processing_time_seconds: (Date.now() - startTime) / 1000
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
