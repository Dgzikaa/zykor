import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser } from '@/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = await getAdminClient()
    const barId = user.bar_id
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })

    const { data, error } = await supabase.rpc('validar_dados_contahub_diario')

    if (error) {
      console.error('Erro ao executar validação:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const resultados = (data ?? []).filter((r: any) => r.bar_id === barId)
    const problemas = resultados.length

    return NextResponse.json({
      success: true,
      problemas_detectados: problemas,
      resultado: resultados
    })

  } catch (error: any) {
    console.error('Erro na validação manual:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
