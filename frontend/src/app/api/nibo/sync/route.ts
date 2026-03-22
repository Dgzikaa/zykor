import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const barId = body.bar_id
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    const syncMode = body.sync_mode || 'daily_complete'

    const response = await fetch(`${SUPABASE_URL}/functions/v1/nibo-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        barId: barId,
        sync_mode: syncMode,
        cronSecret: 'manual_test'
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro na sincronização NIBO:', errorText)
      throw new Error(`Erro na sincronização: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Sincronização NIBO concluída',
      data: result
    })

  } catch (error) {
    console.error('❌ Erro na sincronização NIBO:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error
      },
      { status: 500 }
    )
  }
}
