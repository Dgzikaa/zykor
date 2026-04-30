import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser } from '@/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = await getAdminClient()

    // Alertas críticos não resolvidos
    const { count: alertasCriticos } = await supabase
      .from('sistema_alertas')
      .select('*', { count: 'exact', head: true })
      .eq('resolvido', false)
      .in('severidade', ['error', 'critical'])

    // Total de alertas não resolvidos
    const { count: alertasTotal } = await supabase
      .from('sistema_alertas')
      .select('*', { count: 'exact', head: true })
      .eq('resolvido', false)

    // Validações dos últimos 7 dias
    const seteDiasAtras = new Date()
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)

    const { data: validacoes } = await supabase
      .from('validacoes_cruzadas')
      .select('status')
      .gte('data_referencia', seteDiasAtras.toISOString().split('T')[0])

    const validacoesOk = validacoes?.filter(v => v.status === 'OK').length || 0
    const validacoesTotal = validacoes?.length || 0

    // Syncs nas últimas 24h
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)

    // Verificar syncs do Conta Azul nas últimas 24h
    const { data: syncs } = await supabase
      .schema('integrations' as any)
      .from('contaazul_lancamentos')
      .select('id')
      .gte('created_at', ontem.toISOString())

    const syncsOk = syncs?.length || 0
    const syncsTotal = syncs?.length || 0

    // Dias bloqueados
    const { count: diasBloqueados } = await supabase
      .from('dados_bloqueados')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      data: {
        alertasCriticos: alertasCriticos || 0,
        alertasTotal: alertasTotal || 0,
        validacoesOk,
        validacoesTotal,
        syncsOk,
        syncsTotal,
        diasBloqueados: diasBloqueados || 0
      }
    })
  } catch (error: any) {
    console.error('Erro na API de resumo:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
