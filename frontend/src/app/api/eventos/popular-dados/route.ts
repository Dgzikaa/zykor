import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMediaM1, getTePlan, getTbPlan } from '@/lib/eventos-rules'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { barId } = await request.json()

    if (!barId) {
      return NextResponse.json(
        { error: 'barId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar todos os eventos do bar
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId)
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
      
      // Dados mockados para custos (serão substituídos pela integração com Nibo)
      const c_art = 0 // Será calculado via Nibo
      const c_prod = 0 // Será calculado via Nibo
      const percent_art_fat = 0 // Será calculado quando tivermos real_r

      // Preparar dados para atualização
      const dadosAtualizados = {
        m1_r,
        te_plan,
        tb_plan,
        c_art,
        c_prod,
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
      message: `${eventosAtualizados.length} eventos atualizados com dados mockados`,
      eventos_atualizados: eventosAtualizados
    })

  } catch (error) {
    console.error('Erro ao popular dados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET para verificar dados atuais
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

    // Buscar eventos com dados de indicadores
    const { data: eventos, error } = await supabase
      .from('eventos_base')
      .select('id, nome, data_evento, m1_r, te_plan, tb_plan, c_art, c_prod, percent_art_fat, atualizado_em')
      .eq('bar_id', barId)
      .order('data_evento', { ascending: false })
      .limit(20)

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
    console.error('Erro ao buscar dados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 
