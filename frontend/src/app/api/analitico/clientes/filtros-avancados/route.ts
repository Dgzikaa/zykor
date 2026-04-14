import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { authenticateUser, authErrorResponse } from '@/middleware/auth'

export const dynamic = 'force-dynamic'

interface FiltrosAvancados {
  dataInicio?: string
  dataFim?: string
  diasSemana?: string[] // ['0', '1', '6'] para domingo, segunda, sábado
  idadeMin?: number
  idadeMax?: number
  visitasMin?: number
  visitasMax?: number
  ticketMedioMin?: number
  ticketMedioMax?: number
  genero?: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    if (!user) {
      return authErrorResponse('Usuário não autenticado')
    }

    const supabase = await getAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar com banco' }, { status: 500 })
    }

    const barIdHeader = request.headers.get('x-selected-bar-id')
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const filtros: FiltrosAvancados = body.filtros || {}

    // Construir query base
    let query = `
      SELECT 
        cliente_fone,
        cliente_nome,
        cliente_email,
        cliente_dtnasc,
        data_visita,
        valor_pagamentos,
        valor_couvert,
        valor_consumo,
        EXTRACT(YEAR FROM AGE(data_visita::date, cliente_dtnasc)) as idade
      FROM visitas
      WHERE bar_id = ${barId}
        AND cliente_fone IS NOT NULL
        AND cliente_fone != ''
    `

    // Aplicar filtros de data
    if (filtros.dataInicio) {
      query += ` AND data_visita >= '${filtros.dataInicio}'`
    }
    if (filtros.dataFim) {
      query += ` AND data_visita <= '${filtros.dataFim}'`
    }

    // Filtrar por dias da semana
    if (filtros.diasSemana && filtros.diasSemana.length > 0) {
      const dias = filtros.diasSemana.map(d => `'${d}'`).join(',')
      query += ` AND EXTRACT(DOW FROM data_visita)::text IN (${dias})`
    }

    // Filtrar por idade (apenas registros com data de nascimento válida)
    if (filtros.idadeMin !== undefined || filtros.idadeMax !== undefined) {
      query += ` AND cliente_dtnasc IS NOT NULL`
      query += ` AND EXTRACT(YEAR FROM AGE(data_visita::date, cliente_dtnasc)) BETWEEN 15 AND 100`
      
      if (filtros.idadeMin !== undefined) {
        query += ` AND EXTRACT(YEAR FROM AGE(data_visita::date, cliente_dtnasc)) >= ${filtros.idadeMin}`
      }
      if (filtros.idadeMax !== undefined) {
        query += ` AND EXTRACT(YEAR FROM AGE(data_visita::date, cliente_dtnasc)) <= ${filtros.idadeMax}`
      }
    }

    query += ` ORDER BY data_visita DESC`

    const { data: visitasRaw, error: visitasError } = await supabase
      .from('visitas')
      .select('cliente_fone, cliente_nome, cliente_email, cliente_dtnasc, data_visita, valor_pagamentos, valor_couvert, valor_consumo')
      .eq('bar_id', barId)
      .not('cliente_fone', 'is', null)
      .neq('cliente_fone', '')

    if (visitasError) {
      console.error('Erro ao buscar visitas:', visitasError)
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
    }

    let visitas = (visitasRaw || []) as any[]

    // Aplicar filtros de data
    if (filtros.dataInicio) {
      const dataInicioStr = filtros.dataInicio
      visitas = visitas.filter(v => v.data_visita >= dataInicioStr)
    }
    if (filtros.dataFim) {
      const dataFimStr = filtros.dataFim
      visitas = visitas.filter(v => v.data_visita <= dataFimStr)
    }

    // Aplicar filtro de dia da semana
    if (filtros.diasSemana && filtros.diasSemana.length > 0) {
      visitas = visitas.filter(v => {
        const data = new Date(v.data_visita + 'T12:00:00Z')
        const diaSemana = data.getUTCDay().toString()
        return filtros.diasSemana!.includes(diaSemana)
      })
    }

    // Calcular idade e filtrar
    visitas = visitas.map(v => {
      if (v.cliente_dtnasc) {
        const dataNasc = new Date(v.cliente_dtnasc)
        const dataVisita = new Date(v.data_visita)
        const idade = dataVisita.getFullYear() - dataNasc.getFullYear()
        const mes = dataVisita.getMonth() - dataNasc.getMonth()
        const ajusteIdade = mes < 0 || (mes === 0 && dataVisita.getDate() < dataNasc.getDate()) ? -1 : 0
        v.idade = idade + ajusteIdade
      }
      return v
    })

    // Filtrar por idade
    if (filtros.idadeMin !== undefined || filtros.idadeMax !== undefined) {
      visitas = visitas.filter(v => {
        if (!v.idade || v.idade < 15 || v.idade > 100) return false
        if (filtros.idadeMin !== undefined && v.idade < filtros.idadeMin) return false
        if (filtros.idadeMax !== undefined && v.idade > filtros.idadeMax) return false
        return true
      })
    }

    // Agrupar por cliente
    const clientesMap = new Map<string, {
      telefone: string
      nome: string
      email: string | null
      dtnasc: string | null
      visitas: number
      totalGasto: number
      totalEntrada: number
      totalConsumo: number
      idades: number[]
      datasVisitas: string[]
    }>()

    for (const v of visitas) {
      const fone = (v.cliente_fone || '').toString().replace(/\D/g, '')
      if (!fone) continue

      if (!clientesMap.has(fone)) {
        clientesMap.set(fone, {
          telefone: fone,
          nome: v.cliente_nome || 'Sem nome',
          email: v.cliente_email || null,
          dtnasc: v.cliente_dtnasc || null,
          visitas: 0,
          totalGasto: 0,
          totalEntrada: 0,
          totalConsumo: 0,
          idades: [],
          datasVisitas: []
        })
      }

      const cliente = clientesMap.get(fone)!
      cliente.visitas++
      cliente.totalGasto += parseFloat(v.valor_pagamentos || '0')
      cliente.totalEntrada += parseFloat(v.valor_couvert || '0')
      cliente.totalConsumo += parseFloat(v.valor_consumo || '0')
      cliente.datasVisitas.push(v.data_visita)
      
      if (v.idade && v.idade >= 15 && v.idade <= 100) {
        cliente.idades.push(v.idade)
      }

      // Atualizar nome se for mais completo
      if (v.cliente_nome && v.cliente_nome.length > cliente.nome.length) {
        cliente.nome = v.cliente_nome
      }
    }

    // Converter para array e aplicar filtros de agregação
    let clientes = Array.from(clientesMap.values())

    // Filtrar por número de visitas
    if (filtros.visitasMin !== undefined) {
      clientes = clientes.filter(c => c.visitas >= filtros.visitasMin!)
    }
    if (filtros.visitasMax !== undefined) {
      clientes = clientes.filter(c => c.visitas <= filtros.visitasMax!)
    }

    // Filtrar por ticket médio
    if (filtros.ticketMedioMin !== undefined || filtros.ticketMedioMax !== undefined) {
      clientes = clientes.filter(c => {
        const ticketMedio = c.visitas > 0 ? c.totalGasto / c.visitas : 0
        if (filtros.ticketMedioMin !== undefined && ticketMedio < filtros.ticketMedioMin) return false
        if (filtros.ticketMedioMax !== undefined && ticketMedio > filtros.ticketMedioMax) return false
        return true
      })
    }

    // Calcular estatísticas
    const totalClientes = clientes.length
    const totalVisitas = clientes.reduce((sum, c) => sum + c.visitas, 0)
    const totalGasto = clientes.reduce((sum, c) => sum + c.totalGasto, 0)
    
    // Calcular idade média (apenas clientes com idade)
    const clientesComIdade = clientes.filter(c => c.idades.length > 0)
    const todasIdades = clientesComIdade.flatMap(c => c.idades)
    const idadeMedia = todasIdades.length > 0 
      ? todasIdades.reduce((sum, idade) => sum + idade, 0) / todasIdades.length 
      : null

    // Calcular mediana de idade
    let medianaIdade: number | null = null
    if (todasIdades.length > 0) {
      const sorted = [...todasIdades].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      medianaIdade = sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid]
    }

    // Distribuição por faixa etária
    const faixasEtarias = {
      '15-19': 0,
      '20-24': 0,
      '25-29': 0,
      '30-34': 0,
      '35-39': 0,
      '40-44': 0,
      '45-49': 0,
      '50-59': 0,
      '60+': 0
    }

    for (const idade of todasIdades) {
      if (idade < 20) faixasEtarias['15-19']++
      else if (idade < 25) faixasEtarias['20-24']++
      else if (idade < 30) faixasEtarias['25-29']++
      else if (idade < 35) faixasEtarias['30-34']++
      else if (idade < 40) faixasEtarias['35-39']++
      else if (idade < 45) faixasEtarias['40-44']++
      else if (idade < 50) faixasEtarias['45-49']++
      else if (idade < 60) faixasEtarias['50-59']++
      else faixasEtarias['60+']++
    }

    // Formatar clientes para resposta
    const clientesFormatados = clientes
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 500) // Limitar a 500 clientes
      .map(c => ({
        telefone: c.telefone,
        nome: c.nome,
        email: c.email,
        dtnasc: c.dtnasc,
        idadeMedia: c.idades.length > 0 
          ? Math.round(c.idades.reduce((sum, i) => sum + i, 0) / c.idades.length) 
          : null,
        visitas: c.visitas,
        ticketMedio: c.visitas > 0 ? c.totalGasto / c.visitas : 0,
        totalGasto: c.totalGasto,
        totalEntrada: c.totalEntrada,
        totalConsumo: c.totalConsumo,
        ultimaVisita: c.datasVisitas[0]
      }))

    return NextResponse.json({
      success: true,
      clientes: clientesFormatados,
      estatisticas: {
        totalClientes,
        totalVisitas,
        totalGasto,
        ticketMedio: totalVisitas > 0 ? totalGasto / totalVisitas : 0,
        clientesComIdade: clientesComIdade.length,
        percentualComIdade: totalClientes > 0 
          ? Math.round((clientesComIdade.length / totalClientes) * 100) 
          : 0,
        idadeMedia: idadeMedia ? Math.round(idadeMedia * 10) / 10 : null,
        medianaIdade: medianaIdade ? Math.round(medianaIdade) : null,
        faixasEtarias
      },
      filtrosAplicados: filtros
    })

  } catch (error) {
    console.error('Erro na API de filtros avançados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
