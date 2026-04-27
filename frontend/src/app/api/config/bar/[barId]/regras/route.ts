import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { tbl } from '@/lib/supabase/table-schemas'

/**
 * GET /api/config/bar/[barId]/regras
 * Retorna regras de negócio do bar (Onda 1)
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

    const supabase = createServerClient()
    
    const { data, error } = await tbl(supabase, 'bar_regras_negocio')
      .select('cmv_fator_consumo, ano_inicio_operacao')
      .eq('bar_id', barIdNum)
      .single()

    if (error) {
      console.error(`❌ [config/bar/${barId}/regras] Erro:`, error.message)
      return NextResponse.json(
        { error: 'Erro ao buscar configuração' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Configuração não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      cmv_fator_consumo: parseFloat(data.cmv_fator_consumo),
      ano_inicio_operacao: data.ano_inicio_operacao
    })

  } catch (err) {
    console.error('❌ [config/bar/regras] Erro inesperado:', err)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
