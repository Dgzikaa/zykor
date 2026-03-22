import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  try {
    const supabase = createServerClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const bar_id = searchParams.get('bar_id')

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
      .eq('bar_id', parseInt(bar_id))
      .single()

    if (!acesso) {
      return NextResponse.json(
        { error: 'Sem acesso a este bar' },
        { status: 403 }
      )
    }

    // Buscar estatísticas de feedback
    const { data: feedbacks, error } = await supabase
      .from('agente_feedbacks')
      .select('*')
      .eq('bar_id', parseInt(bar_id))

    if (error) {
      throw error
    }

    // Calcular estatísticas
    const total = feedbacks?.length || 0
    const uteis = feedbacks?.filter(f => f.feedback === 'util').length || 0
    const neutros = feedbacks?.filter(f => f.feedback === 'neutro').length || 0
    const inuteis = feedbacks?.filter(f => f.feedback === 'inutil').length || 0

    const porTipo = {
      insight: feedbacks?.filter(f => f.tipo === 'insight').length || 0,
      alerta: feedbacks?.filter(f => f.tipo === 'alerta').length || 0,
      sugestao: feedbacks?.filter(f => f.tipo === 'sugestao').length || 0
    }

    return NextResponse.json({
      success: true,
      estatisticas: {
        total,
        uteis,
        neutros,
        inuteis,
        taxa_sucesso: total > 0 ? ((uteis / total) * 100).toFixed(1) : '0.0',
        por_tipo: porTipo
      },
      feedbacks_recentes: feedbacks?.slice(-10).reverse() || []
    })

  } catch (error: any) {
    console.error('Erro ao buscar feedbacks:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar feedbacks' },
      { status: 500 }
    )
  }
}
