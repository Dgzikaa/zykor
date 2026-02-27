import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

// Datas de início da entrada obrigatória
const DATAS_ENTRADA = {
  quarta: '2025-11-19',
  sexta: '2025-11-14'
}

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('🎯 API /api/relatorios/analise-couvert chamada!')
  try {
    const supabase = await getAdminClient()
    if (!supabase) {
      console.error('❌ Erro: Cliente Supabase não inicializado')
      return NextResponse.json({ 
        success: false, 
        error: 'Erro ao conectar com banco de dados' 
      }, { status: 500 })
    }
    
    console.log('✅ Cliente Supabase inicializado')
    const barId = 3
    
    const startTime = Date.now()

    // Buscar apenas quartas e sextas usando paginação
    const vendasData: any[] = []
    const pageSize = 1000
    let hasMore = true
    let page = 0

    while (hasMore) {
      const { data: vendas, error: vendasError } = await supabase
        .from('contahub_vendas')
        .select('vd_hrabertura, cli_fone, vd_cpf, vd_vrcheio, vd_vrdescontos')
        .eq('bar_id', barId)
        .gte('vd_hrabertura', '2025-09-01')
        .gt('vd_vrcheio', 0)
        .order('vd_hrabertura', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (vendasError) {
        console.error('❌ Erro ao buscar vendas:', vendasError)
        return NextResponse.json({ 
          success: false, 
          error: 'Erro ao buscar dados de vendas' 
        }, { status: 500 })
      }

      const vendasPagina = (vendas || []) as any[]
      
      // Filtrar apenas quartas (3) e sextas (5) para economizar memória
      const vendasFiltradas = vendasPagina.filter(v => {
        const diaSemana = new Date(v.vd_hrabertura).getDay()
        return diaSemana === 3 || diaSemana === 5
      })
      
      vendasData.push(...vendasFiltradas)
      
      console.log(`📄 Página ${page + 1}: ${vendasPagina.length} vendas, ${vendasFiltradas.length} quartas/sextas`)
      
      hasMore = vendasPagina.length === pageSize
      page++
      
      // Limite de segurança para evitar loop infinito
      if (page > 100) {
        console.warn('⚠️ Limite de páginas atingido')
        break
      }
    }
    
    console.log(`📊 Total de vendas carregadas: ${vendasData.length} (quartas e sextas)`)

    // Função helper para obter identificador único do cliente
    const getClienteId = (venda: any) => {
      return venda.cli_fone || venda.vd_cpf || 'sem_identificacao'
    }

    // Função helper para calcular métricas
    const calcularMetricas = (vendasFiltradas: any[]) => {
      if (vendasFiltradas.length === 0) {
        return {
          total_comandas: 0,
          total_dias: 0,
          clientes_unicos: 0,
          ticket_medio: 0,
          desconto_medio: 0,
          faturamento_bruto: 0,
          faturamento_liquido: 0
        }
      }

      const diasUnicos = new Set(vendasFiltradas.map(v => {
        // Extrair apenas a data (YYYY-MM-DD) independente do formato
        const dataStr = v.vd_hrabertura.substring(0, 10)
        return dataStr
      })).size
      const clientesUnicos = new Set(vendasFiltradas.map(v => getClienteId(v))).size
      const totalComandas = vendasFiltradas.length
      const somaValores = vendasFiltradas.reduce((acc, v) => acc + (parseFloat(v.vd_vrcheio) || 0), 0)
      const somaDescontos = vendasFiltradas.reduce((acc, v) => acc + (parseFloat(v.vd_vrdescontos) || 0), 0)

      return {
        total_comandas: totalComandas,
        total_dias: diasUnicos,
        clientes_unicos: clientesUnicos,
        ticket_medio: somaValores / totalComandas,
        desconto_medio: somaDescontos / totalComandas,
        faturamento_bruto: somaValores,
        faturamento_liquido: somaValores - somaDescontos
      }
    }

    // Filtrar por dia da semana
    const vendasQuartas = vendasData.filter(v => new Date(v.vd_hrabertura).getDay() === 3)
    const vendasSextas = vendasData.filter(v => new Date(v.vd_hrabertura).getDay() === 5)
    console.log(`📅 Quartas: ${vendasQuartas.length}, Sextas: ${vendasSextas.length}`)

    // Processar quartas
    const quartasAntes = vendasQuartas.filter(v => v.vd_hrabertura.substring(0, 10) < DATAS_ENTRADA.quarta)
    const quartasDepois = vendasQuartas.filter(v => v.vd_hrabertura.substring(0, 10) >= DATAS_ENTRADA.quarta)
    console.log(`🔵 Quartas ANTES: ${quartasAntes.length}, DEPOIS: ${quartasDepois.length}`)
    console.log(`📅 Data de corte: ${DATAS_ENTRADA.quarta}`)
    if (vendasQuartas.length > 0) {
      console.log(`📅 Primeira venda quarta: ${vendasQuartas[0].vd_hrabertura}`)
      console.log(`📅 Última venda quarta: ${vendasQuartas[vendasQuartas.length - 1].vd_hrabertura}`)
    }
    const metricsQuartasAntes = calcularMetricas(quartasAntes)
    const metricsQuartasDepois = calcularMetricas(quartasDepois)
    
    const clientesQuartasAntes = new Set(quartasAntes.map(v => getClienteId(v)))
    const clientesQuartasDepois = new Set(quartasDepois.map(v => getClienteId(v)))
    const retornaramQuartas = [...clientesQuartasAntes].filter(id => clientesQuartasDepois.has(id)).length
    const novosQuartas = [...clientesQuartasDepois].filter(id => !clientesQuartasAntes.has(id)).length
    
    // Baseline quartas (set → out)
    const quartasSetembro = vendasQuartas.filter(v => {
      const data = v.vd_hrabertura.substring(0, 10)
      return data >= '2025-09-01' && data < '2025-10-01'
    })
    const quartasOutubro = vendasQuartas.filter(v => {
      const data = v.vd_hrabertura.substring(0, 10)
      return data >= '2025-10-01' && data < '2025-11-01'
    })
    const clientesQuartasSet = new Set(quartasSetembro.map(v => getClienteId(v)))
    const clientesQuartasOut = new Set(quartasOutubro.map(v => getClienteId(v)))
    const retornaramSetOutQuartas = [...clientesQuartasSet].filter(id => clientesQuartasOut.has(id)).length

    // Recorrência pós-entrada (quartas)
    const clientesRecorrentesQuartasDepois = [...clientesQuartasDepois].filter(id => {
      const visitas = quartasDepois.filter(v => getClienteId(v) === id).length
      return visitas > 1
    }).length

    // Processar sextas
    const sextasAntes = vendasSextas.filter(v => v.vd_hrabertura.substring(0, 10) < DATAS_ENTRADA.sexta)
    const sextasDepois = vendasSextas.filter(v => v.vd_hrabertura.substring(0, 10) >= DATAS_ENTRADA.sexta)
    const metricsSextasAntes = calcularMetricas(sextasAntes)
    const metricsSextasDepois = calcularMetricas(sextasDepois)
    
    const clientesSextasAntes = new Set(sextasAntes.map(v => getClienteId(v)))
    const clientesSextasDepois = new Set(sextasDepois.map(v => getClienteId(v)))
    const retornaramSextas = [...clientesSextasAntes].filter(id => clientesSextasDepois.has(id)).length
    const novosSextas = [...clientesSextasDepois].filter(id => !clientesSextasAntes.has(id)).length

    // Baseline sextas (set → out)
    const sextasSetembro = vendasSextas.filter(v => {
      const data = v.vd_hrabertura.substring(0, 10)
      return data >= '2025-09-01' && data < '2025-10-01'
    })
    const sextasOutubro = vendasSextas.filter(v => {
      const data = v.vd_hrabertura.substring(0, 10)
      return data >= '2025-10-01' && data < '2025-11-01'
    })
    const clientesSextasSet = new Set(sextasSetembro.map(v => getClienteId(v)))
    const clientesSextasOut = new Set(sextasOutubro.map(v => getClienteId(v)))
    const retornaramSextasSetOut = [...clientesSextasSet].filter(id => clientesSextasOut.has(id)).length

    // Recorrência pós-entrada (sextas)
    const clientesRecorrentesSextasDepois = [...clientesSextasDepois].filter(id => {
      const visitas = sextasDepois.filter(v => getClienteId(v) === id).length
      return visitas > 1
    }).length

    const tempoMs = Date.now() - startTime

    console.log(`📊 Métricas Quartas DEPOIS:`, metricsQuartasDepois)

    // Gerar dados de evolução semanal (por data)
    const gerarEvolucao = (vendas: any[]) => {
      const vendasPorData = new Map<string, any[]>()
      
      vendas.forEach(v => {
        const data = v.vd_hrabertura.substring(0, 10)
        if (!vendasPorData.has(data)) {
          vendasPorData.set(data, [])
        }
        vendasPorData.get(data)!.push(v)
      })
      
      return Array.from(vendasPorData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([data, vendasDia]) => {
          const clientesUnicos = new Set(vendasDia.map(v => getClienteId(v))).size
          const somaValores = vendasDia.reduce((acc, v) => acc + (parseFloat(v.vd_vrcheio) || 0), 0)
          const ticketMedio = somaValores / vendasDia.length
          
          return {
            data,
            periodo: data < DATAS_ENTRADA.quarta ? 'antes' : 'depois',
            comandas: vendasDia.length,
            clientes: clientesUnicos,
            ticket_medio: ticketMedio,
            faturamento: somaValores
          }
        })
    }
    
    const evolucaoQuartas = gerarEvolucao(vendasQuartas)
    const evolucaoSextas = gerarEvolucao(vendasSextas)

    // Formatar resposta
    const formatarMetricas = (stats: any, periodo: string) => {
      return {
        periodo,
        total_comandas: stats.total_comandas || 0,
        total_dias: stats.total_dias || 0,
        comandas_por_dia: stats.total_dias > 0 ? Math.round((stats.total_comandas / stats.total_dias) * 100) / 100 : 0,
        clientes_unicos_total: stats.clientes_unicos || 0,
        clientes_unicos_por_dia: stats.total_dias > 0 ? Math.round((stats.clientes_unicos / stats.total_dias) * 100) / 100 : 0,
        ticket_medio: stats.ticket_medio || 0,
        desconto_medio: stats.desconto_medio || 0,
        ticket_liquido: (stats.ticket_medio || 0) - (stats.desconto_medio || 0),
        faturamento_bruto_total: stats.faturamento_bruto || 0,
        faturamento_bruto_por_dia: stats.total_dias > 0 ? Math.round((stats.faturamento_bruto / stats.total_dias) * 100) / 100 : 0,
        faturamento_liquido_total: stats.faturamento_liquido || 0,
        faturamento_liquido_por_dia: stats.total_dias > 0 ? Math.round((stats.faturamento_liquido / stats.total_dias) * 100) / 100 : 0
      }
    }

    return NextResponse.json({
      success: true,
      datasEntrada: DATAS_ENTRADA,
      quartas: {
        ticket: [
          formatarMetricas(metricsQuartasAntes, 'antes'),
          formatarMetricas(metricsQuartasDepois, 'depois')
        ],
        recorrencia: {
          clientes_antes: clientesQuartasAntes.size,
          clientes_depois: clientesQuartasDepois.size,
          retornaram: retornaramQuartas,
          novos_clientes: novosQuartas,
          deixaram_de_ir: clientesQuartasAntes.size - retornaramQuartas,
          dias_antes: metricsQuartasAntes.total_dias,
          dias_depois: metricsQuartasDepois.total_dias,
          clientes_recorrentes_depois: clientesRecorrentesQuartasDepois,
          clientes_uma_vez_depois: clientesQuartasDepois.size - clientesRecorrentesQuartasDepois,
          taxa_recorrencia_depois: clientesQuartasDepois.size > 0 
            ? Math.round((clientesRecorrentesQuartasDepois / clientesQuartasDepois.size) * 1000) / 10 
            : 0
        },
        evolucao: evolucaoQuartas,
        baseline: {
          clientes_setembro: clientesQuartasSet.size,
          retornaram_outubro: retornaramSetOutQuartas
        }
      },
      sextas: {
        ticket: [
          formatarMetricas(metricsSextasAntes, 'antes'),
          formatarMetricas(metricsSextasDepois, 'depois')
        ],
        recorrencia: {
          clientes_antes: clientesSextasAntes.size,
          clientes_depois: clientesSextasDepois.size,
          retornaram: retornaramSextas,
          novos_clientes: novosSextas,
          deixaram_de_ir: clientesSextasAntes.size - retornaramSextas,
          dias_antes: metricsSextasAntes.total_dias,
          dias_depois: metricsSextasDepois.total_dias,
          clientes_recorrentes_depois: clientesRecorrentesSextasDepois,
          clientes_uma_vez_depois: clientesSextasDepois.size - clientesRecorrentesSextasDepois,
          taxa_recorrencia_depois: clientesSextasDepois.size > 0 
            ? Math.round((clientesRecorrentesSextasDepois / clientesSextasDepois.size) * 1000) / 10 
            : 0
        },
        evolucao: evolucaoSextas,
        baseline: {
          clientes_setembro: clientesSextasSet.size,
          retornaram_outubro: retornaramSextasSetOut
        }
      },
      tempo_processamento_ms: tempoMs
    })

  } catch (error) {
    console.error('❌ Erro interno na API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao buscar dados de análise' 
    }, { status: 500 })
  }
}
