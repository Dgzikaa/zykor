import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  getMediaM1, 
  getTePlan, 
  getTbPlan, 
  buscarCustosNibo,
  calcularPercentArtFat 
} from '@/lib/eventos-rules'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { barId, dataInicio, dataFim } = await request.json()

    if (!barId) {
      return NextResponse.json(
        { error: 'barId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar eventos no período
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio || new Date().toISOString().split('T')[0])
      .lte('data_evento', dataFim || new Date().toISOString().split('T')[0])
      .order('data_evento')

    if (eventosError) {
      console.error('Erro ao buscar eventos:', eventosError)
      return NextResponse.json(
        { error: 'Erro ao buscar eventos' },
        { status: 500 }
      )
    }

    const eventosAtualizados: any[] = []

    // Processar cada evento
    for (const evento of eventos || []) {
      const dataEvento = new Date(evento.data_evento)
      
      // Aplicar regras de negócio
      const m1_r = getMediaM1(dataEvento)
      const te_plan = getTePlan(dataEvento)
      const tb_plan = getTbPlan(dataEvento)
      
      // Buscar custos no Nibo
      const custos = await buscarCustosNibo(dataEvento, barId)
      
      // Calcular percentual artista sobre faturamento
      const percent_art_fat = calcularPercentArtFat(
        custos.custoArtistico,
        custos.custoProducao,
        evento.real_r || 0
      )

      // Preparar dados para atualização
      const dadosAtualizados = {
        m1_r,
        te_plan,
        tb_plan,
        c_art: custos.custoArtistico,
        c_prod: custos.custoProducao,
        percent_art_fat,
        atualizado_em: new Date().toISOString()
      }

      // Atualizar evento
      const { error: updateError } = await supabase
        .from('eventos_base')
        .update(dadosAtualizados)
        .eq('id', evento.id)

      if (updateError) {
        console.error(`Erro ao atualizar evento ${evento.id}:`, updateError)
        continue
      }

      eventosAtualizados.push({
        id: evento.id,
        nome: evento.nome,
        data_evento: evento.data_evento,
        ...dadosAtualizados
      })
    }

    return NextResponse.json({
      success: true,
      message: `${eventosAtualizados.length} eventos atualizados com sucesso`,
      eventos_atualizados: eventosAtualizados
    })

  } catch (error) {
    console.error('Erro na sincronização de eventos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET para buscar status da sincronização
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barId = searchParams.get('barId')

    if (!barId) {
      return NextResponse.json(
        { error: 'barId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar eventos mais recentes para mostrar status
    const { data: eventos, error } = await supabase
      .from('eventos_base')
      .select('id, nome, data_evento, m1_r, te_plan, tb_plan, c_art, c_prod, percent_art_fat, atualizado_em')
      .eq('bar_id', barId)
      .order('data_evento', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Erro ao buscar eventos:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar eventos' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      eventos: eventos || []
    })

  } catch (error) {
    console.error('Erro ao buscar status:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 
