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
      .schema('silver' as never)
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

    // Conta Azul — verificar último lançamento importado (bronze pós-medallion)
    const { data: contaazulData } = await supabase
      .schema('bronze' as any)
      .from('bronze_contaazul_lancamentos')
      .select('synced_at')
      .is('excluido_em', null)
      .order('synced_at', { ascending: false })
      .limit(1)

    syncStatus.push({
      sistema: 'Conta Azul',
      ultima_sync: contaazulData?.[0]?.synced_at ? new Date(contaazulData[0].synced_at).toLocaleString('pt-BR') : 'N/A',
      status: contaazulData && contaazulData.length > 0 ? 'ok' : 'warning',
      registros: contaazulData?.length || 0,
      erros: 0
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

    // Yuzer (silver_yuzer_eventos = bronze + integrations legacy join; updated_at = synced_at)
    const { data: yuzerData } = await supabase
      .from('silver_yuzer_eventos')
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
