import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { authenticateUser } from '@/middleware/auth';

const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
  'https://',
  'https://'
).replace('.supabase.co', '.supabase.co/functions/v1')

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bar_id, tipo = 'rapida', periodo_dias = 365 } = body

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar acesso
    const { data: acesso } = await supabase
      .from('usuarios_bar')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('bar_id', bar_id)
      .single()

    if (!acesso) {
      return NextResponse.json(
        { error: 'Sem acesso a este bar' },
        { status: 403 }
      )
    }

    // Chamar Edge Function de auditoria
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/agente-auditor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        bar_id,
        tipo,
        periodo_dias
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Edge Function error: ${errorText}`)
    }

    const data = await response.json()

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Erro na API /api/agente/auditoria:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao executar auditoria' },
      { status: 500 }
    )
  }
}
