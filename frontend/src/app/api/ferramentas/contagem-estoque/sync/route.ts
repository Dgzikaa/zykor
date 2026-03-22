import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 📊 API ROUTE - SINCRONIZAÇÃO DE CONTAGEM DE ESTOQUE
 * 
 * Esta route chama a Edge Function sync-contagem-sheets
 * com as credenciais corretas.
 * 
 * Pode ser chamada:
 * 1. Manualmente via botão na interface
 * 2. Automaticamente via pg_cron (cron job)
 * 3. Via terminal/scripts
 */

export async function POST(request: NextRequest) {
  try {
    // Verificar se é chamada do cron job
    const body = await request.json().catch(() => ({}))
    const { cronSecret, data } = body
    
    // Validar cronSecret para chamadas do cron
    if (cronSecret && cronSecret !== 'pgcron_contagem' && cronSecret !== 'manual_test') {
      return NextResponse.json({
        success: false,
        error: 'Acesso não autorizado'
      }, { status: 401 })
    }
    
    // Data para processar (hoje por padrão, ou data passada no body)
    const dataProcessar = data || new Date().toISOString().split('T')[0]

    // Chamar Edge Function com SERVICE_ROLE_KEY
    const response = await fetch(
      `https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/sync-contagem-sheets?data=${dataProcessar}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ cronSecret: 'manual_test' })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: `Sincronização executada para data: ${dataProcessar}`,
      result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Erro na sincronização de contagem:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Permitir GET também para chamadas simples do cron
  return POST(request)
}

