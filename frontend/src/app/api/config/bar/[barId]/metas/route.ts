import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/**
 * GET /api/config/bar/[barId]/metas
 * Retorna metas por dia da semana (Onda 1)
 * 
 * Query params:
 *   - dia_semana: 0-6 (opcional, se omitido retorna todos os dias)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ barId: string }> }
) {
  try {
    const { barId } = await params
    const barIdNum = parseInt(barId, 10)
    
    if (isNaN(barIdNum)) {
      return NextResponse.json(
        { error: 'bar_id inválido' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const diaSemanaParam = searchParams.get('dia_semana')

    const supabase = createServerClient()
    
    let query = supabase
      .from('bar_metas_periodo')
      .select('dia_semana, meta_m1, te_plan, tb_plan')
      .eq('bar_id', barIdNum)
      .order('dia_semana', { ascending: true })

    if (diaSemanaParam !== null) {
      const diaSemana = parseInt(diaSemanaParam, 10)
      if (diaSemana >= 0 && diaSemana <= 6) {
        query = query.eq('dia_semana', diaSemana)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error(`❌ [config/bar/${barId}/metas] Erro:`, error.message)
      return NextResponse.json(
        { error: 'Erro ao buscar metas' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Metas não encontradas' },
        { status: 404 }
      )
    }

    const metas = data.map(m => ({
      dia_semana: m.dia_semana,
      meta_m1: parseFloat(String(m.meta_m1)),
      te_plan: parseFloat(String(m.te_plan)),
      tb_plan: parseFloat(String(m.tb_plan))
    }))

    return NextResponse.json(metas)

  } catch (err) {
    console.error('❌ [config/bar/metas] Erro inesperado:', err)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
