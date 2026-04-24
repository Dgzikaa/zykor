import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { silver } from '@/lib/medallion/silver'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

// Cache por 3 minutos para dados de clientes
export const revalidate = 180;

export async function GET(request: NextRequest) {
  try {
    // Autenticar usuário
    const user = await authenticateUser(request)
    if (!user) {
      return authErrorResponse('Usuário não autenticado')
    }
    
    const supabase = await getAdminClient()
    const silverDb = await silver()

    // Buscar bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id')
    let barIdFilter: number | null = null
    if (barIdHeader) {
      barIdFilter = parseInt(barIdHeader, 10) || null
    }

    // Obter filtros da URL
    const { searchParams } = new URL(request.url)
    const diaSemanaFiltro = searchParams.get('dia_semana')
    const buscaCliente = searchParams.get('busca')?.trim() || ''

    // Paginação
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    // bar_id é OBRIGATÓRIO
    if (!barIdFilter) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório. Selecione um bar.' },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    let query = silverDb
        .from('cliente_estatisticas')
        .select('*', { count: 'exact' })
        .eq('bar_id', barIdFilter)
      
      // Se tiver busca, filtrar por nome ou telefone
      if (buscaCliente) {
        query = query.or(`cliente_nome.ilike.%${buscaCliente}%,cliente_fone_norm.ilike.%${buscaCliente}%`)
      }
      
      // Ordenar e limitar
      const { data: clientesCache, count: totalCount, error: cacheError } = await query
        .order('total_visitas', { ascending: false })
        .range(from, to)

      if (cacheError) {
        console.error('❌ Erro ao buscar cache:', cacheError)
        // Fallback para método antigo se cache falhar
      } else if (clientesCache && clientesCache.length > 0) {
        const tempoMs = Date.now() - startTime
        // Formatar resposta
        const clientesFormatados = clientesCache.map(c => ({
          identificador_principal: c.cliente_fone_norm,
          nome_principal: c.cliente_nome,
          telefone: c.cliente_fone_norm,
          email: c.cliente_email,
          sistema: 'ContaHub',
          total_visitas: c.total_visitas,
          total_visitas_geral: c.total_visitas,
          visitas_formatadas: c.total_visitas.toString(),
          valor_total_gasto: (parseFloat(c.valor_total_consumo) || 0) + (parseFloat(c.valor_total_entrada) || 0),
          valor_total_entrada: parseFloat(c.valor_total_entrada) || 0,
          valor_total_consumo: parseFloat(c.valor_total_consumo) || 0,
          ticket_medio_geral: c.total_visitas > 0 
            ? ((parseFloat(c.valor_total_consumo) || 0) + (parseFloat(c.valor_total_entrada) || 0)) / c.total_visitas
            : 0,
          ticket_medio_entrada: parseFloat(c.ticket_medio_entrada) || 0,
          ticket_medio_consumo: parseFloat(c.ticket_medio_consumo) || 0,
          ultima_visita: c.ultima_visita,
          tempo_medio_estadia_minutos: parseFloat(c.tempo_medio_estadia_min) || 0,
          tempo_medio_estadia_formatado: c.tempo_medio_estadia_min > 0 
            ? `${Math.floor(c.tempo_medio_estadia_min / 60)}h ${Math.round(c.tempo_medio_estadia_min % 60)}min`
            : 'N/A',
          tempos_estadia_detalhados: [],
          total_visitas_com_tempo: 0
        }))

        // Calcular estatísticas usando agregação SQL (mais eficiente)
        const { data: statsAgg, error: statsError } = await supabase
          .rpc('get_cliente_stats_agregado', { p_bar_id: barIdFilter })
        
        let totalClientes = 0
        let totalVisitas = 0
        let totalGasto = 0
        let totalEntrada = 0
        let totalConsumo = 0
        
        if (statsError) {
          // Fallback: buscar contagem total
          const { count } = await silverDb
            .from('cliente_estatisticas')
            .select('*', { count: 'exact', head: true })
            .eq('bar_id', barIdFilter)
          
          totalClientes = count || 0
          
          // Buscar somas com paginação
          const pageSize = 1000
          let offset = 0
          let hasMore = true
          
          while (hasMore) {
            const { data: statsPage } = await silverDb
              .from('cliente_estatisticas')
              .select('total_visitas, valor_total_entrada, valor_total_consumo')
              .eq('bar_id', barIdFilter)
              .range(offset, offset + pageSize - 1)
            
            if (!statsPage || statsPage.length === 0) {
              hasMore = false
            } else {
              totalVisitas += statsPage.reduce((sum, c) => sum + (c.total_visitas || 0), 0)
              totalGasto += statsPage.reduce((sum, c) => sum + 
                (parseFloat(c.valor_total_entrada) || 0) + 
                (parseFloat(c.valor_total_consumo) || 0), 0)
              totalEntrada += statsPage.reduce((sum, c) => sum + (parseFloat(c.valor_total_entrada) || 0), 0)
              totalConsumo += statsPage.reduce((sum, c) => sum + (parseFloat(c.valor_total_consumo) || 0), 0)
              
              if (statsPage.length < pageSize) {
                hasMore = false
              } else {
                offset += pageSize
              }
            }
          }
        } else if (statsAgg && statsAgg.length > 0) {
          totalClientes = statsAgg[0].total_clientes_unicos || 0
          totalVisitas = statsAgg[0].total_visitas_geral || 0
          totalGasto = parseFloat(statsAgg[0].valor_total_geral) || 0
          totalEntrada = parseFloat(statsAgg[0].valor_total_entrada) || 0
          totalConsumo = parseFloat(statsAgg[0].valor_total_consumo) || 0
        }

        return NextResponse.json({
          clientes: clientesFormatados,
          estatisticas: {
            total_clientes_unicos: totalClientes,
            total_visitas_geral: totalVisitas,
            ticket_medio_geral: totalVisitas > 0 ? totalGasto / totalVisitas : 0,
            ticket_medio_entrada: totalVisitas > 0 ? totalEntrada / totalVisitas : 0,
            ticket_medio_consumo: totalVisitas > 0 ? totalConsumo / totalVisitas : 0,
            valor_total_entrada: totalEntrada,
            valor_total_consumo: totalConsumo,
          },
          fonte: 'cache',
          tempo_ms: tempoMs,
          meta: {
            page,
            limit,
            total: totalCount || 0,
            totalPages: Math.ceil((totalCount || 0) / limit)
          }
        })
      } else {
        // Cache vazio - disparar sync (não bloquear resposta)
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-cliente-estatisticas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ bar_id: barIdFilter })
        }).catch(err => console.warn('Erro ao disparar sync:', err))
      }

    // ========== FALLBACK: MÉTODO ANTIGO (para filtros por dia da semana) ==========
    const pageSize = 1000
    let offset = 0
    let totalLinhas = 0
    const map = new Map<string, { nome: string; fone: string; visitas: number; visitasTotal: number; ultima: string; totalEntrada: number; totalConsumo: number; totalGasto: number; temposEstadia: number[]; tempoMedioEstadia: number }>()
    const mapTotal = new Map<string, number>()

    const MAX_ITERATIONS = 500
    let iterations = 0
    const MAX_PROCESSING_TIME = 60000

    while (iterations < MAX_ITERATIONS) {
      iterations++
      
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        break
      }
      
      const { data, error } = await silverDb
        .from('cliente_visitas')
        .select('cliente_nome, cliente_fone, data_visita, valor_couvert, valor_pagamentos')
        .eq('bar_id', barIdFilter)
        .eq('tem_telefone', true)
        .range(offset, offset + pageSize - 1)
      
      if (error) {
        console.error('❌ Erro na consulta:', error)
        return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
      }
      
      if (!data || data.length === 0) break
      
      for (const r of data) {
        const rawFone = (r.cliente_fone || '').toString().trim()
        if (!rawFone) continue
        
        let fone = rawFone.replace(/\D/g, '')
        if (!fone) continue
        
        // Normalizar telefone
        if (fone.length === 10 && ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'].includes(fone.substring(0, 2))) {
          fone = fone.substring(0, 2) + '9' + fone.substring(2)
        }
        
        mapTotal.set(fone, (mapTotal.get(fone) || 0) + 1)
        
        // Aplicar filtro de dia da semana
        const dataVisita = new Date(r.data_visita + 'T12:00:00Z')
        const diaSemanaData = dataVisita.getUTCDay()
        
        if (diaSemanaFiltro && diaSemanaFiltro !== 'todos') {
          if (diaSemanaData.toString() !== diaSemanaFiltro) continue
        }
        
        totalLinhas++
        
        const nome = (r.cliente_nome || '').toString().trim() || 'Sem nome'
        const ultima = r.data_visita as string
        const vrCouvert = parseFloat(r.valor_couvert || '0') || 0
        const vrPagamentos = parseFloat(r.valor_pagamentos || '0') || 0
        const vrConsumo = vrPagamentos - vrCouvert

        const prev = map.get(fone)
        if (!prev) {
          map.set(fone, { 
            nome, fone, visitas: 1, 
            visitasTotal: mapTotal.get(fone) || 1,
            ultima, totalEntrada: vrCouvert, totalConsumo: vrConsumo, totalGasto: vrPagamentos,
            temposEstadia: [], tempoMedioEstadia: 0
          })
        } else {
          prev.visitas++
          prev.visitasTotal = mapTotal.get(fone) || prev.visitas
          prev.totalEntrada += vrCouvert
          prev.totalConsumo += vrConsumo
          prev.totalGasto += vrPagamentos
          if (ultima > prev.ultima) prev.ultima = ultima
          if (nome && nome !== 'Sem nome' && nome.length > prev.nome.length) prev.nome = nome
        }
      }
      
      if (data.length < pageSize) break
      offset += pageSize
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Buscar tempos de estadia (migrado para visitas)
    const temposPorTelefone = new Map<string, number[]>()
    let tempoOffset = 0
    let tempoIterations = 0

    while (tempoIterations < 200) {
      tempoIterations++
      
      const { data: vendas, error: vendasError } = await silverDb
        .from('cliente_visitas')
        .select('cliente_fone, tempo_estadia_minutos')
        .eq('bar_id', barIdFilter)
        .eq('tem_telefone', true)
        .gt('tempo_estadia_minutos', 0)
        .lt('tempo_estadia_minutos', 720)
        .range(tempoOffset, tempoOffset + 999)
      
      if (vendasError || !vendas || vendas.length === 0) break
      
      for (const v of vendas) {
        let foneVenda = (v.cliente_fone || '').toString().replace(/\D/g, '')
        if (!foneVenda) continue
        
        if (foneVenda.length === 10) {
          const ddd = foneVenda.substring(0, 2)
          if (['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'].includes(ddd)) {
            foneVenda = ddd + '9' + foneVenda.substring(2)
          }
        }
        
        if (!temposPorTelefone.has(foneVenda)) {
          temposPorTelefone.set(foneVenda, [])
        }
        temposPorTelefone.get(foneVenda)!.push(Math.round(v.tempo_estadia_minutos))
      }
      
      if (vendas.length < 1000) break
      tempoOffset += 1000
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Aplicar tempos aos clientes
    for (const [fone, cliente] of map.entries()) {
      const tempos = temposPorTelefone.get(fone)
      if (tempos && tempos.length > 0) {
        cliente.temposEstadia = tempos
        cliente.tempoMedioEstadia = tempos.reduce((a, b) => a + b, 0) / tempos.length
      }
    }

    const clientes = Array.from(map.values())
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 100)
    
    const clientesFormatados = clientes.map(c => ({
      identificador_principal: c.fone,
      nome_principal: c.nome,
      telefone: c.fone,
      email: null,
      sistema: 'ContaHub',
      total_visitas: c.visitas,
      total_visitas_geral: c.visitasTotal,
      visitas_formatadas: diaSemanaFiltro && diaSemanaFiltro !== 'todos' 
        ? `${c.visitas}/${c.visitasTotal}` 
        : c.visitas.toString(),
      valor_total_gasto: c.totalGasto,
      valor_total_entrada: c.totalEntrada,
      valor_total_consumo: c.totalConsumo,
      ticket_medio_geral: c.visitas > 0 ? c.totalGasto / c.visitas : 0,
      ticket_medio_entrada: c.visitas > 0 ? c.totalEntrada / c.visitas : 0,
      ticket_medio_consumo: c.visitas > 0 ? c.totalConsumo / c.visitas : 0,
      ultima_visita: c.ultima,
      tempo_medio_estadia_minutos: c.tempoMedioEstadia,
      tempo_medio_estadia_formatado: c.tempoMedioEstadia > 0 
        ? `${Math.floor(c.tempoMedioEstadia / 60)}h ${Math.round(c.tempoMedioEstadia % 60)}min`
        : 'N/A',
      tempos_estadia_detalhados: c.temposEstadia,
      total_visitas_com_tempo: c.temposEstadia.length
    }))

    const totalEntradaGlobal = Array.from(map.values()).reduce((sum, c) => sum + c.totalEntrada, 0)
    const totalConsumoGlobal = Array.from(map.values()).reduce((sum, c) => sum + c.totalConsumo, 0)
    const totalGastoGlobal = Array.from(map.values()).reduce((sum, c) => sum + c.totalGasto, 0)

    const tempoMs = Date.now() - startTime
    return NextResponse.json({
      clientes: clientesFormatados,
      estatisticas: {
        total_clientes_unicos: map.size,
        total_visitas_geral: totalLinhas,
        ticket_medio_geral: totalLinhas > 0 ? totalGastoGlobal / totalLinhas : 0,
        ticket_medio_entrada: totalLinhas > 0 ? totalEntradaGlobal / totalLinhas : 0,
        ticket_medio_consumo: totalLinhas > 0 ? totalConsumoGlobal / totalLinhas : 0,
        valor_total_entrada: totalEntradaGlobal,
        valor_total_consumo: totalConsumoGlobal,
      },
      fonte: 'query',
      tempo_ms: tempoMs
    })
  } catch (error) {
    console.error('Erro na API de clientes:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
