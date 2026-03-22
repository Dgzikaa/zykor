import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Executar o agente de monitoramento
export async function POST(request: NextRequest) {
  try {
    // Chamar a Edge Function
    const { data, error } = await supabase.functions.invoke('monitor-concorrencia', {
      body: {}
    })

    if (error) {
      console.error('Erro ao executar agente:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resultado: data,
      message: 'Monitoramento executado com sucesso'
    })

  } catch (error) {
    console.error('Erro na API de monitoramento:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Verificar última execução
export async function GET() {
  try {
    // Buscar estatísticas do monitoramento
    const hoje = new Date()
    const dataHoje = hoje.toISOString().split('T')[0]
    
    // Contar eventos por status
    const { data: estatisticas, error } = await supabase
      .from('eventos_concorrencia')
      .select('status, tipo, impacto, fonte', { count: 'exact' })
      .eq('status', 'ativo')

    if (error) {
      console.error('Erro ao buscar estatísticas:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Agrupar por tipo
    const porTipo: { [key: string]: number } = {}
    const porImpacto: { [key: string]: number } = {}
    const porFonte: { [key: string]: number } = {}

    estatisticas?.forEach((e: any) => {
      porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1
      porImpacto[e.impacto] = (porImpacto[e.impacto] || 0) + 1
      porFonte[e.fonte] = (porFonte[e.fonte] || 0) + 1
    })

    // Buscar próximos eventos
    const { data: proximosEventos } = await supabase
      .from('eventos_concorrencia')
      .select('id, nome, data_evento, local_nome, tipo, impacto')
      .eq('status', 'ativo')
      .gte('data_evento', dataHoje)
      .order('data_evento', { ascending: true })
      .limit(10)

    return NextResponse.json({
      success: true,
      estatisticas: {
        total_ativos: estatisticas?.length || 0,
        por_tipo: porTipo,
        por_impacto: porImpacto,
        por_fonte: porFonte
      },
      proximos_eventos: proximosEventos || []
    })

  } catch (error) {
    console.error('Erro na API de monitoramento:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
