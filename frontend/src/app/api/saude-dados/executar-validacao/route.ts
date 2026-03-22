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

    // Executar validação dos últimos 7 dias
    const resultados: any[] = []
    
    for (let i = 1; i <= 7; i++) {
      const data = new Date()
      data.setDate(data.getDate() - i)
      const dataStr = data.toISOString().split('T')[0]

      const { data: resultado, error } = await supabase.rpc('validar_dados_dia', {
        p_data: dataStr,
        p_bar_id: 3
      })

      if (!error && resultado) {
        resultados.push(resultado[0])
      }
    }

    // Executar detecção de anomalias de ontem
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    
    const { data: anomalias } = await supabase.rpc('detectar_anomalias_dia', {
      p_data: ontem.toISOString().split('T')[0],
      p_bar_id: 3
    })

    // Bloquear dados históricos
    const { data: bloqueio } = await supabase.rpc('bloquear_dados_historicos', {
      p_dias_atras: 7
    })

    return NextResponse.json({
      success: true,
      message: 'Validação executada com sucesso',
      validacoes: resultados.length,
      anomalias: anomalias?.length || 0,
      bloqueio
    })
  } catch (error: any) {
    console.error('Erro ao executar validação:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
