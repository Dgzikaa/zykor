import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('🔄 [CRON] Iniciando processamento automático de dados brutos ContaHub')
    
    const results = {
      bars_processed: [] as any[],
      total_success: 0,
      total_errors: 0,
      total_records: 0
    }
    
    const barIds = [3, 4]
    
    for (const barId of barIds) {
      console.log(`\n📦 [CRON] Processando bar_id=${barId}`)
      
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
        console.log(`✅ [CRON] Bar ${barId}: Nenhum dado pendente`)
        results.bars_processed.push({
          bar_id: barId,
          pending_count: 0,
          processed: 0,
          success: 0,
          errors: 0
        })
        continue
      }
      
      console.log(`📊 [CRON] Bar ${barId}: ${pendingData.length} registros pendentes`)
      
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
      
      console.log(`✅ [CRON] Bar ${barId}: ${result.success_count}/${result.processed_count} processados com sucesso`)
    }
    
    const processingTime = (Date.now() - startTime) / 1000
    
    console.log(`\n🎉 [CRON] Processamento concluído em ${processingTime.toFixed(2)}s`)
    console.log(`   Total: ${results.total_records} registros, ${results.total_success} sucessos, ${results.total_errors} erros`)
    
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
