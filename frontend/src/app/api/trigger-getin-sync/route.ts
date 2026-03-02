import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Logs apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Trigger Getin Sync - Iniciado em:', new Date().toISOString())
    }
    
    // Pegar datas da query string (opcional)
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    // URL da Edge Function do Supabase (seguindo padrão do projeto)
    const functionUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/getin-sync-continuous'
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 Chamando Edge Function:', functionUrl)
      if (startDate && endDate) {
        console.log(`📅 Período customizado: ${startDate} a ${endDate}`)
      }
    }
    
    const body: any = {}
    if (startDate) body.start_date = startDate
    if (endDate) body.end_date = endDate
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge Function retornou erro ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Sincronização Getin concluída:', result)
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronização Getin executada com sucesso',
      timestamp: new Date().toISOString(),
      stats: result.stats || null
    })

  } catch (error) {
    console.error('❌ Erro no trigger Getin sync:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Permitir POST também para flexibilidade com body
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const startDate = body.start_date
    const endDate = body.end_date
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Trigger Getin Sync (POST) - Iniciado em:', new Date().toISOString())
      if (startDate && endDate) {
        console.log(`📅 Período customizado: ${startDate} a ${endDate}`)
      }
    }
    
    const functionUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/getin-sync-continuous'
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge Function retornou erro ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Sincronização Getin concluída:', result)
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronização Getin executada com sucesso',
      timestamp: new Date().toISOString(),
      stats: result.stats || null
    })

  } catch (error) {
    console.error('❌ Erro no trigger Getin sync:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
