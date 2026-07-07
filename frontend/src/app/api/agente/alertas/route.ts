import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { authenticateUser } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bar_id = searchParams.get('bar_id')
    const lido = searchParams.get('lido')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    let query = supabase
      .from('agente_alertas')
      .select('*, agente_insights(*)')
      .eq('bar_id', parseInt(bar_id))
      .order('created_at', { ascending: false })
      .limit(limit)

    if (lido !== null && lido !== undefined) {
      query = query.eq('lido', lido === 'true')
    }

    const { data: alertas, error } = await query

    if (error) throw error

    return NextResponse.json({ alertas })

  } catch (error: any) {
    console.error('Erro ao buscar alertas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar alertas' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  await authenticateUser(request);
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { alerta_id, lido } = body

    if (!alerta_id) {
      return NextResponse.json({ error: 'alerta_id é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('agente_alertas')
      .update({ lido })
      .eq('id', alerta_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ alerta: data })

  } catch (error: any) {
    console.error('Erro ao atualizar alerta:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar alerta' },
      { status: 500 }
    )
  }
}
