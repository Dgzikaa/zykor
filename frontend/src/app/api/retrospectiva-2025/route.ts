import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Cache simples em memória (válido por 5 minutos)
let cache: { data: any; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos
// Reset cache on deploy - v13 (correção insights completos)
const CACHE_VERSION = 27

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Iniciando GET /api/retrospectiva-2025')
    
    // Verificar cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log('📦 Retornando dados do cache')
      return NextResponse.json({ success: true, data: cache.data, cached: true })
    }

    console.log('✅ Cliente administrativo Supabase inicializado')
    const supabase = await getAdminClient()
    if (!supabase) {
      console.error('❌ Falha ao obter cliente Supabase')
      return NextResponse.json({ error: 'Erro ao conectar com banco' }, { status: 500 })
    }

    const startTime = Date.now()

    console.log('🔍 Iniciando busca de dados da retrospectiva 2025 (OTIMIZADA)...')

    // ============================================
    // USAR STORED PROCEDURES OTIMIZADAS
    // ============================================

    // 1. Dados principais (financeiro, operacional, cultura, marketing)
    console.log('📊 Buscando dados principais...')
    let t1 = Date.now()
    const { data: dadosPrincipais, error: erroPrincipal } = await supabase
      .rpc('get_retrospectiva_2025', { p_bar_id: 3 })
    console.log(`⏱️ Dados principais: ${Date.now() - t1}ms`)

    if (erroPrincipal) {
      console.error('❌ Erro ao buscar dados principais:', erroPrincipal)
      throw erroPrincipal
    }

    console.log(`✅ Dados principais carregados:`, dadosPrincipais ? 'OK' : 'NULL')

    // 2. Evolução mensal
    t1 = Date.now()
    const { data: evolucaoMensal, error: erroEvolucao } = await supabase
      .rpc('get_retrospectiva_evolucao_mensal', { p_bar_id: 3 })
    console.log(`⏱️ Evolução mensal: ${Date.now() - t1}ms`)

    if (erroEvolucao) {
      console.error('❌ Erro ao buscar evolução mensal:', erroEvolucao)
    }

    // 3. Clientes por mês
    t1 = Date.now()
    const { data: clientesMes, error: erroClientes } = await supabase
      .rpc('get_retrospectiva_clientes_mes', { p_bar_id: 3 })
    console.log(`⏱️ Clientes por mês: ${Date.now() - t1}ms`)

    if (erroClientes) {
      console.error('❌ Erro ao buscar clientes por mês:', erroClientes)
    }

    // 4. Top produtos
    console.log('🏆 Buscando top produtos...')
    t1 = Date.now()
    const { data: topProdutos, error: erroProdutos } = await supabase
      .rpc('get_retrospectiva_top_produtos', { p_bar_id: 3, p_limit: 15 })
    console.log(`⏱️ Top produtos: ${Date.now() - t1}ms`)

    if (erroProdutos) {
      console.error('❌ Erro ao buscar top produtos:', erroProdutos)
    }
    console.log(`✅ Top produtos:`, topProdutos ? `${topProdutos.length} produtos` : 'null')

    // 5. Vendas por categoria
    console.log('📦 Buscando vendas por categoria...')
    t1 = Date.now()
    const { data: vendasCategoria, error: erroCategorias } = await supabase
      .rpc('get_retrospectiva_vendas_categoria', { p_bar_id: 3 })
    console.log(`⏱️ Vendas por categoria: ${Date.now() - t1}ms`)

    if (erroCategorias) {
      console.error('❌ Erro ao buscar vendas por categoria:', erroCategorias)
    }
    console.log(`✅ Vendas por categoria:`, vendasCategoria ? `${vendasCategoria.length} categorias` : 'null')

    // 6. INSIGHTS ESTRATÉGICOS - Queries diretas otimizadas
    console.log('🔍 Buscando insights estratégicos...')
    const insightsStart = Date.now()
    
    const [
      { data: recordesFat },
      { data: recordesPub },
      { data: recordesTicket },
      { data: todosClientes },
      { data: todosEventos },
      { data: eventosBase }
    ] = await Promise.all([
      // Maior faturamento
      supabase.from('eventos')
        .select('faturamento_liquido, nome_evento, data_evento')
        .eq('bar_id', 3)
        .gte('data_evento', '2025-01-01')
        .lte('data_evento', '2025-12-31')
        .order('faturamento_liquido', { ascending: false })
        .limit(1)
        .single(),
      
      // Maior público
      supabase.from('eventos')
        .select('publico_real, nome_evento, data_evento')
        .eq('bar_id', 3)
        .gte('data_evento', '2025-01-01')
        .lte('data_evento', '2025-12-31')
        .order('publico_real', { ascending: false })
        .limit(1)
        .single(),
      
      // Melhor ticket
      supabase.from('eventos')
        .select('t_medio, nome_evento, publico_real')
        .eq('bar_id', 3)
        .gte('data_evento', '2025-01-01')
        .lte('data_evento', '2025-12-31')
        .order('t_medio', { ascending: false })
        .limit(1)
        .single(),
      
      // Buscar todos os clientes (para agregar no código)
      supabase.from('contahub_periodo')
        .select('cli_nome, vr_pagamentos, dt_gerencial')
        .eq('bar_id', 3)
        .gte('dt_gerencial', '2025-01-01')
        .lte('dt_gerencial', '2025-12-31')
        .not('cli_nome', 'is', null)
        .neq('cli_nome', ''),
      
      // Buscar todos os eventos (para performance por dia)
      supabase.from('eventos')
        .select('data_evento, faturamento_liquido, publico_real, t_medio')
        .eq('bar_id', 3)
        .gte('data_evento', '2025-01-01')
        .lte('data_evento', '2025-12-31'),
      
      // Buscar eventos_base para artistas
      supabase.from('eventos_base')
        .select('artista, real_r, publico_real, data_evento')
        .eq('bar_id', 3)
        .gte('data_evento', '2025-01-01')
        .lte('data_evento', '2025-12-31')
        .not('artista', 'is', null)
        .neq('artista', '')
    ])
    
    // Agregar clientes no código
    const clientesMap = new Map()
    todosClientes?.forEach((row: any) => {
      const nome = row.cli_nome
      if (!clientesMap.has(nome)) {
        clientesMap.set(nome, { 
          nome, 
          totalgasto: 0, 
          visitas: new Set()
        })
      }
      const cliente = clientesMap.get(nome)
      cliente.totalgasto += Number(row.vr_pagamentos) || 0
      cliente.visitas.add(row.dt_gerencial)
    })
    
    const topClientes = Array.from(clientesMap.values())
      .map(c => ({
        nome: c.nome,
        totalgasto: c.totalgasto,
        visitas: c.visitas.size,
        ticketmedio: c.totalgasto / c.visitas.size,
        horasmedia: 2.5
      }))
      .sort((a, b) => b.totalgasto - a.totalgasto)
      .slice(0, 10)
    
    const clientesFieis = Array.from(clientesMap.values())
      .map(c => ({
        nome: c.nome,
        visitas: c.visitas.size,
        totalgasto: c.totalgasto,
        horasmedia: 2.5
      }))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 10)
    
    // Agregar artistas
    const artistasMap = new Map()
    eventosBase?.forEach((evt: any) => {
      const artista = evt.artista
      if (!artistasMap.has(artista)) {
        artistasMap.set(artista, {
          shows: 0,
          publicos: [],
          faturamentos: []
        })
      }
      const data = artistasMap.get(artista)
      data.shows += 1
      data.publicos.push(Number(evt.publico_real) || 0)
      data.faturamentos.push(Number(evt.real_r) || 0)
    })
    
    const topArtistas = Array.from(artistasMap.entries())
      .filter(([_, d]) => d.shows >= 2)
      .map(([nome, d]) => ({
        artista: nome,
        shows: d.shows,
        mediapublico: Math.round(d.publicos.reduce((a, b) => a + b, 0) / d.publicos.length),
        mediafaturamento: Math.round(d.faturamentos.reduce((a, b) => a + b, 0) / d.faturamentos.length * 100) / 100
      }))
      .sort((a, b) => b.mediafaturamento - a.mediafaturamento)
      .slice(0, 15)
    
    // Performance por dia
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const perfDiaMap = new Map()
    
    todosEventos?.forEach((evt: any) => {
      const data = new Date(evt.data_evento + 'T12:00:00')
      const diaSemana = data.getDay()
      const diaNome = diasSemana[diaSemana]
      
      if (!perfDiaMap.has(diaSemana)) {
        perfDiaMap.set(diaSemana, {
          dia: diaNome,
          faturamento: 0,
          clientes: 0,
          eventos: 0,
          tickets: []
        })
      }
      
      const diaData = perfDiaMap.get(diaSemana)
      diaData.faturamento += Number(evt.faturamento_liquido) || 0
      diaData.clientes += Number(evt.publico_real) || 0
      diaData.eventos += 1
      diaData.tickets.push(Number(evt.t_medio) || 0)
    })
    
    const perfDia = Array.from(perfDiaMap.entries())
      .map(([ordem, d]) => ({
        dia: d.dia,
        faturamento: Math.round(d.faturamento * 100) / 100,
        clientes: d.clientes,
        ticketmedio: Math.round((d.tickets.reduce((a, b) => a + b, 0) / d.tickets.length) * 100) / 100,
        eventos: d.eventos
      }))
      .sort((a, b) => diasSemana.indexOf(a.dia) - diasSemana.indexOf(b.dia))
    
    console.log(`⏱️ Insights levaram ${Date.now() - insightsStart}ms`)
    console.log(`✅ Insights carregados: ${topClientes?.length || 0} clientes, ${topArtistas?.length || 0} artistas, ${perfDia?.length || 0} dias`)
    
    const insightsData = {
      recordes: {
        maiorFaturamentoDia: {
          valor: recordesFat?.faturamento_liquido || 0,
          evento: recordesFat?.nome_evento || '',
          data: recordesFat?.data_evento ? new Date(recordesFat.data_evento + 'T12:00:00').toLocaleDateString('pt-BR') : ''
        },
        maiorPublico: {
          clientes: recordesPub?.publico_real || 0,
          evento: recordesPub?.nome_evento || '',
          data: recordesPub?.data_evento ? new Date(recordesPub.data_evento + 'T12:00:00').toLocaleDateString('pt-BR') : ''
        },
        melhorTicketMedio: {
          ticket: recordesTicket?.t_medio || 0,
          evento: recordesTicket?.nome_evento || '',
          clientes: recordesTicket?.publico_real || 0
        },
        horarioPico: { hora: 22, faturamento: 0 }
      },
      topClientesGasto: topClientes || [],
      clientesMaisFieis: clientesFieis || [],
      topArtistas: topArtistas || [],
      performanceDiaSemana: perfDia || []
    }

    // 6b-6f. MEGA/ULTRA/EXTRAS INSIGHTS - DESABILITADOS (muito lentos)
    console.log('⚠️ Mega/Ultra/Extras insights desabilitados temporariamente')
    const megaInsightsData = null
    const oportunidadesData = null
    const adicionaisData = null
    const ultraInsightsData = null
    const extrasData = null

    // 7. Metas e OKRs (busca simples, poucos registros)
    const { data: visaoData } = await supabase
      .from('organizador_visao')
      .select('*')
      .eq('ano', 2025)
      .order('trimestre', { ascending: true, nullsFirst: true })

    const organizadorIds = visaoData?.map(v => v.id) || []
    
    const { data: okrsData } = organizadorIds.length > 0
      ? await supabase
          .from('organizador_okrs')
          .select('*')
          .in('organizador_id', organizadorIds)
          .order('ordem', { ascending: true })
      : { data: null }

    // ============================================
    // CONSOLIDAR DADOS
    // ============================================
    
    // Mesclar evolução mensal com clientes e adicionar nome do mês
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const evolucaoCompleta = (evolucaoMensal || []).map((mes: any) => {
      const clientesMesData = (clientesMes || []).find((c: any) => c.mes === mes.mes)
      return {
        ...mes,
        mesNome: mesesNomes[mes.mes - 1] || `Mês ${mes.mes}`,
        clientes: clientesMesData?.clientes || mes.clientes || 0
      }
    })

    // Extrair vendas individuais (usando nomes reais das categorias)
    const vendasCat = Array.isArray(vendasCategoria) ? vendasCategoria : []
    
    // Cervejas: Cervejas + Baldes + Happy Hour
    const cervejasData = vendasCat.filter((v: any) => 
      v && v.categoria && ['Cervejas', 'Baldes', 'Happy Hour'].includes(v.categoria)
    )
    const faturamentoCervejas = cervejasData.reduce((sum: number, v: any) => sum + (Number(v.faturamento_total) || 0), 0)
    const qtdCervejas = cervejasData.reduce((sum: number, v: any) => sum + (Number(v.quantidade_total) || 0), 0)
    
    // Drinks: Drinks Classicos + Drinks Autorais + Drinks sem Álcool + Doses + Dose Dupla
    const drinksData = vendasCat.filter((v: any) => 
      v && v.categoria && ['Drinks Classicos', 'Drinks Autorais', 'Drinks sem Álcool', 'Doses', 'Dose Dupla', 'Fest Moscow'].includes(v.categoria)
    )
    const faturamentoDrinks = drinksData.reduce((sum: number, v: any) => sum + (Number(v.faturamento_total) || 0), 0)
    const qtdDrinks = drinksData.reduce((sum: number, v: any) => sum + (Number(v.quantidade_total) || 0), 0)
    
    // Não Alcoólicos
    const naoAlcoolicosData = vendasCat.filter((v: any) => 
      v && v.categoria && ['Bebidas Não Alcoólicas', 'Bebidas Prontas'].includes(v.categoria)
    )
    const faturamentoNaoAlcoolicos = naoAlcoolicosData.reduce((sum: number, v: any) => sum + (Number(v.faturamento_total) || 0), 0)
    const qtdNaoAlcoolicos = naoAlcoolicosData.reduce((sum: number, v: any) => sum + (Number(v.quantidade_total) || 0), 0)
    
    // Comidas: Pratos + Sanduíches + Sobremesas + Combos
    const comidasData = vendasCat.filter((v: any) => 
      v && v.categoria && ['Pratos Para Compartilhar - P/ 4 Pessoas', 'Pratos Individuais', 'Sanduíches', 'Sobremesas', 'Combos'].includes(v.categoria)
    )
    const faturamentoComidas = comidasData.reduce((sum: number, v: any) => sum + (Number(v.faturamento_total) || 0), 0)
    const qtdComidas = comidasData.reduce((sum: number, v: any) => sum + (Number(v.quantidade_total) || 0), 0)
    
    const vendas = {
      cervejas: qtdCervejas,
      faturamentoCervejas,
      drinks: qtdDrinks,
      faturamentoDrinks,
      naoAlcoolicos: qtdNaoAlcoolicos,
      faturamentoNaoAlcoolicos,
      comidas: qtdComidas,
      faturamentoComidas,
    }

    // Calcular faturamento bebidas e comida
    const faturamentoBebidas = (vendas.faturamentoCervejas || 0) + (vendas.faturamentoDrinks || 0) + (vendas.faturamentoNaoAlcoolicos || 0)
    const faturamentoComida = vendas.faturamentoComidas || 0

    // TODO: Calcular base ativa corretamente (por enquanto usando totalClientes)
    // A função get_count_base_ativa está muito lenta, precisa otimização
    const clientesAtivosMedia = Math.round((dadosPrincipais.financeiro.totalClientes || 0) * 0.35) // Estimativa: 35% da base
    
    console.log(`✅ Base ativa estimada: ${clientesAtivosMedia}`)
    console.log(`✅ Total clientes únicos: ${dadosPrincipais.financeiro.totalClientes}`)

    const consolidado = {
      // FINANCEIRO (dados da stored procedure)
      financeiro: {
        ...dadosPrincipais.financeiro,
        faturamentoBebidas,
        faturamentoComida,
        // Corrigir: totalClientes = soma total, clientesAtivos = média da base ativa
        totalClientes: dadosPrincipais.financeiro.totalClientes,
        clientesAtivos: clientesAtivosMedia,
        cmvLimpoMedio: dadosPrincipais.financeiro.cmvMedio,
        percentualArtisticaMedio: dadosPrincipais.financeiro.artisticaMedio,
      },

      // OPERACIONAL
      operacional: {
        ...dadosPrincipais.operacional,
        ticketsVendidos: dadosPrincipais.operacional.totalIngressos || 0,
      },

      // PESSOAS E CULTURA
      pessoasCultura: dadosPrincipais.pessoasCultura,

      // MARKETING
      marketing: dadosPrincipais.marketing,

      // METAS E CONQUISTAS
      metas: {
        visaoGeral: visaoData?.find(v => !v.trimestre) || visaoData?.[0] || null,
        visaoCompleta: visaoData || [],
        okrs: okrsData?.map(okr => ({
          ...okr,
          progresso: okr.status === 'verde' ? 100 
                   : okr.status === 'amarelo' ? 60 
                   : okr.status === 'vermelho' ? 30 
                   : 0
        })) || [],
        okrsConcluidos: okrsData?.filter(okr => okr.status === 'verde').length || 0,
        okrsTotal: okrsData?.length || 0,
      },

      // PROBLEMAS E MELHORIAS
      problemasEMelhorias: visaoData?.map((v: any) => ({
        trimestre: v.trimestre || 'Anual',
        ano: v.ano,
        problemas: v.principais_problemas || [],
        metasDefinidas: {
          faturamento: v.faturamento_meta,
          clientes: v.meta_clientes_ativos,
          cmv: v.meta_cmv_limpo,
          cmo: v.meta_cmo,
          artistica: v.meta_artistica,
        },
        imagemObjetivo: v.imagem_1_ano || v.imagem_3_anos || null
      })) || [],

      // EVOLUÇÃO MENSAL
      evolucaoMensal: evolucaoCompleta,

      // TOP PRODUTOS
      topProdutos: topProdutos || [],

      // VENDAS POR CATEGORIA
      vendasPorCategoria: vendasCategoria || [],

      // VENDAS INDIVIDUAIS
      vendas,

      // INSIGHTS ESTRATÉGICOS COMPLETOS 360°
      insights: insightsData || {
        recordes: null,
        topClientesGasto: [],
        clientesMaisFieis: [],
        topEventos: [],
        performanceDiaSemana: [],
        topArtistas: [],
        topProdutos: [],
        topDrinks: [],
        topComidas: [],
        horariosPico: [],
        datasChave: [],
        tempoProducao: null,
        estatisticas: null,
      },

      // MEGA INSIGHTS 360° (25 categorias)
      megaInsights: megaInsightsData || null,

      // OPORTUNIDADES E AÇÕES ESTRATÉGICAS 2026
      oportunidades: oportunidadesData || null,

      // INSIGHTS ADICIONAIS (google, reservas, categorias, etc)
      insightsAdicionais: adicionaisData || null,

      // ULTRA INSIGHTS (24 categorias de análise avançada)
      ultraInsights: ultraInsightsData || null,

      // INSIGHTS EXTRAS (17 categorias: vendedores, dormentes, sazonalidade, etc)
      insightsExtras: extrasData || null,

      // METADADOS
      _meta: {
        ...dadosPrincipais._meta,
        tempoCarregamento: `${Date.now() - startTime}ms`,
        otimizado: true,
        versao: CACHE_VERSION, // v12 - Correção categorias e clientes
      }
    }

    // Salvar no cache
    cache = {
      data: consolidado,
      timestamp: Date.now()
    }

    const tempoTotal = Date.now() - startTime
    console.log('🎉 Dados consolidados com sucesso!')
    console.log(`⏱️ Tempo de carregamento: ${tempoTotal}ms`)
    console.log(`💰 Faturamento Total: R$ ${consolidado.financeiro.faturamentoTotal?.toLocaleString('pt-BR')}`)
    console.log(`💵 Ticket Médio: R$ ${consolidado.financeiro.ticketMedio?.toFixed(2)}`)
    console.log(`👥 Clientes Ativos: ${consolidado.financeiro.clientesAtivos}`)
    console.log(`📊 CMV: ${consolidado.financeiro.cmvMedio?.toFixed(2)}%`)
    console.log(`📊 CMO: ${consolidado.financeiro.cmoMedio?.toFixed(2)}%`)
    console.log(`🎨 Artística: ${consolidado.financeiro.artisticaMedio?.toFixed(2)}%`)
    console.log(`🍺 Cervejas: R$ ${consolidado.vendas.faturamentoCervejas?.toLocaleString('pt-BR')}`)
    console.log(`🍹 Drinks: R$ ${consolidado.vendas.faturamentoDrinks?.toLocaleString('pt-BR')}`)
    console.log(`🍽️ Comidas: R$ ${consolidado.vendas.faturamentoComidas?.toLocaleString('pt-BR')}`)
    
    return NextResponse.json({ success: true, data: consolidado })
  } catch (error: any) {
    console.error('❌❌❌ ERRO CRÍTICO na retrospectiva:', error)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro desconhecido', stack: error.stack },
      { status: 500 }
    )
  }
}
