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

    // 1. Total de regras criadas
    const { data: regras, count: totalRegras } = await supabase
      .from('agente_regras_dinamicas')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(bar_id))

    const regrasAtivas = regras?.filter(r => r.ativa).length || 0
    const regrasPorOrigem = {
      conversa: regras?.filter(r => r.origem === 'conversa').length || 0,
      feedback: regras?.filter(r => r.origem === 'feedback').length || 0,
      observacao: regras?.filter(r => r.origem === 'observacao').length || 0
    }

    // 2. Memórias armazenadas
    const { count: totalMemorias } = await supabase
      .from('agente_memoria_vetorial')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(bar_id))

    // 3. Feedbacks (taxa de sucesso)
    const { data: feedbacks, count: totalFeedbacks } = await supabase
      .from('agente_feedbacks')
      .select('feedback', { count: 'exact' })
      .eq('bar_id', parseInt(bar_id))

    const feedbacksUteis = feedbacks?.filter(f => f.feedback === 'util').length || 0
    const taxaSucesso = totalFeedbacks ? ((feedbacksUteis / totalFeedbacks) * 100).toFixed(1) : '0.0'

    // 4. Insights gerados
    const { count: totalInsights } = await supabase
      .from('agente_insights')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(bar_id))
      .eq('origem_ia', true)

    // 5. Alertas enviados
    const { count: totalAlertas } = await supabase
      .from('agente_alertas')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(bar_id))
      .eq('origem_ia', true)

    // 6. Padrões detectados
    const { data: padroes, count: totalPadroes } = await supabase
      .from('agente_padroes_detectados')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(bar_id))

    const padroesConfirmados = padroes?.filter(p => p.status === 'confirmado').length || 0

    // 7. Conversas com IA
    const { count: totalConversas } = await supabase
      .from('agente_conversas')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', parseInt(bar_id))

    const { data: conversasComAprendizado } = await supabase
      .from('agente_conversas')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(bar_id))
      .eq('gerou_aprendizado', true)

    // 8. Custo total
    const { data: metricas } = await supabase
      .from('agente_ia_metricas')
      .select('custo_estimado, tokens_input, tokens_output')
      .eq('bar_id', parseInt(bar_id))

    const custoTotal = metricas?.reduce((sum, m) => sum + parseFloat(m.custo_estimado || '0'), 0) || 0
    const tokensTotal = metricas?.reduce((sum, m) => sum + (m.tokens_input || 0) + (m.tokens_output || 0), 0) || 0

    // 9. Evolução temporal (últimos 7 dias)
    const seteDiasAtras = new Date()
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)

    const { data: evolucaoDiaria } = await supabase
      .from('agente_ia_metricas')
      .select('created_at, tipo_operacao')
      .eq('bar_id', parseInt(bar_id))
      .gte('created_at', seteDiasAtras.toISOString())
      .order('created_at', { ascending: true })

    // Agrupar por dia
    const operacoesPorDia: Record<string, number> = {}
    evolucaoDiaria?.forEach(item => {
      const dia = new Date(item.created_at).toLocaleDateString('pt-BR')
      operacoesPorDia[dia] = (operacoesPorDia[dia] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      metricas: {
        // Aprendizado
        total_regras: totalRegras || 0,
        regras_ativas: regrasAtivas,
        regras_por_origem: regrasPorOrigem,
        total_memorias: totalMemorias || 0,
        
        // Feedback
        total_feedbacks: totalFeedbacks || 0,
        feedbacks_uteis: feedbacksUteis,
        taxa_sucesso: taxaSucesso,
        
        // Outputs
        total_insights: totalInsights || 0,
        total_alertas: totalAlertas || 0,
        total_padroes: totalPadroes || 0,
        padroes_confirmados: padroesConfirmados,
        
        // Interações
        total_conversas: totalConversas || 0,
        conversas_com_aprendizado: conversasComAprendizado?.length || 0,
        
        // Custo
        custo_total_usd: custoTotal.toFixed(4),
        custo_total_brl: (custoTotal * 5.8).toFixed(2),
        tokens_total: tokensTotal,
        
        // Evolução
        evolucao_7_dias: operacoesPorDia
      }
    })

  } catch (error: any) {
    console.error('Erro ao buscar evolução do agente:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar evolução' },
      { status: 500 }
    )
  }
}
