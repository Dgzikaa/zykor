import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Iniciando automação semanal de desempenho...')

    // Inicializar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Ler parâmetros opcionais do body
    const body = await req.json().catch(() => ({}))
    const semanaParam = body.semana
    const anoParam = body.ano
    const barIdParam = body.bar_id
    const recalcularTodas = body.recalcular_todas === true
    
    // ============================================
    // MODO: RECALCULAR TODAS AS SEMANAS (para aplicar nova lógica de stockout etc)
    // ============================================
    if (recalcularTodas) {
      const limitSemanas = body.limit_semanas || 0 // 0 = todas
      console.log(`🔄 MODO RECALCULAR TODAS (limit=${limitSemanas || 'todas'}): Buscando semanas...`)
      
      let query = supabase
        .from('desempenho_semanal')
        .select('bar_id, ano, numero_semana')
        .order('ano', { ascending: false })
        .order('numero_semana', { ascending: false })
      if (limitSemanas > 0) query = query.limit(limitSemanas * 10) // aprox por bar
      const { data: semanas, error: semanasError } = await query

      if (semanasError || !semanas?.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhuma semana encontrada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Deduplicar (bar, ano, semana) - manter ordem mais recente primeiro
      const chavesUnicas = [...new Set(semanas.map(s => `${s.bar_id}-${s.ano}-${s.numero_semana}`))]
      if (limitSemanas > 0) chavesUnicas.splice(limitSemanas)
      console.log(`📊 Recalculando ${chavesUnicas.length} semana(s)...`)

      const resultados: any[] = []
      const BATCH_SIZE = 3
      const DELAY_MS = 2000
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
      
      for (let i = 0; i < chavesUnicas.length; i++) {
        const chave = chavesUnicas[i]
        const [barId, ano, numeroSemana] = chave.split('-').map(Number)
        try {
          await recalcularDesempenhoSemana(supabase, barId, ano, numeroSemana)
          resultados.push({ bar_id: barId, ano, numero_semana: numeroSemana, sucesso: true })
          console.log(`✅ ${barId} S${numeroSemana}/${ano} (${i + 1}/${chavesUnicas.length})`)
        } catch (err) {
          resultados.push({ bar_id: barId, ano, numero_semana: numeroSemana, sucesso: false, erro: String(err) })
          console.error(`❌ ${barId} S${numeroSemana}/${ano}:`, err)
        }
        if ((i + 1) % BATCH_SIZE === 0 && i < chavesUnicas.length - 1) {
          await sleep(DELAY_MS)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Recalculadas ${resultados.length} semanas`,
          recalculadas: resultados.filter(r => r.sucesso).length,
          erros: resultados.filter(r => !r.sucesso).length,
          resultados,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ============================================
    // MODO NORMAL: Semana atual + anterior
    // ============================================
    const hoje = new Date()
    const anoAtual = anoParam || hoje.getFullYear()
    const semanaAtual = semanaParam || getWeekNumber(hoje)
    
    console.log(`📅 Processando: Ano ${anoAtual}, Semana ${semanaAtual}${semanaParam ? ' (parâmetro)' : ' (atual)'}`)

    // Buscar bares ativos
    const { data: bares, error: baresError } = await supabase
      .from('bars')
      .select('id, nome')
      .eq('ativo', true)

    if (baresError || !bares?.length) {
      console.log('❌ Nenhum bar ativo encontrado')
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum bar ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🏪 Processando ${bares.length} bar(es) ativo(s)`)

    const resultados = []

    // Filtrar por bar_id se fornecido
    const baresParaProcessar = barIdParam 
      ? bares.filter(b => b.id === barIdParam)
      : bares
    
    for (const bar of baresParaProcessar) {
      console.log(`\n🏪 Processando bar: ${bar.nome} (ID: ${bar.id})`)

      try {
        // ============================================
        // 🔄 PRIMEIRO: Recalcular a semana ANTERIOR (que acabou de terminar)
        // Isso garante que a semana que terminou ontem (domingo) tenha dados finais corretos
        // ============================================
        const semanaAnterior = semanaAtual === 1 ? 52 : semanaAtual - 1
        const anoSemanaAnterior = semanaAtual === 1 ? anoAtual - 1 : anoAtual
        
        console.log(`🔙 Recalculando semana anterior: ${semanaAnterior}/${anoSemanaAnterior}`)
        
        const { data: semanaAnteriorExiste } = await supabase
          .from('desempenho_semanal')
          .select('id')
          .eq('bar_id', bar.id)
          .eq('ano', anoSemanaAnterior)
          .eq('numero_semana', semanaAnterior)
          .single()

        if (semanaAnteriorExiste) {
          try {
            await recalcularDesempenhoSemana(supabase, bar.id, anoSemanaAnterior, semanaAnterior)
            console.log(`✅ Semana anterior ${semanaAnterior} recalculada com dados finais!`)
          } catch (errAnterior) {
            console.error(`⚠️ Erro ao recalcular semana anterior:`, errAnterior)
          }
        }

        // ============================================
        // 🆕 SEGUNDO: Criar/processar a semana ATUAL (que está começando)
        // ============================================
        
        // 1. Verificar se semana atual já existe
        const { data: semanaExistente } = await supabase
          .from('desempenho_semanal')
          .select('*')
          .eq('bar_id', bar.id)
          .eq('ano', anoAtual)
          .eq('numero_semana', semanaAtual)
          .single()

        // 2. Criar semana se não existir
        if (!semanaExistente) {
          await criarSemanaSeNaoExistir(supabase, bar.id, anoAtual, semanaAtual)
          console.log(`✅ Semana ${semanaAtual} criada para ${bar.nome}`)
        } else {
          console.log(`📊 Semana ${semanaAtual} já existe para ${bar.nome}`)
        }

        // 3. Recalcular dados da semana atual
        const resultadoRecalculo = await recalcularDesempenhoSemana(
          supabase, 
          bar.id, 
          anoAtual, 
          semanaAtual
        )

        resultados.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          semana: semanaAtual,
          semana_anterior: semanaAnterior,
          ano: anoAtual,
          sucesso: true,
          dados: resultadoRecalculo
        })

        console.log(`✅ Automação concluída para ${bar.nome}`)

      } catch (barError) {
        console.error(`❌ Erro ao processar bar ${bar.nome}:`, barError)
        resultados.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          semana: semanaAtual,
          ano: anoAtual,
          sucesso: false,
          erro: barError.message
        })
      }
    }

    console.log(`\n🎉 Automação semanal concluída!`)
    console.log(`📊 Processados: ${resultados.length} bar(es)`)
    console.log(`✅ Sucessos: ${resultados.filter(r => r.sucesso).length}`)
    console.log(`❌ Erros: ${resultados.filter(r => !r.sucesso).length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automação semanal concluída',
        semana_processada: semanaAtual,
        ano: anoAtual,
        resultados,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na automação semanal:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Função para obter número da semana (padrão ISO - segunda a domingo)
function getWeekNumber(date: Date): number {
  // Clonar data para não modificar original
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Ajustar para segunda-feira
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  // Obter primeiro dia do ano
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  // Calcular número da semana
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNo
}

// Função para obter quantas semanas ISO um ano tem (52 ou 53)
function getISOWeeksInYear(year: number): number {
  // Um ano tem 53 semanas se:
  // - Começa em quinta-feira, OU
  // - É bissexto e começa em quarta-feira
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const jan1Weekday = jan1.getUTCDay() // 0=domingo, 4=quinta
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  
  if (jan1Weekday === 4 || (isLeap && jan1Weekday === 3)) {
    return 53
  }
  return 52
}

// Função para obter datas de início e fim da semana (segunda a domingo)
function getWeekDates(year: number, weekNumber: number) {
  // Encontrar a primeira segunda-feira da primeira semana ISO do ano
  const jan4 = new Date(year, 0, 4) // 4 de janeiro sempre está na primeira semana ISO
  const jan4Day = jan4.getDay() || 7 // Domingo = 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - jan4Day + 1) // Volta para a primeira segunda-feira
  
  // Calcular início da semana desejada (segunda-feira)
  const startDate = new Date(firstMonday)
  startDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
  
  // Fim da semana (domingo)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  
  return {
    inicio: startDate.toISOString().split('T')[0],
    fim: endDate.toISOString().split('T')[0]
  }
}

// Função para criar semana se não existir
async function criarSemanaSeNaoExistir(supabase: any, barId: number, ano: number, numeroSemana: number) {
  const datas = getWeekDates(ano, numeroSemana)
  
  const { error } = await supabase
    .from('desempenho_semanal')
    .insert({
      bar_id: barId,
      ano,
      numero_semana: numeroSemana,
      data_inicio: datas.inicio,
      data_fim: datas.fim,
      faturamento_total: 0,
      faturamento_entrada: 0,
      faturamento_bar: 0,
      clientes_atendidos: 0,
      reservas_totais: 0,
      reservas_presentes: 0,
      ticket_medio: 0,
      cmv_teorico: 0,
      cmv_limpo: 0,
      cmv: 0,
      cmo: 0,
      custo_atracao_faturamento: 0,
      meta_semanal: 0,
      observacoes: `Semana criada automaticamente em ${new Date().toLocaleString('pt-BR')}`
    })

  if (error) {
    throw new Error(`Erro ao criar semana: ${error.message}`)
  }
}

// Função para recalcular dados da semana
async function recalcularDesempenhoSemana(supabase: any, barId: number, ano: number, numeroSemana: number) {
  console.log(`🔄 Recalculando dados da semana ${numeroSemana}/${ano} para bar ${barId}`)
  
  // Buscar dados da semana
  const { data: semana, error: semanaError } = await supabase
    .from('desempenho_semanal')
    .select('*')
    .eq('bar_id', barId)
    .eq('ano', ano)
    .eq('numero_semana', numeroSemana)
    .single()

  if (semanaError || !semana) {
    throw new Error('Semana não encontrada para recálculo')
  }

  const startDate = semana.data_inicio
  const endDate = semana.data_fim

  console.log(`📅 Período: ${startDate} até ${endDate}`)

  // ============================================
  // 1. FATURAMENTO TOTAL (ContaHub + Yuzer + Sympla)
  // ContaHub: SUM(liquido) - SUM(liquido WHERE meio='Conta Assinada')
  // ============================================
  const [contahubPagamentos, yuzerData, symplaData] = await Promise.all([
    fetchAllData(supabase, 'contahub_pagamentos', 'liquido, meio', {
      'gte_dt_gerencial': startDate,
      'lte_dt_gerencial': endDate,
      'eq_bar_id': barId
    }),
    fetchAllData(supabase, 'yuzer_pagamento', 'valor_liquido', {
      'gte_data_evento': startDate,
      'lte_data_evento': endDate,
      'eq_bar_id': barId
    }),
    fetchAllData(supabase, 'sympla_pedidos', 'valor_liquido', {
      'gte_data_pedido': startDate,
      'lte_data_pedido': endDate
    })
  ])

  // ContaHub: liquido total - conta assinada
  const liquidoTotal = contahubPagamentos?.reduce((sum, item) => sum + (parseFloat(item.liquido) || 0), 0) || 0
  const contaAssinada = contahubPagamentos?.filter(item => item.meio === 'Conta Assinada')
    .reduce((sum, item) => sum + (parseFloat(item.liquido) || 0), 0) || 0
  const faturamentoContahub = liquidoTotal - contaAssinada

  const faturamentoYuzer = yuzerData?.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0) || 0
  const faturamenteSympla = symplaData?.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0) || 0
  const faturamentoTotal = faturamentoContahub + faturamentoYuzer + faturamenteSympla

  console.log(`💰 Faturamento Total: R$ ${faturamentoTotal.toFixed(2)} (ContaHub: ${faturamentoContahub.toFixed(2)}, Yuzer: ${faturamentoYuzer.toFixed(2)}, Sympla: ${faturamenteSympla.toFixed(2)})`)

  // ============================================
  // 2. FATURAMENTO COUVERT e REPIQUE (contahub_periodo)
  // ============================================
  const contahubPeriodo = await fetchAllData(supabase, 'contahub_periodo', 'vr_couvert, vr_repique, vr_pagamentos, pessoas, cli_fone_norm', {
    'gte_dt_gerencial': startDate,
    'lte_dt_gerencial': endDate,
    'eq_bar_id': barId
  })

  const faturamentoCouvert = contahubPeriodo?.reduce((sum, item) => sum + (parseFloat(item.vr_couvert) || 0), 0) || 0
  const repiqueTotal = contahubPeriodo?.reduce((sum, item) => sum + (parseFloat(item.vr_repique) || 0), 0) || 0
  
  // Faturamento Bar = Total - Couvert
  const faturamentoBar = faturamentoTotal - faturamentoCouvert
  
  // Faturamento CMvível = Bar - Repique
  const faturamentoCmvivel = faturamentoBar - repiqueTotal

  console.log(`💰 Faturamento Couvert: R$ ${faturamentoCouvert.toFixed(2)}`)
  console.log(`💰 Faturamento Bar: R$ ${faturamentoBar.toFixed(2)}`)
  console.log(`💰 Faturamento CMvível: R$ ${faturamentoCmvivel.toFixed(2)}`)

  // ============================================
  // 3. TICKET MÉDIO CONTAHUB (vr_pagamentos/pessoas WHERE vr_pagamentos > 0)
  // ============================================
  const periodoComPagamentos = contahubPeriodo?.filter(item => parseFloat(item.vr_pagamentos) > 0) || []
  const somaVrPagamentos = periodoComPagamentos.reduce((sum, item) => sum + (parseFloat(item.vr_pagamentos) || 0), 0)
  const somaPessoas = periodoComPagamentos.reduce((sum, item) => sum + (parseInt(item.pessoas) || 0), 0)
  const ticketMedioContahub = somaPessoas > 0 ? somaVrPagamentos / somaPessoas : 0

  // TM Entrada = Couvert / Clientes
  const clientesAtendidos = somaPessoas
  const tmEntrada = clientesAtendidos > 0 ? faturamentoCouvert / clientesAtendidos : 0
  
  // TM Bar = Fat Bar / Clientes
  const tmBar = clientesAtendidos > 0 ? faturamentoBar / clientesAtendidos : 0

  console.log(`🎫 Ticket Médio ContaHub: R$ ${ticketMedioContahub.toFixed(2)}`)
  console.log(`🎫 TM Entrada: R$ ${tmEntrada.toFixed(2)}`)
  console.log(`🎫 TM Bar: R$ ${tmBar.toFixed(2)}`)
  console.log(`👥 Clientes Atendidos: ${clientesAtendidos}`)

  // ============================================
  // 4. CMV PERCENTUAIS (usando CMV manual da tabela)
  // ============================================
  const cmvRs = semana.cmv_rs || 0
  const cmvLimpoPercent = faturamentoCmvivel > 0 ? (cmvRs / faturamentoCmvivel) * 100 : 0
  const cmvGlobalPercent = faturamentoTotal > 0 ? (cmvRs / faturamentoTotal) * 100 : 0

  console.log(`📊 CMV R$: ${cmvRs} | CMV Limpo: ${cmvLimpoPercent.toFixed(2)}% | CMV Global: ${cmvGlobalPercent.toFixed(2)}%`)

  // ============================================
  // 5. BUSCAR TODOS OS DADOS DO NIBO - CMO COM CUSTOS FIXOS PROPORCIONAIS
  // ============================================
  
  // Calcular mês/ano da semana para buscar custos fixos
  const dataInicioSemana = new Date(startDate + 'T00:00:00')
  const dataFimSemana = new Date(endDate + 'T00:00:00')
  const mesInicio = dataInicioSemana.getMonth() + 1
  const anoInicio = dataInicioSemana.getFullYear()
  const mesFim = dataFimSemana.getMonth() + 1
  const anoFim = dataFimSemana.getFullYear()
  
  // Buscar dados do mês inteiro para custos fixos
  const mesInicioStr = `${anoInicio}-${mesInicio.toString().padStart(2, '0')}-01`
  const proximoMes = mesFim === 12 ? 1 : mesFim + 1
  const anoProximoMes = mesFim === 12 ? anoFim + 1 : anoFim
  const mesFimStr = `${anoProximoMes}-${proximoMes.toString().padStart(2, '0')}-01`
  
  // Buscar dados do NIBO para o(s) mês(es) da semana
  const niboDataMensal = await fetchAllData(supabase, 'nibo_agendamentos', 'valor, categoria_nome, data_competencia', {
    'gte_data_competencia': mesInicioStr,
    'lte_data_competencia': mesFimStr,
    'eq_bar_id': barId
  })
  
  // Buscar dados do NIBO apenas para a semana (para custos variáveis)
  const niboData = await fetchAllData(supabase, 'nibo_agendamentos', 'valor, categoria_nome', {
    'gte_data_competencia': startDate,
    'lte_data_competencia': endDate,
    'eq_bar_id': barId
  })

  // Função auxiliar para somar categorias do NIBO (dados da semana)
  const somarCategoriasNibo = (categorias: string[]) => {
    return niboData?.filter(item => 
      item.categoria_nome && categorias.some(cat => 
        item.categoria_nome.toUpperCase().includes(cat.toUpperCase())
      )
    ).reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0) || 0
  }

  // CMO% - NOVA LÓGICA: Custos fixos proporcionais + Variáveis da semana
  const categoriasFixas = ['SALARIO FUNCIONARIOS', 'VALE TRANSPORTE', 'ADICIONAIS', 'PRO LABORE', 'PROVISÃO TRABALHISTA']
  const categoriasVariaveis = ['ALIMENTAÇÃO', 'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA', 'RECURSOS HUMANOS']

  let custoTotalCMO = 0

  // 1. Custos FIXOS: Proporcionais ao mês (salários, VT, pró-labore, provisões)
  for (const categoria of categoriasFixas) {
    // Buscar total do mês de início
    const itensMesInicio = niboDataMensal?.filter(item => {
      if (!item.categoria_nome || !item.categoria_nome.toUpperCase().includes(categoria.toUpperCase())) return false
      const d = new Date(item.data_competencia)
      return d.getMonth() + 1 === mesInicio && d.getFullYear() === anoInicio
    }) || []
    
    // Buscar total do mês de fim (se diferente)
    const itensMesFim = mesInicio !== mesFim ? niboDataMensal?.filter(item => {
      if (!item.categoria_nome || !item.categoria_nome.toUpperCase().includes(categoria.toUpperCase())) return false
      const d = new Date(item.data_competencia)
      return d.getMonth() + 1 === mesFim && d.getFullYear() === anoFim
    }) || [] : []
    
    const totalMesInicio = itensMesInicio.reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0)
    const totalMesFim = itensMesFim.reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0)
    
    // Calcular proporção de dias da semana em cada mês
    const diasNoMesInicio = new Date(anoInicio, mesInicio, 0).getDate()
    const diasNoMesFim = mesInicio !== mesFim ? new Date(anoFim, mesFim, 0).getDate() : 0
    
    // Dias da semana no mês de início
    const ultimoDiaMesInicio = new Date(anoInicio, mesInicio, 0).getDate()
    const diasSemanaNoMesInicio = mesInicio === mesFim 
      ? 7 // Semana toda no mesmo mês
      : ultimoDiaMesInicio - dataInicioSemana.getDate() + 1
    
    // Dias da semana no mês de fim
    const diasSemanaNoMesFim = mesInicio !== mesFim ? dataFimSemana.getDate() : 0
    
    // Proporção
    const proporcaoMesInicio = diasSemanaNoMesInicio / diasNoMesInicio
    const proporcaoMesFim = mesInicio !== mesFim ? diasSemanaNoMesFim / diasNoMesFim : 0
    
    const totalProporcional = (totalMesInicio * proporcaoMesInicio) + (totalMesFim * proporcaoMesFim)
    custoTotalCMO += totalProporcional
  }

  // 2. Custos VARIÁVEIS: Buscar por data exata dentro da semana (freelancers, alimentação)
  for (const categoria of categoriasVariaveis) {
    const itens = niboData?.filter(item => 
      item.categoria_nome && item.categoria_nome.toUpperCase().includes(categoria.toUpperCase())
    ) || []
    const total = itens.reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0)
    custoTotalCMO += total
  }

  const cmoPercent = faturamentoTotal > 0 ? (custoTotalCMO / faturamentoTotal) * 100 : 0
  console.log(`👷 CMO: R$ ${custoTotalCMO.toFixed(2)} (${cmoPercent.toFixed(2)}%) [Fixos proporcionais + Variáveis da semana]`)

  // COCKPIT FINANCEIRO - Fórmulas atualizadas conforme planilha
  
  // Imposto = Faturamento Total * 7%
  const imposto = faturamentoTotal * 0.07
  
  // Comissão = soma de vr_repique do contahub_periodo
  const comissao = repiqueTotal
  
  // CMV (do NIBO para referência)
  const cmvNibo = somarCategoriasNibo(['CUSTO COMIDA', 'CUSTO BEBIDAS', 'CUSTO DRINKS', 'CUSTO OUTROS'])
  
  // Freelas = soma das categorias FREELA do nibo_agendamentos
  const freelas = somarCategoriasNibo(['FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA'])
  
  // CMO Fixo Simulação (manual por enquanto - não calculado)
  const cmoFixoSimulacao = 0
  
  // Alimentação = categoria ALIMENTAÇÃO do nibo_agendamentos
  const alimentacao = somarCategoriasNibo(['ALIMENTAÇÃO'])
  
  // Pro Labore = fixo (60000/31*7 = ~13548.39)
  const proLabore = 60000 / 31 * 7
  
  // RH+Estorno+Outros Operação = RECURSOS HUMANOS + OUTROS OPERAÇÃO + Estorno
  const rhEstornoOutros = somarCategoriasNibo(['RECURSOS HUMANOS', 'OUTROS OPERAÇÃO', 'ESTORNO'])
  
  // Materiais = Materiais + Materiais de Limpeza + Materiais Descartáveis
  const materiais = somarCategoriasNibo(['MATERIAIS', 'MATERIAIS DE LIMPEZA', 'MATERIAIS DESCARTÁVEIS'])
  
  // Manutenção
  const manutencao = somarCategoriasNibo(['MANUTENÇÃO'])
  
  // Utensílios
  const utensilios = somarCategoriasNibo(['UTENSÍLIOS'])

  console.log(`💰 Cockpit Financeiro - Imposto: R$ ${imposto.toFixed(2)}, Comissão: R$ ${comissao.toFixed(2)}, Freelas: R$ ${freelas.toFixed(2)}`)

  // ATRAÇÃO/FATURAMENTO - Atrações Programação + Produção Eventos
  const custoAtracao = somarCategoriasNibo(['ATRAÇÕES PROGRAMAÇÃO', 'PRODUÇÃO EVENTOS'])
  const atracaoFaturamentoPercent = faturamentoTotal > 0 ? (custoAtracao / faturamentoTotal) * 100 : 0
  console.log(`🎭 Atração/Faturamento: ${atracaoFaturamentoPercent.toFixed(2)}% (R$ ${custoAtracao.toFixed(2)})`)

  // ============================================
  // 7. RESERVAS (getin_reservations)
  // ============================================
  const getinReservas = await fetchAllData(supabase, 'getin_reservations', 'status, no_show, people', {
    'gte_reservation_date': startDate,
    'lte_reservation_date': endDate,
    'eq_bar_id': barId
  })

  const reservasTotais = getinReservas?.length || 0
  const pessoasReservasTotais = getinReservas?.reduce((sum, item) => sum + (parseInt(item.people) || 0), 0) || 0
  
  const reservasPresentesList = getinReservas?.filter(item => 
    item.status === 'seated' || (item.status === 'confirmed' && !item.no_show)
  ) || []
  const reservasPresentes = reservasPresentesList.length
  const pessoasReservasPresentes = reservasPresentesList.reduce((sum, item) => sum + (parseInt(item.people) || 0), 0)

  console.log(`📋 Reservas: ${reservasTotais} totais (${pessoasReservasTotais} pessoas), ${reservasPresentes} presentes (${pessoasReservasPresentes} pessoas)`)

  // ============================================
  // 8. NPS (tabela nps)
  // ============================================
  const npsData = await fetchAllData(supabase, 'nps', 'nps_geral, nps_ambiente, nps_atendimento, nps_limpeza, nps_musica, nps_comida, nps_drink, nps_preco, fez_reserva', {
    'gte_data_pesquisa': startDate,
    'lte_data_pesquisa': endDate,
    'eq_bar_id': barId
  })

  // Função para calcular NPS tradicional: % Promotores (9-10) - % Detratores (0-6)
  const calcularNpsTradicional = (campo: string, filtro?: (item: any) => boolean) => {
    let dados = npsData || []
    if (filtro) {
      dados = dados.filter(filtro)
    }
    const valores = dados.filter(item => item[campo] !== null && item[campo] !== undefined && parseFloat(item[campo]) > 0)
      .map(item => parseFloat(item[campo]) || 0)
    
    if (valores.length === 0) return null
    
    const promotores = valores.filter(v => v >= 9).length
    const detratores = valores.filter(v => v <= 6).length
    const total = valores.length
    
    const percPromotores = (promotores / total) * 100
    const percDetratores = (detratores / total) * 100
    
    return Math.round(percPromotores - percDetratores) // NPS vai de -100 a +100
  }

  // Função para calcular média (para as categorias específicas)
  const calcularMediaNps = (campo: string, filtro?: (item: any) => boolean) => {
    let dados = npsData || []
    if (filtro) {
      dados = dados.filter(filtro)
    }
    const valores = dados.filter(item => item[campo] !== null && item[campo] !== undefined && parseFloat(item[campo]) > 0)
      .map(item => parseFloat(item[campo]) || 0)
    return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null
  }

  // NPS Geral e Reservas usam cálculo tradicional (% Promotores - % Detratores)
  const npsGeral = calcularNpsTradicional('nps_geral')
  let npsReservas = calcularNpsTradicional('nps_geral', item => item.fez_reserva === true)
  
  // Se nps_reservas vier vazio da tabela nps, usar tabela nps_reservas (planilha reservas)
  if (npsReservas === null) {
    const { data: npsReservasData } = await supabase
      .from('nps_reservas')
      .select('nota')
      .eq('bar_id', barId)
      .gte('data_pesquisa', startDate)
      .lte('data_pesquisa', endDate)
    const notas = (npsReservasData || []).filter(r => r.nota != null && parseFloat(String(r.nota)) > 0).map(r => parseFloat(String(r.nota)) || 0)
    if (notas.length > 0) {
      const promotores = notas.filter(v => v >= 9).length
      const detratores = notas.filter(v => v <= 6).length
      npsReservas = Math.round((promotores / notas.length) * 100 - (detratores / notas.length) * 100)
      console.log(`⭐ NPS Reservas (tabela nps_reservas): ${npsReservas} (${notas.length} respostas)`)
    }
  }
  
  // Categorias específicas continuam com média
  const npsAmbiente = calcularMediaNps('nps_ambiente')
  const npsAtendimento = calcularMediaNps('nps_atendimento')
  const npsLimpeza = calcularMediaNps('nps_limpeza')
  const npsMusica = calcularMediaNps('nps_musica')
  const npsComida = calcularMediaNps('nps_comida')
  const npsDrink = calcularMediaNps('nps_drink')
  const npsPreco = calcularMediaNps('nps_preco')

  console.log(`⭐ NPS Geral: ${npsGeral ?? 'N/A'} (${npsData?.length || 0} respostas) | NPS Reservas: ${npsReservas ?? 'N/A'}`)

  // ============================================
  // 9. AVALIAÇÕES GOOGLE (google_reviews - Apify)
  // Tabela google_reviews com bar_id, stars, published_at_date
  // ============================================
  let googleData: any[] = []
  let avaliacoes5Estrelas = 0
  let mediaGoogle: number | null = null
  
  // Buscar reviews do Google da tabela google_reviews (Apify)
  // IMPORTANTE: Usar timezone de Brasília (-03:00) para evitar problemas de dia
  const { data: googleReviewsData, error: googleError } = await supabase
    .from('google_reviews')
    .select('stars, published_at_date')
    .eq('bar_id', barId)
    .gte('published_at_date', startDate + 'T00:00:00-03:00')
    .lte('published_at_date', endDate + 'T23:59:59-03:00')

  if (!googleError && googleReviewsData) {
    googleData = googleReviewsData.filter(item => item.stars !== null)
    
    // Contar avaliações 5 estrelas
    avaliacoes5Estrelas = googleData.filter(item => item.stars === 5).length
    
    // Calcular média de estrelas
    if (googleData.length > 0) {
      const somaEstrelas = googleData.reduce((sum, item) => sum + (item.stars || 0), 0)
      mediaGoogle = somaEstrelas / googleData.length
    }
  } else if (googleError) {
    console.error('Erro ao buscar google_reviews:', googleError)
  }

  console.log(`⭐ Avaliações Google (bar_id=${barId}): ${avaliacoes5Estrelas} com 5★, Média: ${mediaGoogle?.toFixed(2) || 'N/A'} (${googleData.length} reviews)`)

  // ============================================
  // 10. % CLIENTES NOVOS (stored procedure)
  // ============================================
  const dataInicio = new Date(startDate + 'T00:00:00')
  const dataFim = new Date(endDate + 'T00:00:00')
  const inicioAnterior = new Date(dataInicio)
  inicioAnterior.setDate(dataInicio.getDate() - 7)
  const fimAnterior = new Date(dataFim)
  fimAnterior.setDate(dataFim.getDate() - 7)
  
  const inicioAnteriorStr = inicioAnterior.toISOString().split('T')[0]
  const fimAnteriorStr = fimAnterior.toISOString().split('T')[0]

  let percClientesNovos = 0
  let clientesAtivosBase = 0

  const { data: metricas, error: metricasError } = await supabase.rpc('calcular_metricas_clientes', {
    p_bar_id: barId,
    p_data_inicio_atual: startDate,
    p_data_fim_atual: endDate,
    p_data_inicio_anterior: inicioAnteriorStr,
    p_data_fim_anterior: fimAnteriorStr
  })

  if (!metricasError && metricas && metricas[0]) {
    const resultado = metricas[0]
    const totalClientes = Number(resultado.total_atual) || 0
    const novosClientes = Number(resultado.novos_atual) || 0
    percClientesNovos = totalClientes > 0 ? (novosClientes / totalClientes) * 100 : 0
    console.log(`🆕 % Clientes Novos: ${percClientesNovos.toFixed(2)}%`)
  }

  // ============================================
  // 11. CLIENTES ATIVOS (2+ visitas em 90 dias)
  // ============================================
  const data90DiasAtras = new Date(dataFim)
  data90DiasAtras.setDate(dataFim.getDate() - 90)
  const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0]

  const { data: baseAtivaResult, error: baseAtivaError } = await supabase.rpc('get_count_base_ativa', {
    p_bar_id: barId,
    p_data_inicio: data90DiasAtrasStr,
    p_data_fim: endDate
  })

  if (!baseAtivaError && baseAtivaResult !== null) {
    clientesAtivosBase = Number(baseAtivaResult) || 0
    console.log(`⭐ Clientes Ativos: ${clientesAtivosBase}`)
  }

  // ============================================
  // 11.5 RETENÇÃO 1 MÊS E 2 MESES
  // Clientes que visitaram há 30/60 dias e voltaram nesta semana
  // ============================================
  let retencao1m: number = 0
  let retencao2m: number = 0

  // Função para normalizar telefone (remover não-dígitos)
  const normalizarTelefone = (fone: string | null | undefined): string => {
    if (!fone) return ''
    return fone.replace(/\D/g, '')
  }

  // Calcular período de 30 dias atrás
  const data30DiasAtras = new Date(dataInicio)
  data30DiasAtras.setDate(dataInicio.getDate() - 30)
  const data37DiasAtras = new Date(dataInicio)
  data37DiasAtras.setDate(dataInicio.getDate() - 37) // janela de 7 dias
  
  // Calcular período de 60 dias atrás
  const data60DiasAtras = new Date(dataInicio)
  data60DiasAtras.setDate(dataInicio.getDate() - 60)
  const data67DiasAtras = new Date(dataInicio)
  data67DiasAtras.setDate(dataInicio.getDate() - 67) // janela de 7 dias

  // Buscar clientes que visitaram há ~30 dias (usando cli_fone)
  const clientes30DiasAtras = await fetchAllData(supabase, 'contahub_periodo', 'cli_fone', {
    'gte_dt_gerencial': data37DiasAtras.toISOString().split('T')[0],
    'lte_dt_gerencial': data30DiasAtras.toISOString().split('T')[0],
    'eq_bar_id': barId
  })

  // Buscar clientes que visitaram há ~60 dias
  const clientes60DiasAtras = await fetchAllData(supabase, 'contahub_periodo', 'cli_fone', {
    'gte_dt_gerencial': data67DiasAtras.toISOString().split('T')[0],
    'lte_dt_gerencial': data60DiasAtras.toISOString().split('T')[0],
    'eq_bar_id': barId
  })

  // Buscar clientes da semana atual (precisa de cli_fone)
  const clientesSemanaAtualTel = await fetchAllData(supabase, 'contahub_periodo', 'cli_fone', {
    'gte_dt_gerencial': startDate,
    'lte_dt_gerencial': endDate,
    'eq_bar_id': barId
  })

  // Calcular retenção
  if (clientes30DiasAtras?.length > 0 && clientesSemanaAtualTel?.length > 0) {
    const telefones30Dias = new Set(clientes30DiasAtras
      .map(c => normalizarTelefone(c.cli_fone))
      .filter(t => t.length >= 10))
    const telefonesAtuais = new Set(clientesSemanaAtualTel
      .map(c => normalizarTelefone(c.cli_fone))
      .filter(t => t.length >= 10))
    const retornaram30 = [...telefones30Dias].filter(t => telefonesAtuais.has(t)).length
    retencao1m = telefones30Dias.size > 0 ? (retornaram30 / telefones30Dias.size) * 100 : 0
    console.log(`🔄 Retenção 1m: ${retencao1m.toFixed(1)}% (${retornaram30}/${telefones30Dias.size})`)
  }

  if (clientes60DiasAtras?.length > 0 && clientesSemanaAtualTel?.length > 0) {
    const telefones60Dias = new Set(clientes60DiasAtras
      .map(c => normalizarTelefone(c.cli_fone))
      .filter(t => t.length >= 10))
    const telefonesAtuais = new Set(clientesSemanaAtualTel
      .map(c => normalizarTelefone(c.cli_fone))
      .filter(t => t.length >= 10))
    const retornaram60 = [...telefones60Dias].filter(t => telefonesAtuais.has(t)).length
    retencao2m = telefones60Dias.size > 0 ? (retornaram60 / telefones60Dias.size) * 100 : 0
    console.log(`🔄 Retenção 2m: ${retencao2m.toFixed(1)}% (${retornaram60}/${telefones60Dias.size})`)
  }

  // ============================================
  // 12. COCKPIT PRODUTOS (contahub_analitico para itens, contahub_tempo, contahub_stockout)
  // ============================================
  console.log(`📦 Calculando Cockpit Produtos...`)

  // 12.1 QUANTIDADE DE ITENS - Usar contahub_analitico (mais completo que prodporhora)
  const analiticoData = await fetchAllData(supabase, 'contahub_analitico', 'grp_desc, qtd', {
    'gte_trn_dtgerencial': startDate,
    'lte_trn_dtgerencial': endDate,
    'eq_bar_id': barId
  })

  const gruposBar = ['Baldes', 'Cervejas', 'Bebidas', 'Doses', 'Dose Dupla', 
    'Drinks Autorais', 'Drinks Classicos', 'Happy Hour', 'Pegue e Pague', 'Garrafas', 'Vinhos', 'Espressos', 'Chopp']
  const gruposCozinha = ['Pratos Individuais', 'Pratos Para Compartilhar', 'Sanduíches', 'Sobremesas', 'Combos']

  const qtdeItensBar = analiticoData?.filter(item => 
    gruposBar.some(g => item.grp_desc?.includes(g)) && !item.grp_desc?.includes('Insumo')
  ).reduce((sum, item) => sum + (parseFloat(item.qtd) || 0), 0) || 0

  const qtdeItensCozinha = analiticoData?.filter(item => 
    gruposCozinha.some(g => item.grp_desc?.includes(g))
  ).reduce((sum, item) => sum + (parseFloat(item.qtd) || 0), 0) || 0

  console.log(`📦 Itens produzidos - Bar: ${qtdeItensBar}, Cozinha: ${qtdeItensCozinha}`)

  // 12.2 TEMPO E ATRASOS (contahub_tempo)
  // NOTA: tempos estão em SEGUNDOS, precisamos converter para minutos
  // Bar usa t0_t3 (lançamento até entrega), Cozinha usa t0_t2
  const tempoData = await fetchAllData(supabase, 'contahub_tempo', 'categoria, loc_desc, t0_t2, t0_t3, t1_t2, itm_qtd, prd_desc, data', {
    'gte_data': startDate,
    'lte_data': endDate,
    'eq_bar_id': barId
  })

  // Separar Drinks (preparados) e Cozinha (comida)
  // DRINKS: Apenas locais de drinks preparados
  const locaisDrinks = ['Batidos', 'Montados', 'Mexido', 'Preshh', 'Drinks', 'Drinks Autorais', 'Shot e Dose']
  const tempoDrinks = tempoData?.filter(item => 
    locaisDrinks.some(l => item.loc_desc?.includes(l))
  ) || []
  
  // COZINHA: Apenas locais de comida
  const locaisCozinha = ['Cozinha', 'Cozinha 1', 'Cozinha 2']
  const tempoCozinha = tempoData?.filter(item => 
    item.categoria === 'comida' || 
    locaisCozinha.some(l => item.loc_desc?.includes(l))
  ) || []

  // Tempo médio de saída - Drinks usa t0_t3, Cozinha usa t0_t2 (em segundos, convertendo para minutos)
  // IMPORTANTE: Ignorar itens com tempo <= 0 ou NULL para não distorcer a média
  // Itens válidos para qualquer cálculo (tempo > 0)
  const tempoDrinksValidos = tempoDrinks.filter(item => {
    const tempo = parseFloat(item.t0_t3)
    return !isNaN(tempo) && tempo > 0
  })
  const tempoCozinhaValidos = tempoCozinha.filter(item => {
    const tempo = parseFloat(item.t0_t2)
    return !isNaN(tempo) && tempo > 0
  })

  // Tempo médio: SUM(tempo) / COUNT(tempo > 0) / 60 — igual fórmula da planilha
  // SEM filtro de outliers para bater 100% com a planilha
  const tempoSaidaDrinksSegundos = tempoDrinksValidos.length > 0 
    ? tempoDrinksValidos.reduce((sum, item) => sum + parseFloat(item.t0_t3), 0) / tempoDrinksValidos.length 
    : 0
  const tempoSaidaCozinhaSegundos = tempoCozinhaValidos.length > 0 
    ? tempoCozinhaValidos.reduce((sum, item) => sum + parseFloat(item.t0_t2), 0) / tempoCozinhaValidos.length 
    : 0
  
  // Converter para minutos
  const tempoSaidaDrinks = tempoSaidaDrinksSegundos / 60
  const tempoSaidaCozinha = tempoSaidaCozinhaSegundos / 60
  
  console.log(`📊 Itens válidos para média - Drinks: ${tempoDrinksValidos.length}/${tempoDrinks.length}, Cozinha: ${tempoCozinhaValidos.length}/${tempoCozinha.length}`)

  // Atrasos - Drinks com t0_t3 > 10min = 600s, Cozinha com t0_t2 > 20min = 1200s
  // NOTA: Para ATRASOS usamos TODOS os itens válidos (incluindo outliers extremos)
  // Isso garante que itens com 13h de atraso sejam contados
  const atrasadosDrinks = tempoDrinksValidos.filter(item => parseFloat(item.t0_t3) > 600)
  const atrasadosCozinha = tempoCozinhaValidos.filter(item => parseFloat(item.t0_t2) > 1200)
  
  const atrasosDrinks = atrasadosDrinks.length
  const atrasosCozinha = atrasadosCozinha.length

  // % Atrasos - baseado em TODOS os itens válidos (incluindo outliers)
  const percAtrasosDrinks = tempoDrinksValidos.length > 0 ? (atrasosDrinks / tempoDrinksValidos.length) * 100 : 0
  const percAtrasosCozinha = tempoCozinhaValidos.length > 0 ? (atrasosCozinha / tempoCozinhaValidos.length) * 100 : 0

  // Agrupar atrasos por dia da semana com detalhes dos itens
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  
  // Detalhes Drinks
  const atrasosBarDetalhes: any[] = []
  const atrasosDrinksPorDia = new Map<string, Map<string, { quantidade: number, atrasoTotal: number }>>()
  
  atrasadosDrinks.forEach(item => {
    const data = new Date(item.data)
    const diaSemana = diasSemana[data.getDay()]
    const produtoNome = item.prd_desc || 'Item sem nome'
    const atrasoMinutos = parseFloat(item.t0_t3) / 60
    
    if (!atrasosDrinksPorDia.has(diaSemana)) {
      atrasosDrinksPorDia.set(diaSemana, new Map())
    }
    
    const diaMap = atrasosDrinksPorDia.get(diaSemana)!
    if (!diaMap.has(produtoNome)) {
      diaMap.set(produtoNome, { quantidade: 0, atrasoTotal: 0 })
    }
    
    const produto = diaMap.get(produtoNome)!
    produto.quantidade += 1
    produto.atrasoTotal += atrasoMinutos
  })
  
  // Ordenar por dia da semana e converter para array
  diasSemana.forEach(dia => {
    if (atrasosDrinksPorDia.has(dia)) {
      const produtos = Array.from(atrasosDrinksPorDia.get(dia)!.entries())
        .map(([nome, dados]) => ({
          nome,
          quantidade: dados.quantidade,
          atraso_minutos: dados.atrasoTotal / dados.quantidade // Média de atraso
        }))
        .sort((a, b) => b.atraso_minutos - a.atraso_minutos) // Maior atraso primeiro
      
      if (produtos.length > 0) {
        atrasosBarDetalhes.push({
          dia_semana: dia,
          itens: produtos
        })
      }
    }
  })
  
  // Detalhes Cozinha
  const atrasosCozinhaDetalhes: any[] = []
  const atrasosCozinhaPorDia = new Map<string, Map<string, { quantidade: number, atrasoTotal: number }>>()
  
  atrasadosCozinha.forEach(item => {
    const data = new Date(item.data)
    const diaSemana = diasSemana[data.getDay()]
    const produtoNome = item.prd_desc || 'Item sem nome'
    const atrasoMinutos = parseFloat(item.t0_t2) / 60
    
    if (!atrasosCozinhaPorDia.has(diaSemana)) {
      atrasosCozinhaPorDia.set(diaSemana, new Map())
    }
    
    const diaMap = atrasosCozinhaPorDia.get(diaSemana)!
    if (!diaMap.has(produtoNome)) {
      diaMap.set(produtoNome, { quantidade: 0, atrasoTotal: 0 })
    }
    
    const produto = diaMap.get(produtoNome)!
    produto.quantidade += 1
    produto.atrasoTotal += atrasoMinutos
  })
  
  // Ordenar por dia da semana e converter para array
  diasSemana.forEach(dia => {
    if (atrasosCozinhaPorDia.has(dia)) {
      const produtos = Array.from(atrasosCozinhaPorDia.get(dia)!.entries())
        .map(([nome, dados]) => ({
          nome,
          quantidade: dados.quantidade,
          atraso_minutos: dados.atrasoTotal / dados.quantidade // Média de atraso
        }))
        .sort((a, b) => b.atraso_minutos - a.atraso_minutos) // Maior atraso primeiro
      
      if (produtos.length > 0) {
        atrasosCozinhaDetalhes.push({
          dia_semana: dia,
          itens: produtos
        })
      }
    }
  })

  console.log(`⏱️ Tempo Drinks (t0_t3): ${tempoSaidaDrinks.toFixed(1)}min (${atrasosDrinks} atrasos >10min, ${percAtrasosDrinks.toFixed(1)}%)`)
  console.log(`⏱️ Tempo Cozinha (t0_t2): ${tempoSaidaCozinha.toFixed(1)}min (${atrasosCozinha} atrasos >20min, ${percAtrasosCozinha.toFixed(1)}%)`)

  // ATRASINHOS: drinks 4+ min (240s), cozinha 15+ min (900s)
  const atrasinhosDrinks = tempoDrinksValidos.filter(item => parseFloat(item.t0_t3) >= 240).length
  const atrasinhosCozinha = tempoCozinhaValidos.filter(item => parseFloat(item.t0_t2) >= 900).length
  // ATRASO: drinks 8+ min (480s), cozinha 20+ min (1200s) - já são os mesmos de atrasos_bar/atrasos_cozinha
  const atrasoDrinks = atrasadosDrinks.length
  const atrasoCozinha = atrasadosCozinha.length

  // Detalhes atrasinhos/atraso por dia (dia_semana, atrasinhos_bar, atrasinhos_cozinha, atraso_bar, atraso_cozinha)
  const atrasinhosAtrasoPorDia = new Map<string, { atrasinhos_bar: number, atrasinhos_cozinha: number, atraso_bar: number, atraso_cozinha: number }>()
  const agregarAtraso = (item: any, isDrink: boolean, t0_t3val: number, t0_t2val: number) => {
    const data = new Date(item.data)
    const diaSemana = diasSemana[data.getDay()]
    if (!atrasinhosAtrasoPorDia.has(diaSemana)) {
      atrasinhosAtrasoPorDia.set(diaSemana, { atrasinhos_bar: 0, atrasinhos_cozinha: 0, atraso_bar: 0, atraso_cozinha: 0 })
    }
    const d = atrasinhosAtrasoPorDia.get(diaSemana)!
    if (isDrink) {
      if (t0_t3val >= 240) d.atrasinhos_bar++
      if (t0_t3val >= 480) d.atraso_bar++
    } else {
      if (t0_t2val >= 900) d.atrasinhos_cozinha++
      if (t0_t2val >= 1200) d.atraso_cozinha++
    }
  }
  tempoDrinksValidos.forEach(item => {
    const t0 = parseFloat(item.t0_t3)
    if (t0 > 0) agregarAtraso(item, true, t0, 0)
  })
  tempoCozinhaValidos.forEach(item => {
    const t0 = parseFloat(item.t0_t2)
    if (t0 > 0) agregarAtraso(item, false, 0, t0)
  })
  const atrasinhosDetalhes = Array.from(atrasinhosAtrasoPorDia.entries()).map(([dia, v]) => ({
    dia_semana: dia,
    atrasinhos_bar: v.atrasinhos_bar,
    atrasinhos_cozinha: v.atrasinhos_cozinha,
    atraso_bar: v.atraso_bar,
    atraso_cozinha: v.atraso_cozinha
  }))

  // 12.2b CANCELAMENTOS (contahub_cancelamentos - soma custototal por semana)
  let cancelamentosTotal = 0
  const cancelamentosPorDia: { dia_semana: string; data: string; valor: number }[] = []
  try {
    const cancelamentosData = await fetchAllData(supabase, 'contahub_cancelamentos', 'data, custototal', {
      'gte_data': startDate,
      'lte_data': endDate,
      'eq_bar_id': barId
    })
    if (cancelamentosData?.length) {
      const porDia = new Map<string, number>()
      cancelamentosData.forEach((item: any) => {
        const d = item.data || ''
        const v = parseFloat(item.custototal) || 0
        cancelamentosTotal += v
        porDia.set(d, (porDia.get(d) || 0) + v)
      })
      cancelamentosPorDia.push(...Array.from(porDia.entries())
        .map(([data, valor]) => ({
          dia_semana: diasSemana[new Date(data).getDay()],
          data,
          valor
        }))
        .sort((a, b) => b.valor - a.valor))
      console.log(`📊 Cancelamentos: R$ ${cancelamentosTotal.toFixed(2)} (${cancelamentosData.length} registros)`)
    }
  } catch (e) {
    console.warn(`⚠️ Erro ao buscar cancelamentos:`, e)
  }

  // 12.3 STOCKOUT (contahub_stockout) - NOVA LÓGICA: igual página de stockout
  // Buscar dados com prd_ativo e raw_data para filtrar corretamente por grupo
  const stockoutData = await fetchAllData(supabase, 'contahub_stockout', 'prd, loc_desc, prd_venda, prd_ativo, prd_desc, data_consulta, raw_data', {
    'gte_data_consulta': startDate,
    'lte_data_consulta': endDate,
    'eq_bar_id': barId
  })

  // Locais por categoria - DESEMPENHO (referência correta)
  // Bar = bebidas + doses | Drinks = preparados (batidos, montados)
  const locaisComidasStockout = ['Cozinha 1', 'Cozinha 2']
  const locaisDrinksStockout = ['Batidos', 'Montados', 'Mexido', 'Preshh']
  const locaisBarStockout = ['Bar', 'Baldes', 'Shot e Dose', 'Chopp']
  
  // Locais a ignorar (igual página de stockout)
  const locaisIgnorar = ['Pegue e Pague', 'Venda Volante']
  
  // GRUPOS A IGNORAR (igual página de stockout) - case-sensitive conforme ContaHub
  const gruposIgnorar = [
    'Happy Hour', 'Chegadeira', 
    'Dose dupla', 'Dose Dupla', 'Dose dupla!', 'Dose Dupla!',
    'Dose dupla sem álcool', 'Dose Dupla sem álcool',
    'Grupo adicional', 'Grupo Adicional',
    'Insumos', 'Promo chivas', 'Promo Chivas',
    'Uso interno', 'Uso Interno'
  ]
  
  // Prefixos de produtos a ignorar
  const prefixosIgnorar = ['[HH]', '[PP]', '[DD]', '[IN]']
  
  // Termos de produtos a ignorar
  const termosIgnorar = ['Happy Hour', 'HappyHour', 'Happy-Hour', 'Dose Dupla', 'Dose Dulpa', 'Balde', 'Garrafa']

  // Filtrar produtos válidos (igual página de stockout)
  const produtosValidos = stockoutData?.filter(item => {
    // Apenas produtos ativos
    if (item.prd_ativo !== 'S') return false
    
    // Tem local definido
    if (!item.loc_desc) return false
    
    // Não está em locais ignorados
    if (locaisIgnorar.includes(item.loc_desc)) return false
    
    // Verificar grupo do produto (via raw_data)
    const grupoDescricao = item.raw_data?.grp_desc || ''
    if (gruposIgnorar.includes(grupoDescricao)) return false
    
    // Verificar prefixos no nome do produto
    const prdDesc = item.prd_desc || ''
    if (prefixosIgnorar.some(prefixo => prdDesc.includes(prefixo))) return false
    
    // Verificar termos no nome do produto
    if (termosIgnorar.some(termo => prdDesc.toLowerCase().includes(termo.toLowerCase()))) return false
    
    return true
  }) || []

  // Agrupar por dia para calcular média dos dias
  const diasMap = new Map<string, { 
    total: number, 
    stockoutBar: number, stockoutComidas: number, stockoutDrinks: number, 
    totalBar: number, totalComidas: number, totalDrinks: number,
    // Detalhes por local para tooltip
    detalhes: Map<string, { total: number, stockout: number }>
  }>()
  
  produtosValidos.forEach(item => {
    const dia = item.data_consulta
    if (!diasMap.has(dia)) {
      diasMap.set(dia, { 
        total: 0, 
        stockoutBar: 0, stockoutComidas: 0, stockoutDrinks: 0, 
        totalBar: 0, totalComidas: 0, totalDrinks: 0,
        detalhes: new Map()
      })
    }
    const stats = diasMap.get(dia)!
    stats.total++
    
    const isStockout = item.prd_venda === 'N' // prd_ativo='S' e prd_venda='N' = STOCKOUT
    const loc = item.loc_desc || 'Sem local'
    
    // Registrar detalhes por local
    if (!stats.detalhes.has(loc)) {
      stats.detalhes.set(loc, { total: 0, stockout: 0 })
    }
    const locStats = stats.detalhes.get(loc)!
    locStats.total++
    if (isStockout) locStats.stockout++
    
    // Categorizar
    const isBar = locaisBarStockout.some(l => loc.includes(l))
    const isComidas = locaisComidasStockout.some(l => loc.includes(l))
    const isDrinks = locaisDrinksStockout.some(l => loc.includes(l))
    
    if (isBar) {
      stats.totalBar++
      if (isStockout) stats.stockoutBar++
    }
    if (isComidas) {
      stats.totalComidas++
      if (isStockout) stats.stockoutComidas++
    }
    if (isDrinks) {
      stats.totalDrinks++
      if (isStockout) stats.stockoutDrinks++
    }
  })

  // Calcular percentuais - MÉDIA DOS DIÁRIOS (referência correta)
  const dias = Array.from(diasMap.values())
  const numDias = dias.length || 1
  
  let somaPercBar = 0, somaPercComidas = 0, somaPercDrinks = 0
  let somaStockoutBar = 0, somaStockoutComidas = 0, somaStockoutDrinks = 0
  
  dias.forEach(d => {
    somaPercBar += d.totalBar > 0 ? (d.stockoutBar / d.totalBar) * 100 : 0
    somaPercComidas += d.totalComidas > 0 ? (d.stockoutComidas / d.totalComidas) * 100 : 0
    somaPercDrinks += d.totalDrinks > 0 ? (d.stockoutDrinks / d.totalDrinks) * 100 : 0
    somaStockoutBar += d.stockoutBar
    somaStockoutComidas += d.stockoutComidas
    somaStockoutDrinks += d.stockoutDrinks
  })
  
  const stockoutBarPerc = somaPercBar / numDias
  const stockoutCozinhaPerc = somaPercComidas / numDias
  const stockoutDrinksPerc = somaPercDrinks / numDias
  
  // Números absolutos (soma da semana)
  const stockoutBar = somaStockoutBar
  const stockoutCozinha = somaStockoutComidas // Mantendo nome da variável para compatibilidade
  const stockoutDrinks = somaStockoutDrinks

  console.log(`📦 Stockout (média de ${numDias} dias):`)
  console.log(`   - Bar (Bar+Baldes+Shot e Dose+Chopp): ${stockoutBarPerc.toFixed(1)}%`)
  console.log(`   - Comidas (Cozinha 1+Cozinha 2): ${stockoutCozinhaPerc.toFixed(1)}%`)
  console.log(`   - Drinks (Batidos+Montados+Mexido+Preshh): ${stockoutDrinksPerc.toFixed(1)}%`)

  // 12.4 PERCENTUAIS DE VENDA POR CATEGORIA (usando SOMA CONSOLIDADA da semana - igual planilha)
  // Busca eventos_base para fat_19h_percent e outras métricas
  const eventosBase = await fetchAllData(supabase, 'eventos_base', 'percent_b, percent_d, percent_c, fat_19h_percent, dia_semana, real_r', {
    'gte_data_evento': startDate,
    'lte_data_evento': endDate,
    'eq_bar_id': barId,
    'eq_ativo': true
  })

  // CORREÇÃO: Calcular Mix de Vendas pela SOMA TOTAL da semana (igual planilha)
  // Em vez de média simples dos percentuais diários, usa soma consolidada do contahub_analitico
  // Isso garante que dias com maior faturamento tenham mais peso no cálculo
  
  // Buscar dados do contahub_analitico para calcular mix de vendas consolidado
  const contahubMixData = await fetchAllData(supabase, 'contahub_analitico', 'loc_desc, valorfinal', {
    'gte_trn_dtgerencial': startDate,
    'lte_trn_dtgerencial': endDate,
    'eq_bar_id': barId
  })
  
  // Categorias conforme DE/PARA:
  // BEBIDA: Chopp, Bar, Pegue e Pague, Venda Volante, Baldes
  // COMIDA: Cozinha, Cozinha 1, Cozinha 2
  // DRINK: Preshh, Montados, Mexido, Drinks, Drinks Autorais, Shot e Dose, Batidos
  const locaisBebida = ['Chopp', 'Bar', 'Pegue e Pague', 'Venda Volante', 'Baldes']
  const locaisComida = ['Cozinha', 'Cozinha 1', 'Cozinha 2']
  const locaisDrink = ['Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos']
  
  let valorBebidas = 0
  let valorComidas = 0
  let valorDrinks = 0
  let valorTotal = 0
  
  contahubMixData?.forEach(item => {
    const valor = parseFloat(item.valorfinal) || 0
    const loc = item.loc_desc || ''
    valorTotal += valor
    
    if (locaisBebida.includes(loc)) {
      valorBebidas += valor
    } else if (locaisComida.includes(loc)) {
      valorComidas += valor
    } else if (locaisDrink.includes(loc)) {
      valorDrinks += valor
    }
    // Outros locais não são contabilizados no mix (são excluídos)
  })
  
  // Calcular percentuais sobre o total das 3 categorias (para somar 100%)
  const totalCategorizado = valorBebidas + valorComidas + valorDrinks
  const percBebidas = totalCategorizado > 0 ? (valorBebidas / totalCategorizado) * 100 : 0
  const percDrinks = totalCategorizado > 0 ? (valorDrinks / totalCategorizado) * 100 : 0
  const percComida = totalCategorizado > 0 ? (valorComidas / totalCategorizado) * 100 : 0

  console.log(`📊 Mix de Vendas (soma consolidada): Bebidas: ${percBebidas.toFixed(1)}%, Drinks: ${percDrinks.toFixed(1)}%, Comida: ${percComida.toFixed(1)}%`)
  console.log(`   Valores: Bebidas R$ ${valorBebidas.toFixed(2)}, Drinks R$ ${valorDrinks.toFixed(2)}, Comida R$ ${valorComidas.toFixed(2)}, Total R$ ${totalCategorizado.toFixed(2)}`)

  // ============================================
  // 13. COCKPIT VENDAS (faturamento por hora, venda balcão)
  // ============================================
  console.log(`💰 Calculando Cockpit Vendas...`)

  // 13.1 % FATURAMENTO ATÉ 19H (usando eventos_base que já tem fat_19h_percent)
  // Filtrar apenas dias com faturamento real (real_r > 0)
  const eventosComFaturamento = eventosBase?.filter(e => (parseFloat(e.real_r) || 0) > 0) || []
  const percFat19h = eventosComFaturamento.length > 0 
    ? eventosComFaturamento.reduce((sum, e) => sum + (parseFloat(e.fat_19h_percent) || 0), 0) / eventosComFaturamento.length 
    : 0

  console.log(`💰 % Faturamento até 19h: ${percFat19h.toFixed(1)}%`)

  // 13.2 VENDA BALCÃO (vendas sem mesa identificada ou tipovenda específico)
  const vendasData = await fetchAllData(supabase, 'contahub_vendas', 'vr_pagamentos, vd_mesadesc, tipovenda', {
    'gte_dt_gerencial': startDate,
    'lte_dt_gerencial': endDate,
    'eq_bar_id': barId
  })

  // Venda balcão: tipovenda contém 'balc' ou vd_mesadesc é número baixo ou específico
  const vendaBalcao = vendasData?.filter(item => 
    item.tipovenda?.toLowerCase().includes('balc') ||
    item.vd_mesadesc?.toLowerCase().includes('balc') ||
    item.vd_mesadesc === 'Insumo'
  ).reduce((sum, item) => sum + (parseFloat(item.vr_pagamentos) || 0), 0) || 0

  console.log(`💰 Venda Balcão: R$ ${vendaBalcao.toFixed(2)}`)

  // 13.3 % HAPPY HOUR (calculando a partir de contahub_analitico)
  const totalVendasItens = analiticoData?.filter(item => !item.grp_desc?.includes('Insumo'))
    .reduce((sum, item) => sum + (parseFloat(item.qtd) || 0), 0) || 0
  const vendasHH = analiticoData?.filter(item => item.grp_desc === 'Happy Hour')
    .reduce((sum, item) => sum + (parseFloat(item.qtd) || 0), 0) || 0
  const percHappyHour = totalVendasItens > 0 ? (vendasHH / totalVendasItens) * 100 : 0

  console.log(`🍺 % Happy Hour: ${percHappyHour.toFixed(1)}%`)

  // 13.4 QUI+SÁB+DOM (faturamento desses dias)
  const diasFDS = ['Qui', 'Qua', 'Sex', 'Sab', 'Sáb', 'Dom', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  const fatQuiSabDom = eventosBase?.filter(e => 
    diasFDS.some(d => e.dia_semana?.includes(d))
  ).reduce((sum, e) => sum + (parseFloat(e.real_r) || 0), 0) || 0

  console.log(`📅 Faturamento QUI+SAB+DOM: R$ ${fatQuiSabDom.toFixed(2)}`)

  // 13.5 % FATURAMENTO APÓS 22H (usando contahub_fatporhora)
  const fatPorHoraData = await fetchAllData(supabase, 'contahub_fatporhora', 'hora, valor', {
    'gte_vd_dtgerencial': startDate,
    'lte_vd_dtgerencial': endDate,
    'eq_bar_id': barId
  })
  
  const fatTotalHora = fatPorHoraData?.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0) || 0
  const fatApos22h = fatPorHoraData?.filter(item => {
    const hora = parseInt(item.hora) || 0
    return hora >= 22 || hora < 6 // Após 22h ou madrugada
  }).reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0) || 0
  
  const percFat22h = fatTotalHora > 0 ? (fatApos22h / fatTotalHora) * 100 : 0

  console.log(`🌙 % Faturamento após 22h: ${percFat22h.toFixed(1)}%`)

  // ============================================
  // 14. ATUALIZAR REGISTRO COM TODOS OS DADOS
  // ============================================
  const dadosAtualizados: any = {
    // Faturamentos
    faturamento_total: faturamentoTotal,
    faturamento_entrada: faturamentoCouvert,
    faturamento_bar: faturamentoBar,
    faturamento_cmovivel: faturamentoCmvivel,
    
    // Clientes
    clientes_atendidos: Math.round(clientesAtendidos),
    perc_clientes_novos: parseFloat(percClientesNovos.toFixed(2)),
    clientes_ativos: Math.round(clientesAtivosBase),
    retencao_1m: retencao1m,
    retencao_2m: retencao2m,
    
    // Tickets
    ticket_medio: ticketMedioContahub,
    tm_entrada: tmEntrada,
    tm_bar: tmBar,
    
    // CMV (percentuais calculados, cmv_rs é manual)
    cmv_limpo: cmvLimpoPercent,
    cmv_global_real: cmvGlobalPercent,
    
    // CMO e Atração
    cmo: cmoPercent,
    cmo_custo: custoTotalCMO,
    custo_atracao_faturamento: atracaoFaturamentoPercent,
    atracoes_eventos: custoAtracao,
    
    // Cockpit Financeiro (fórmulas atualizadas)
    imposto: imposto,
    comissao: comissao,
    cmv: cmvNibo,
    freelas: freelas,
    cmo_fixo_simulacao: cmoFixoSimulacao,
    alimentacao: alimentacao,
    pro_labore: proLabore,
    rh_estorno_outros_operacao: rhEstornoOutros,
    materiais: materiais,
    manutencao: manutencao,
    utensilios: utensilios,
    
    // Reservas
    reservas_totais: Math.round(reservasTotais),
    reservas_presentes: Math.round(reservasPresentes),
    pessoas_reservas_totais: Math.round(pessoasReservasTotais),
    pessoas_reservas_presentes: Math.round(pessoasReservasPresentes),
    
    // Avaliações
    avaliacoes_5_google_trip: Math.round(avaliacoes5Estrelas),
    media_avaliacoes_google: mediaGoogle,
    
    // NPS (todos os campos)
    nps_geral: npsGeral,
    nps_ambiente: npsAmbiente,
    nps_atendimento: npsAtendimento,
    nps_limpeza: npsLimpeza,
    nps_musica: npsMusica,
    nps_comida: npsComida,
    nps_drink: npsDrink,
    nps_preco: npsPreco,
    nps_reservas: npsReservas,
    
    // Cockpit Produtos
    qtde_itens_bar: Math.round(qtdeItensBar),
    qtde_itens_cozinha: Math.round(qtdeItensCozinha),
    tempo_saida_bar: tempoSaidaDrinks, // Drinks preparados: Batidos, Montados, Mexido, Preshh, Drinks, Drinks Autorais, Shot e Dose
    tempo_saida_cozinha: tempoSaidaCozinha,
    atrasos_bar: Math.round(atrasosDrinks), // Atrasos de drinks > 10min
    atrasos_cozinha: Math.round(atrasosCozinha), // Atrasos de comida > 20min
    atrasos_bar_perc: percAtrasosDrinks,
    atrasos_cozinha_perc: percAtrasosCozinha,
    atrasos_bar_detalhes: atrasosBarDetalhes,
    atrasos_cozinha_detalhes: atrasosCozinhaDetalhes,
    atrasinhos_bar: atrasinhosDrinks,
    atrasinhos_cozinha: atrasinhosCozinha,
    atrasinhos_detalhes: atrasinhosDetalhes,
    atraso_bar: atrasoDrinks,
    atraso_cozinha: atrasoCozinha,
    atraso_detalhes: atrasinhosDetalhes,
    cancelamentos: cancelamentosTotal,
    cancelamentos_detalhes: cancelamentosPorDia,
    stockout_bar: stockoutBar,
    stockout_comidas: stockoutCozinha,
    stockout_drinks: stockoutDrinks,
    stockout_bar_perc: stockoutBarPerc,
    stockout_comidas_perc: stockoutCozinhaPerc,
    stockout_drinks_perc: stockoutDrinksPerc,
    perc_bebidas: percBebidas,
    perc_drinks: percDrinks,
    perc_comida: percComida,
    perc_happy_hour: percHappyHour,
    
    // Cockpit Vendas
    perc_faturamento_ate_19h: percFat19h,
    perc_faturamento_apos_22h: percFat22h,
    qui_sab_dom: fatQuiSabDom,
    
    // Timestamp
    updated_at: new Date().toISOString()
  }

  const { data: atualizada, error: updateError } = await supabase
    .from('desempenho_semanal')
    .update(dadosAtualizados)
    .eq('id', semana.id)
    .eq('bar_id', barId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Erro ao atualizar semana: ${updateError.message}`)
  }

  console.log(`✅ Semana ${numeroSemana} atualizada com sucesso!`)
  console.log(`   💰 Fat Total: R$ ${faturamentoTotal.toFixed(2)} | Couvert: R$ ${faturamentoCouvert.toFixed(2)} | Bar: R$ ${faturamentoBar.toFixed(2)}`)
  console.log(`   🎫 TM: R$ ${ticketMedioContahub.toFixed(2)} | Clientes: ${clientesAtendidos}`)
  console.log(`   📊 CMO: ${cmoPercent.toFixed(2)}% | Atração: ${atracaoFaturamentoPercent.toFixed(2)}%`)
  
  return atualizada
}

// Função auxiliar para buscar dados com paginação
async function fetchAllData(supabase: any, tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = []
  let from = 0
  const limit = 1000
  
  while (true) {
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1)
    
    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) query = query.gte(key.replace('gte_', ''), value)
      else if (key.includes('lte_')) query = query.lte(key.replace('lte_', ''), value)
      else if (key.includes('eq_')) query = query.eq(key.replace('eq_', ''), value)
      else if (key.includes('in_')) query = query.in(key.replace('in_', ''), value)
    })
    
    const { data, error } = await query
    
    if (error) {
      console.error(`❌ Erro ao buscar ${tableName}:`, error)
      break
    }
    
    if (!data || data.length === 0) break
    
    allData.push(...data)
    if (data.length < limit) break
    
    from += limit
  }
  
  return allData
}
