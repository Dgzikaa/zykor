import { NextRequest, NextResponse } from 'next/server'
import { autenticarEValidarBar } from '@/lib/auth/acesso-bar'

const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
  'https://',
  'https://'
).replace('.supabase.co', '.supabase.co/functions/v1')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bar_id, dias_analisar = 365 } = body

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      )
    }

    const nega = await autenticarEValidarBar(request, bar_id)
    if (nega) return nega

    // Chamar Edge Function. Autoriza com a service role (padrão do projeto p/ chamada
    // servidor→edge): não existe mais um access_token de sessão Supabase aqui.
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/agente-analise-periodos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        bar_id,
        dias_analisar
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge Function error: ${errorText}`)
    }

    const data = await response.json()

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Erro na API /api/agente/analise-periodos:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao analisar períodos' },
      { status: 500 }
    )
  }
}
