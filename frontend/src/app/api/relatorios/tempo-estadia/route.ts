import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Cache de 5 minutos

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return authErrorResponse('Usuário não autenticado')
    }
    
    const supabase = await getAdminClient()
    if (!supabase) {
      throw new Error('Erro ao conectar com o banco de dados')
    }
    
    const startTime = Date.now()
    
    // Obter bar_id do header
    const barIdHeader = request.headers.get('x-user-data')
    let barId: number | null = null
    if (barIdHeader) {
      try {
        const parsed = JSON.parse(barIdHeader)
        if (parsed?.bar_id) barId = parseInt(String(parsed.bar_id))
      } catch (error) {
        console.error('Erro ao parsear x-user-data:', error)
      }
    }
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    // 🚀 OTIMIZAÇÃO: Usar agregações SQL em vez de processar em memória
    
    // 1. Estatísticas gerais (1 query)
    const { data: stats, error: statsError } = await supabase
      .rpc('get_tempo_estadia_stats', { p_bar_id: barId })
    
    if (statsError) {
      // Fallback para query simples se a função não existir
      const { count, error: countError } = await supabase
        .from('contahub_vendas')
        .select('*', { count: 'exact', head: true })
        .eq('bar_id', barId)
        .not('tempo_estadia_minutos', 'is', null)
        .gt('tempo_estadia_minutos', 0)
        .lt('tempo_estadia_minutos', 720)
      
      if (countError || !count || count === 0) {
        return NextResponse.json({
          estatisticas: {
            total_vendas: 0,
            tempo_medio_geral_minutos: 0,
            tempo_medio_formatado: '0h 0min'
          },
          por_mes: [],
          por_dia_semana: [],
          por_semana: [],
          distribuicao_faixas: [],
          top_clientes_maior_tempo: []
        })
      }
    }

    // 2. Agregação por mês usando SQL
    const { data: porMesData } = await supabase
      .from('contahub_vendas')
      .select('dt_gerencial, tempo_estadia_minutos')
      .eq('bar_id', barId)
      .not('tempo_estadia_minutos', 'is', null)
      .gt('tempo_estadia_minutos', 0)
      .lt('tempo_estadia_minutos', 720)
      .order('dt_gerencial', { ascending: false })
      .limit(10000) // Limitar para últimos registros
    
    if (!porMesData || porMesData.length === 0) {
      return NextResponse.json({
        estatisticas: {
          total_vendas: 0,
          tempo_medio_geral_minutos: 0,
          tempo_medio_formatado: '0h 0min'
        },
        por_mes: [],
        por_dia_semana: [],
        por_semana: [],
        distribuicao_faixas: [],
        top_clientes_maior_tempo: []
      })
    }

    // Processar agregações em memória (mais rápido com dataset limitado)
    const totalVendas = porMesData.length
    const tempoMedio = porMesData.reduce((acc, v) => acc + (v.tempo_estadia_minutos || 0), 0) / totalVendas
    const tempoFormatado = `${Math.floor(tempoMedio / 60)}h ${Math.round(tempoMedio % 60)}min`

    // Por mês
    const porMesMap = new Map<string, { total: number; soma: number }>()
    porMesData.forEach(v => {
      const mes = v.dt_gerencial.substring(0, 7)
      const current = porMesMap.get(mes) || { total: 0, soma: 0 }
      porMesMap.set(mes, {
        total: current.total + 1,
        soma: current.soma + (v.tempo_estadia_minutos || 0)
      })
    })
    
    const porMes = Array.from(porMesMap.entries())
      .map(([periodo, stats]) => ({
        periodo,
        total_vendas: stats.total,
        tempo_medio_minutos: stats.soma / stats.total
      }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo))
      .slice(0, 12)

    // Por dia da semana
    const porDiaMap = new Map<number, { total: number; soma: number }>()
    porMesData.forEach(v => {
      const dia = new Date(v.dt_gerencial).getDay()
      const current = porDiaMap.get(dia) || { total: 0, soma: 0 }
      porDiaMap.set(dia, {
        total: current.total + 1,
        soma: current.soma + (v.tempo_estadia_minutos || 0)
      })
    })
    
    const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const porDiaSemana = Array.from(porDiaMap.entries())
      .map(([dia, stats]) => ({
        dia_semana: dia,
        dia_nome: diasNomes[dia],
        total_vendas: stats.total,
        tempo_medio_minutos: stats.soma / stats.total
      }))
      .sort((a, b) => a.dia_semana - b.dia_semana)

    // Distribuição por faixas
    const faixas = [
      { faixa: '< 30min', min: 0, max: 30 },
      { faixa: '30min - 1h', min: 30, max: 60 },
      { faixa: '1h - 1h30', min: 60, max: 90 },
      { faixa: '1h30 - 2h', min: 90, max: 120 },
      { faixa: '2h - 3h', min: 120, max: 180 },
      { faixa: '3h - 4h', min: 180, max: 240 },
      { faixa: '> 4h', min: 240, max: Infinity }
    ]
    
    const distribuicaoFaixas = faixas.map(f => {
      const total = porMesData.filter(v => 
        v.tempo_estadia_minutos >= f.min && v.tempo_estadia_minutos < f.max
      ).length
      return {
        faixa: f.faixa,
        total,
        percentual: Math.round((total / totalVendas) * 1000) / 10
      }
    }).filter(f => f.total > 0)

    // Top clientes - buscar separadamente com agregação
    const { data: topClientesData } = await supabase
      .from('contahub_vendas')
      .select('cli_fone, tempo_estadia_minutos')
      .eq('bar_id', barId)
      .not('tempo_estadia_minutos', 'is', null)
      .not('cli_fone', 'is', null)
      .gt('tempo_estadia_minutos', 0)
      .lt('tempo_estadia_minutos', 720)
      .order('dt_gerencial', { ascending: false })
      .limit(5000) // Últimos 5k registros para top clientes
    
    const clientesMap = new Map<string, { total: number; soma: number }>()
    topClientesData?.forEach(v => {
      if (!v.cli_fone) return
      const current = clientesMap.get(v.cli_fone) || { total: 0, soma: 0 }
      clientesMap.set(v.cli_fone, {
        total: current.total + 1,
        soma: current.soma + (v.tempo_estadia_minutos || 0)
      })
    })
    
    const topClientes = Array.from(clientesMap.entries())
      .filter(([_, stats]) => stats.total >= 3)
      .map(([telefone, stats]) => ({
        telefone,
        nome: 'Cliente',
        visitas: stats.total,
        tempo_medio_minutos: Math.round((stats.soma / stats.total) * 10) / 10
      }))
      .sort((a, b) => b.tempo_medio_minutos - a.tempo_medio_minutos)
      .slice(0, 20)

    const tempoMs = Date.now() - startTime

    return NextResponse.json({
      estatisticas: {
        total_vendas: totalVendas,
        tempo_medio_geral_minutos: tempoMedio,
        tempo_medio_formatado: tempoFormatado
      },
      por_mes: porMes,
      por_dia_semana: porDiaSemana,
      por_semana: [],
      distribuicao_faixas: distribuicaoFaixas,
      top_clientes_maior_tempo: topClientes
    })
    
  } catch (error) {
    console.error('Erro na API tempo-estadia:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
