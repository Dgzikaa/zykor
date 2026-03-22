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

    // Executar validação para ontem
    const { data, error } = await supabase.rpc('executar_validacao_diaria', {
      p_data: null, // null = ontem
      p_bar_id: barId
    })

    if (error) {
      console.error('Erro ao executar validação:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      resultado: data
    })

  } catch (error: any) {
    console.error('Erro na validação manual:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
