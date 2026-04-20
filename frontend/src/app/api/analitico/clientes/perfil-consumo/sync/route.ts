import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface EtlClienteEstatisticasResult {
  clientes_processados?: number
  clientes_inseridos?: number
  clientes_atualizados?: number
  clientes_vip?: number
  clientes_com_whatsapp?: number
  clientes_com_reservas_getin?: number
  clientes_com_nps?: number
  duracao_ms?: number
}

// REWIRE 2026-04-19: rota antes calculava perfis em JS (~378 linhas)
// duplicando logica de etl_silver_cliente_estatisticas_full + escrevia em
// view legacy crm.cliente_perfil_consumo. Agora delega para a RPC silver
// (PL/pgSQL otimizado, executado pelo cron diario silver-cliente-estatisticas
// 08:10 BRT). Botao "Sincronizar perfis" da UI continua funcionando.
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) return authErrorResponse('Usuário não autenticado')

    const supabase = await getAdminClient()
    const body = await request.json().catch(() => ({}))
    const barId = body.bar_id

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    const startTime = Date.now()

    const { data, error } = await supabase.rpc('etl_silver_cliente_estatisticas_full', {
      p_bar_id: barId,
    })

    if (error) {
      console.error('❌ Erro ETL silver cliente_estatisticas:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao executar ETL silver' },
        { status: 500 }
      )
    }

    const result: EtlClienteEstatisticasResult = (Array.isArray(data) ? data[0] : data) || {}
    const tempoMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      bar_id: barId,
      clientes_processados: result.clientes_processados || 0,
      clientes_inseridos: result.clientes_inseridos || 0,
      clientes_atualizados: result.clientes_atualizados || 0,
      clientes_vip: result.clientes_vip || 0,
      clientes_com_whatsapp: result.clientes_com_whatsapp || 0,
      clientes_com_reservas_getin: result.clientes_com_reservas_getin || 0,
      clientes_com_nps: result.clientes_com_nps || 0,
      duracao_ms: result.duracao_ms || tempoMs,
      info: 'Invoca etl_silver_cliente_estatisticas_full. Cron diario roda automaticamente 08:10 BRT.',
    })
  } catch (error) {
    console.error('❌ Erro no sync de perfil de consumo:', error)
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
