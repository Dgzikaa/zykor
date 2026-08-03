import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { autenticarEValidarBar } from '@/lib/auth/acesso-bar'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { searchParams } = new URL(request.url)
    const bar_id = searchParams.get('bar_id')

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      )
    }

    const nega = await autenticarEValidarBar(request, bar_id)
    if (nega) return nega

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
