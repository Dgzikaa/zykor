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
    const barId = user.bar_id
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })

    const systemClient = supabase.schema('system' as any)
    const integrationsClient = supabase.schema('integrations' as any)
    const silverClient = supabase.schema('silver' as any)

    // Buscar validações dos últimos 30 dias
    const { data: validacoes, error: validacoesError } = await systemClient
      .from('validacao_dados_diaria')
      .select('*')
      .eq('bar_id', barId)
      .order('data_referencia', { ascending: false })
      .limit(30)

    if (validacoesError) {
      console.error('Erro ao buscar validações:', validacoesError)
    }

    // Buscar alertas (últimos 50)
    const { data: alertas, error: alertasError } = await systemClient
      .from('sistema_alertas')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50)

    if (alertasError) {
      console.error('Erro ao buscar alertas:', alertasError)
    }

    // Buscar dados bloqueados
    const { data: bloqueados, error: bloqueadosError } = await systemClient
      .from('dados_bloqueados')
      .select('*')
      .eq('bar_id', barId)
      .eq('desbloqueado', false)
      .order('data_referencia', { ascending: false })
      .limit(100)

    if (bloqueadosError) {
      console.error('Erro ao buscar bloqueados:', bloqueadosError)
    }

    const { data: contahubSync } = await silverClient
      .from('faturamento_pagamentos')
      .select('atualizado_em')
      .eq('bar_id', barId)
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: symplaSync } = await integrationsClient
      .from('sympla_pedidos')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: yuzerSync } = await silverClient
      .from('silver_yuzer_pagamentos_evento')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { count: contahubCount } = await silverClient
      .from('faturamento_pagamentos')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', barId)

    const bronzeClient = supabase.schema('bronze' as any)
    const { data: contaazulSync } = await bronzeClient
      .from('bronze_contaazul_lancamentos')
      .select('synced_at')
      .eq('bar_id', barId)
      .is('excluido_em', null)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { count: contaazulCount } = await bronzeClient
      .from('bronze_contaazul_lancamentos')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', barId)
      .is('excluido_em', null)

    const statusSyncs = [
      {
        sistema: 'Conta Azul',
        ultima_sync: contaazulSync?.synced_at || null,
        status: contaazulSync ? 'ok' : 'sem dados',
        registros: contaazulCount || 0
      },
      {
        sistema: 'ContaHub',
        ultima_sync: contahubSync?.atualizado_em || null,
        status: contahubSync ? 'ok' : 'sem dados',
        registros: contahubCount || 0
      },
      {
        sistema: 'Sympla',
        ultima_sync: symplaSync?.created_at || null,
        status: symplaSync ? 'ok' : 'sem dados',
        registros: 0
      },
      {
        sistema: 'Yuzer',
        ultima_sync: yuzerSync?.created_at || null,
        status: yuzerSync ? 'ok' : 'sem dados',
        registros: 0
      }
    ]

    return NextResponse.json({
      success: true,
      validacoes: validacoes || [],
      alertas: alertas || [],
      bloqueados: bloqueados || [],
      statusSyncs
    })

  } catch (error: any) {
    console.error('Erro na API de saúde dos dados:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
