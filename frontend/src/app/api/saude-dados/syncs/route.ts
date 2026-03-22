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
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    const ontemStr = ontem.toISOString()

    // Buscar status dos diferentes sistemas
    const syncStatus: Array<{sistema: string; ultima_sync: string; status: string; registros: number; erros: number}> = []

    // ContaHub (faturamento_pagamentos)
    const { data: contahubData } = await supabase
      .from('faturamento_pagamentos')
      .select('data_pagamento, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    syncStatus.push({
      sistema: 'ContaHub',
      ultima_sync: contahubData?.[0]?.created_at ? new Date(contahubData[0].created_at).toLocaleString('pt-BR') : 'N/A',
      status: contahubData && contahubData.length > 0 ? 'ok' : 'warning',
      registros: contahubData?.length || 0,
      erros: 0
    })

    // Nibo
    const { data: niboData, error: niboError } = await supabase
      .from('nibo_logs_sincronizacao')
      .select('data_inicio, status, registros_erro')
      .gte('data_inicio', ontemStr)
      .order('data_inicio', { ascending: false })
      .limit(5)

    const niboErros = niboData?.filter(n => n.status === 'erro').length || 0
    syncStatus.push({
      sistema: 'Nibo',
      ultima_sync: niboData?.[0]?.data_inicio ? new Date(niboData[0].data_inicio).toLocaleString('pt-BR') : 'N/A',
      status: niboErros === 0 ? 'ok' : 'error',
      registros: niboData?.length || 0,
      erros: niboErros
    })

    // Sympla
    const { data: symplaData } = await supabase
      .from('sympla_eventos')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    syncStatus.push({
      sistema: 'Sympla',
      ultima_sync: symplaData?.[0]?.updated_at ? new Date(symplaData[0].updated_at).toLocaleString('pt-BR') : 'N/A',
      status: symplaData && symplaData.length > 0 ? 'ok' : 'warning',
      registros: symplaData?.length || 0,
      erros: 0
    })

    // Yuzer
    const { data: yuzerData } = await supabase
      .from('yuzer_eventos')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    syncStatus.push({
      sistema: 'Yuzer',
      ultima_sync: yuzerData?.[0]?.updated_at ? new Date(yuzerData[0].updated_at).toLocaleString('pt-BR') : 'N/A',
      status: yuzerData && yuzerData.length > 0 ? 'ok' : 'warning',
      registros: yuzerData?.length || 0,
      erros: 0
    })

    return NextResponse.json({ success: true, data: syncStatus })
  } catch (error: any) {
    console.error('Erro na API de syncs:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
