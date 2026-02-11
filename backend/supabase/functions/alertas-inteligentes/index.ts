import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

interface Alerta {
  tipo: 'critico' | 'erro' | 'aviso' | 'info' | 'sucesso'
  categoria: string
  titulo: string
  mensagem: string
  dados?: Record<string, unknown>
  acoes_sugeridas?: string[]
  // Campos para referência específica
  referencia_tipo?: string  // 'evento' | 'receita' | 'reserva' | 'checklist' | 'produto'
  referencia_id?: string | number
  referencia_nome?: string
  url?: string // URL direta para visualização
}

interface AnaliseResultado {
  alertas: Alerta[]
  insights: string[]
  metricas: Record<string, number>
}

// ========================================
// 🧠 SERVIÇO DE ALERTAS INTELIGENTES
// ========================================
class AlertasInteligentesService {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
  }

  // ========================================
  // 📊 ANÁLISE DE FATURAMENTO
  // ========================================
  async analisarFaturamento(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    
    // Usar timezone de São Paulo para calcular corretamente "ontem"
    const agora = new Date()
    const spFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    })
    const partes = spFormatter.formatToParts(agora)
    const getPartValue = (type: string) => partes.find(p => p.type === type)?.value || ''
    
    const hojeStr = `${getPartValue('year')}-${getPartValue('month')}-${getPartValue('day')}`
    const horaAtual = parseInt(getPartValue('hour'))
    
    // Calcular ontem corretamente no timezone de São Paulo
    const hojeDate = new Date(`${hojeStr}T12:00:00-03:00`)
    const ontemDate = new Date(hojeDate)
    ontemDate.setDate(ontemDate.getDate() - 1)
    const ontemStr = ontemDate.toISOString().split('T')[0]
    
    // Horário limite para considerar que o sync deveria ter rodado (7h da manhã)
    const HORARIO_SYNC = 7
    
    // Buscar evento de ontem
    const { data: eventoOntem } = await this.supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId)
      .eq('data_evento', ontemStr)
      .eq('ativo', true)
      .single()

    // Se não tem evento de ontem, não gerar alertas de faturamento
    if (!eventoOntem) {
      return alertas
    }

    const faturamento = eventoOntem.real_r || 0
    const meta = eventoOntem.m1_r || 0
    const pax = eventoOntem.cl_real || 0
    
    // Verificar se os dados foram atualizados hoje (sync rodou)
    const ultimaAtualizacao = eventoOntem.updated_at ? new Date(eventoOntem.updated_at) : null
    const dataAtualizacao = ultimaAtualizacao ? ultimaAtualizacao.toISOString().split('T')[0] : null
    const syncRodouHoje = dataAtualizacao === hojeStr
    
    // LÓGICA DE HORÁRIO:
    // 1. Antes das 7h: Não gerar alertas (sync ainda não deveria ter rodado)
    // 2. Depois das 7h + sync não rodou: Alertar que sync não executou
    // 3. Depois das 7h + sync rodou + faturamento = 0: Alertar que não houve faturamento
    // 4. Depois das 7h + sync rodou + faturamento > 0: Analisar vs meta
    
    if (horaAtual < HORARIO_SYNC) {
      // Antes do horário do sync - não gerar alertas de faturamento
      return alertas
    }
    
    // Já passou do horário do sync
    if (!syncRodouHoje && faturamento === 0) {
      // Sync não rodou hoje e não tem dados
      alertas.push({
        tipo: 'aviso',
        categoria: 'sincronizacao',
        titulo: '🔄 Sincronização pendente',
        mensagem: `Os dados de faturamento de ontem (${ontemStr}) ainda não foram sincronizados. Verifique se a integração está funcionando.`,
        dados: { data: ontemStr, ultimaAtualizacao: dataAtualizacao },
        acoes_sugeridas: [
          'Verificar status da integração ContaHub/ContaAzul',
          'Executar sincronização manual se necessário',
          'Verificar logs de erro da integração'
        ],
        url: '/configuracoes/saude-dados'
      })
      return alertas
    }
    
    // Sync rodou ou tem dados - analisar faturamento
    if (meta > 0 && faturamento < meta * 0.8) {
      const percentual = ((faturamento / meta) * 100).toFixed(1)
      alertas.push({
        tipo: 'aviso',
        categoria: 'faturamento',
        titulo: '📉 Faturamento abaixo da meta',
        mensagem: `Ontem (${ontemStr}) o faturamento foi de R$ ${faturamento.toLocaleString('pt-BR')} (${percentual}% da meta de R$ ${meta.toLocaleString('pt-BR')})`,
        dados: { faturamento, meta, percentual: parseFloat(percentual), data: ontemStr },
        acoes_sugeridas: [
          'Revisar atração/evento do dia',
          'Verificar se houve problemas operacionais',
          'Comparar com mesma data do mês anterior'
        ],
        referencia_tipo: 'evento',
        referencia_id: eventoOntem.id,
        referencia_nome: `Evento ${ontemStr}`,
        url: '/estrategico/visao-geral'
      })
    } else if (meta > 0 && faturamento >= meta * 1.2) {
      const percentual = ((faturamento / meta) * 100).toFixed(1)
      alertas.push({
        tipo: 'sucesso',
        categoria: 'faturamento',
        titulo: '🎉 Meta superada!',
        mensagem: `Ontem (${ontemStr}) o faturamento foi de R$ ${faturamento.toLocaleString('pt-BR')} (${percentual}% da meta!)`,
        dados: { faturamento, meta, percentual: parseFloat(percentual), data: ontemStr },
        referencia_tipo: 'evento',
        referencia_id: eventoOntem.id,
        referencia_nome: `Evento ${ontemStr}`,
        url: '/estrategico/visao-geral'
      })
    }

    // Verificar ticket médio (só se tiver dados válidos)
    if (pax > 0 && faturamento > 0) {
      const ticketMedio = faturamento / pax
      if (ticketMedio < 80) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'ticket',
          titulo: '💰 Ticket médio baixo',
          mensagem: `Ticket médio de R$ ${ticketMedio.toFixed(2)} está abaixo do esperado (R$ 80+)`,
          dados: { ticketMedio, pax, faturamento },
          acoes_sugeridas: [
            'Revisar sugestive selling da equipe',
            'Verificar promoções que podem estar canibalizando',
            'Analisar mix de produtos vendidos'
          ],
          referencia_tipo: 'evento',
          referencia_id: eventoOntem.id,
          referencia_nome: `Evento ${ontemStr}`,
          url: '/analitico'
        })
      }
    }

    return alertas
  }

  // ========================================
  // 📈 ANÁLISE DE CMV
  // ========================================
  async analisarCMV(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    
    // Buscar CMV da última semana
    const umaSemanaAtras = new Date()
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7)
    const dataInicio = umaSemanaAtras.toISOString().split('T')[0]

    const { data: cmvData } = await this.supabase
      .from('cmv_semanal')
      .select('*')
      .eq('bar_id', barId)
      .gte('data_inicio', dataInicio)
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single()

    if (cmvData) {
      const cmvPercentual = cmvData.cmv_percentual || 0
      
      if (cmvPercentual > 35) {
        alertas.push({
          tipo: 'critico',
          categoria: 'cmv',
          titulo: '🚨 CMV acima do limite',
          mensagem: `CMV semanal está em ${cmvPercentual.toFixed(1)}% (meta: < 34%)`,
          dados: { cmvPercentual, meta: 34 },
          acoes_sugeridas: [
            'Revisar precificação dos produtos',
            'Verificar desperdício na cozinha/bar',
            'Analisar produtos com maior custo'
          ],
          referencia_tipo: 'cmv',
          referencia_id: cmvData.id,
          referencia_nome: `CMV Semana ${cmvData.data_inicio}`,
          url: '/ferramentas/cmv-semanal'
        })
      } else if (cmvPercentual > 32) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'cmv',
          titulo: '⚠️ CMV em zona de atenção',
          mensagem: `CMV semanal em ${cmvPercentual.toFixed(1)}% - próximo do limite`,
          dados: { cmvPercentual, meta: 34 },
          referencia_tipo: 'cmv',
          referencia_id: cmvData.id,
          referencia_nome: `CMV Semana ${cmvData.data_inicio}`,
          url: '/ferramentas/cmv-semanal'
        })
      }
    }

    return alertas
  }

  // ========================================
  // 👥 ANÁLISE DE CLIENTES
  // ========================================
  async analisarClientes(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    
    // Buscar clientes ativos nos últimos 7 dias vs 7 dias anteriores
    const hoje = new Date()
    const seteDiasAtras = new Date(hoje)
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
    const quatorzeDiasAtras = new Date(hoje)
    quatorzeDiasAtras.setDate(quatorzeDiasAtras.getDate() - 14)

    const { data: semanaAtual } = await this.supabase
      .from('contahub_periodo')
      .select('cli_telefone')
      .eq('bar_id', barId)
      .gte('dt_gerencial', seteDiasAtras.toISOString().split('T')[0])
      .not('cli_telefone', 'is', null)

    const { data: semanaAnterior } = await this.supabase
      .from('contahub_periodo')
      .select('cli_telefone')
      .eq('bar_id', barId)
      .gte('dt_gerencial', quatorzeDiasAtras.toISOString().split('T')[0])
      .lt('dt_gerencial', seteDiasAtras.toISOString().split('T')[0])
      .not('cli_telefone', 'is', null)

    const clientesAtual = new Set(semanaAtual?.map(c => c.cli_telefone) || []).size
    const clientesAnterior = new Set(semanaAnterior?.map(c => c.cli_telefone) || []).size

    if (clientesAnterior > 0) {
      const variacao = ((clientesAtual - clientesAnterior) / clientesAnterior) * 100

      if (variacao < -20) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'clientes',
          titulo: '📉 Queda significativa de clientes',
          mensagem: `${Math.abs(variacao).toFixed(1)}% menos clientes esta semana (${clientesAtual}) vs anterior (${clientesAnterior})`,
          dados: { clientesAtual, clientesAnterior, variacao },
          acoes_sugeridas: [
            'Verificar calendário de eventos',
            'Revisar estratégia de marketing',
            'Checar se houve problemas operacionais'
          ],
          url: '/analitico/clientes'
        })
      } else if (variacao > 20) {
        alertas.push({
          tipo: 'sucesso',
          categoria: 'clientes',
          titulo: '📈 Crescimento de clientes!',
          mensagem: `+${variacao.toFixed(1)}% de clientes esta semana!`,
          dados: { clientesAtual, clientesAnterior, variacao },
          url: '/analitico/clientes'
        })
      }
    }

    return alertas
  }

  // ========================================
  // 🔄 ANÁLISE DE ESTOQUES
  // ========================================
  async analisarEstoques(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []

    // Buscar itens com estoque baixo
    const { data: estoques } = await this.supabase
      .from('contagens_estoque')
      .select('*')
      .eq('bar_id', barId)
      .eq('alerta_variacao', true)
      .order('data_contagem', { ascending: false })
      .limit(10)

    if (estoques && estoques.length > 3) {
      alertas.push({
        tipo: 'aviso',
        categoria: 'estoque',
        titulo: '📦 Múltiplos alertas de estoque',
        mensagem: `${estoques.length} itens com variação anormal de estoque detectados`,
        dados: { quantidade: estoques.length, itens: estoques.map(e => e.descricao) },
        acoes_sugeridas: [
          'Verificar possíveis perdas ou furtos',
          'Revisar processos de contagem',
          'Checar consumo vs vendas'
        ],
        url: '/ferramentas/contagem-estoque'
      })
    }

    // Buscar anomalias de contagem
    const { data: anomalias } = await this.supabase
      .from('contagens_estoque')
      .select('*')
      .eq('bar_id', barId)
      .eq('contagem_anomala', true)
      .order('data_contagem', { ascending: false })
      .limit(5)

    if (anomalias && anomalias.length > 0) {
      alertas.push({
        tipo: 'erro',
        categoria: 'estoque',
        titulo: '🚨 Anomalias de contagem detectadas',
        mensagem: `${anomalias.length} contagem(ns) anômala(s) requer(em) atenção`,
        dados: { anomalias: anomalias.map(a => ({ descricao: a.descricao, score: a.score_anomalia })) },
        url: '/ferramentas/contagem-estoque'
      })
    }

    return alertas
  }

  // ========================================
  // ✅ ANÁLISE DE CHECKLISTS
  // ========================================
  async analisarChecklists(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)
    const ontemStr = ontem.toISOString().split('T')[0]
    const hojeStr = hoje.toISOString().split('T')[0]

    // Usar checklist_agendamentos (tabelas checklist_execucoes/itens foram removidas; checklists também)
    const { data: agendamentosPendentes, error } = await this.supabase
      .from('checklist_agendamentos')
      .select('id, status, prioridade, checklist_id, responsavel_id')
      .eq('bar_id', barId)
      .eq('data_agendada', ontemStr)
      .neq('status', 'concluido')

    if (!error && agendamentosPendentes && agendamentosPendentes.length > 0) {
      const primeiro = agendamentosPendentes[0] as any
      alertas.push({
        tipo: 'aviso',
        categoria: 'checklists',
        titulo: '📋 Checklists não concluídos',
        mensagem: `${agendamentosPendentes.length} checklist(s) agendado(s) para ontem não foi(ram) concluído(s)`,
        dados: {
          quantidade: agendamentosPendentes.length,
          checklists: agendamentosPendentes.slice(0, 5).map((c: any) => c.checklist_id || 'Agendamento'),
          responsaveis: agendamentosPendentes.slice(0, 5).map((c: any) => c.responsavel_id || 'Não definido')
        },
        acoes_sugeridas: [
          'Verificar com os responsáveis',
          'Revisar horários dos checklists',
          'Considerar ajustar templates'
        ],
        referencia_tipo: 'checklist',
        referencia_id: primeiro?.id,
        referencia_nome: 'Checklist pendente',
        url: '/configuracoes/checklists'
      })
    }

    // Alertas de execuções automáticas com falha (substituto para itens não conformes)
    const { data: logsErro } = await this.supabase
      .from('checklist_automation_logs')
      .select('id, mensagem, nivel, checklist_auto_execution_id')
      .eq('nivel', 'error')
      .gte('criado_em', ontemStr)
      .lt('criado_em', hojeStr)
      .limit(10)

    if (logsErro && logsErro.length > 0) {
      alertas.push({
        tipo: 'erro',
        categoria: 'checklists',
        titulo: '⚠️ Erros em automação de checklists',
        mensagem: `${logsErro.length} erro(s) registrado(s) nas execuções automáticas de ontem`,
        dados: {
          quantidade: logsErro.length,
          itens: logsErro.slice(0, 5).map((l: any) => l.mensagem || 'Erro')
        },
        acoes_sugeridas: [
          'Verificar logs de automação',
          'Confirmar conectividade das integrações',
          'Revisar configurações dos checklists'
        ],
        url: '/configuracoes/checklists'
      })
    }

    return alertas
  }

  // ========================================
  // 🎯 ANÁLISE DE METAS SEMANAIS/MENSAIS
  // ========================================
  async analisarMetas(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const diaDoMes = hoje.getDate()
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
    const percentualMes = (diaDoMes / diasNoMes) * 100

    // Buscar faturamento e meta do mês atual
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: eventos } = await this.supabase
      .from('eventos_base')
      .select('real_r, m1_r')
      .eq('bar_id', barId)
      .gte('data_evento', inicioMes)
      .lte('data_evento', fimMes)
      .eq('ativo', true)

    if (eventos && eventos.length > 0) {
      const faturamentoMes = eventos.reduce((acc, e) => acc + (e.real_r || 0), 0)
      const metaMes = eventos.reduce((acc, e) => acc + (e.m1_r || 0), 0)

      if (metaMes > 0) {
        const percentualAtingido = (faturamentoMes / metaMes) * 100
        const ritmoNecessario = metaMes / diasNoMes * diaDoMes // O que deveria ter até agora
        const diferencaRitmo = faturamentoMes - ritmoNecessario

        // Se estamos muito atrás do ritmo necessário
        if (percentualMes > 40 && diferencaRitmo < -metaMes * 0.1) {
          alertas.push({
            tipo: 'aviso',
            categoria: 'metas',
            titulo: '🎯 Meta mensal em risco',
            mensagem: `Faturamento de R$ ${faturamentoMes.toLocaleString('pt-BR')} (${percentualAtingido.toFixed(1)}% da meta) está R$ ${Math.abs(diferencaRitmo).toLocaleString('pt-BR')} abaixo do ritmo necessário`,
            dados: { 
              faturamentoMes, 
              metaMes, 
              percentualAtingido,
              ritmoNecessario,
              diferencaRitmo
            },
            acoes_sugeridas: [
              'Intensificar ações de marketing',
              'Revisar calendário de eventos',
              'Focar em dias com maior potencial'
            ],
            url: '/estrategico/visao-geral'
          })
        } else if (percentualMes > 50 && percentualAtingido > percentualMes + 10) {
          alertas.push({
            tipo: 'sucesso',
            categoria: 'metas',
            titulo: '🚀 Meta mensal no caminho certo!',
            mensagem: `Faturamento de R$ ${faturamentoMes.toLocaleString('pt-BR')} (${percentualAtingido.toFixed(1)}% da meta) está acima do ritmo esperado!`,
            dados: { faturamentoMes, metaMes, percentualAtingido },
            url: '/estrategico/visao-geral'
          })
        }
      }
    }

    return alertas
  }

  // ========================================
  // 🎂 ANÁLISE DE ANIVERSARIANTES
  // ========================================
  async analisarAniversariantes(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const diaAtual = hoje.getDate()
    const mesAtual = hoje.getMonth() + 1
    
    // Buscar funcionários com aniversário hoje ou próximos 3 dias
    const { data: funcionarios, error } = await this.supabase
      .from('usuarios_bar')
      .select('id, nome, data_nascimento, email, role')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .not('data_nascimento', 'is', null)

    if (error || !funcionarios) {
      return alertas
    }

    const aniversariantesHoje: { nome: string; role: string }[] = []
    const aniversariantesProximos: { nome: string; role: string; data: string; diasFaltando: number }[] = []

    for (const func of funcionarios) {
      if (!func.data_nascimento) continue
      
      const dataNasc = new Date(func.data_nascimento)
      const diaNasc = dataNasc.getDate()
      const mesNasc = dataNasc.getMonth() + 1

      // Aniversariante hoje
      if (diaNasc === diaAtual && mesNasc === mesAtual) {
        aniversariantesHoje.push({ nome: func.nome, role: func.role || 'Funcionário' })
      } else {
        // Verificar próximos 3 dias
        const anivEsteAno = new Date(hoje.getFullYear(), mesNasc - 1, diaNasc)
        if (anivEsteAno < hoje) {
          anivEsteAno.setFullYear(hoje.getFullYear() + 1)
        }
        const diffDias = Math.ceil((anivEsteAno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDias > 0 && diffDias <= 3) {
          aniversariantesProximos.push({
            nome: func.nome,
            role: func.role || 'Funcionário',
            data: anivEsteAno.toLocaleDateString('pt-BR'),
            diasFaltando: diffDias
          })
        }
      }
    }

    // Alerta para aniversariantes de hoje
    if (aniversariantesHoje.length > 0) {
      alertas.push({
        tipo: 'sucesso',
        categoria: 'aniversariantes',
        titulo: '🎂 Aniversariante(s) Hoje!',
        mensagem: aniversariantesHoje.length === 1 
          ? `Hoje é aniversário de ${aniversariantesHoje[0].nome}! Não esqueça de parabenizar.`
          : `Hoje é aniversário de ${aniversariantesHoje.length} pessoas: ${aniversariantesHoje.map(a => a.nome).join(', ')}`,
        dados: { aniversariantes: aniversariantesHoje },
        acoes_sugeridas: [
          'Parabenizar o(s) aniversariante(s)',
          'Preparar uma surpresa especial',
          'Postar nas redes sociais (se autorizado)'
        ],
        url: '/configuracoes/usuarios'
      })
    }

    // Alerta para aniversariantes próximos
    if (aniversariantesProximos.length > 0) {
      alertas.push({
        tipo: 'info',
        categoria: 'aniversariantes',
        titulo: '📅 Aniversários Próximos',
        mensagem: `${aniversariantesProximos.length} aniversário(s) nos próximos 3 dias: ${aniversariantesProximos.map(a => `${a.nome} (${a.diasFaltando === 1 ? 'amanhã' : `em ${a.diasFaltando} dias`})`).join(', ')}`,
        dados: { proximos: aniversariantesProximos },
        url: '/configuracoes/usuarios'
      })
    }

    return alertas
  }

  // ========================================
  // 📝 ANÁLISE DE RESERVAS
  // ========================================
  async analisarReservas(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)
    const amanhaStr = amanha.toISOString().split('T')[0]

    // Buscar reservas de hoje
    const { data: reservasHoje } = await this.supabase
      .from('getin_reservations')
      .select('*')
      .eq('bar_id', barId)
      .eq('reservation_date', hojeStr)
      .in('status', ['confirmed', 'pending', 'CONFIRMED', 'PENDING'])

    // Buscar reservas de amanhã
    const { data: reservasAmanha } = await this.supabase
      .from('getin_reservations')
      .select('*')
      .eq('bar_id', barId)
      .eq('reservation_date', amanhaStr)
      .in('status', ['confirmed', 'pending', 'CONFIRMED', 'PENDING'])

    // Alerta de reservas de hoje
    if (reservasHoje && reservasHoje.length > 0) {
      const totalPessoas = reservasHoje.reduce((acc, r) => acc + (r.people || 0), 0)
      const pendentes = reservasHoje.filter(r => 
        r.status?.toLowerCase() === 'pending' || !r.confirmation_sent
      )

      alertas.push({
        tipo: 'info',
        categoria: 'reservas',
        titulo: '📋 Reservas para Hoje',
        mensagem: `${reservasHoje.length} reserva(s) confirmada(s) para hoje, totalizando ${totalPessoas} pessoas`,
        dados: { 
          quantidade: reservasHoje.length, 
          totalPessoas,
          pendentes: pendentes.length,
          reservas: reservasHoje.slice(0, 5).map(r => ({
            nome: r.customer_name,
            horario: r.reservation_time,
            pessoas: r.people
          }))
        },
        referencia_tipo: 'reservas',
        referencia_nome: `${reservasHoje.length} reservas para ${hojeStr}`,
        url: '/ferramentas/calendario'
      })

      // Alerta para reservas pendentes sem confirmação
      if (pendentes.length > 0) {
        const primeiraReserva = pendentes[0]
        alertas.push({
          tipo: 'aviso',
          categoria: 'reservas',
          titulo: '⚠️ Reservas Pendentes de Confirmação',
          mensagem: `${pendentes.length} reserva(s) para hoje ainda não foi(ram) confirmada(s): ${pendentes.slice(0, 3).map(r => r.customer_name).join(', ')}`,
          dados: { 
            pendentes: pendentes.map(r => ({
              nome: r.customer_name,
              horario: r.reservation_time,
              telefone: r.customer_phone
            }))
          },
          acoes_sugeridas: [
            'Ligar para confirmar reservas',
            'Enviar mensagem de confirmação',
            'Atualizar status no sistema'
          ],
          referencia_tipo: 'reserva',
          referencia_id: primeiraReserva.id,
          referencia_nome: `${primeiraReserva.customer_name} - ${primeiraReserva.reservation_time}`,
          url: '/ferramentas/calendario'
        })
      }
    }

    // Alerta de reservas de amanhã
    if (reservasAmanha && reservasAmanha.length > 0) {
      const totalPessoas = reservasAmanha.reduce((acc, r) => acc + (r.people || 0), 0)
      
      alertas.push({
        tipo: 'info',
        categoria: 'reservas',
        titulo: '📅 Reservas para Amanhã',
        mensagem: `${reservasAmanha.length} reserva(s) para amanhã, totalizando ${totalPessoas} pessoas`,
        dados: { 
          quantidade: reservasAmanha.length, 
          totalPessoas
        },
        url: '/ferramentas/calendario'
      })
    }

    // Verificar no-shows recentes (últimos 7 dias)
    const seteDiasAtras = new Date(hoje)
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
    const seteDiasAtrasStr = seteDiasAtras.toISOString().split('T')[0]

    const { data: noShows } = await this.supabase
      .from('getin_reservations')
      .select('*')
      .eq('bar_id', barId)
      .eq('no_show', true)
      .gte('reservation_date', seteDiasAtrasStr)

    if (noShows && noShows.length >= 3) {
      alertas.push({
        tipo: 'aviso',
        categoria: 'reservas',
        titulo: '⚠️ Alto índice de no-shows',
        mensagem: `${noShows.length} no-show(s) nos últimos 7 dias. Considere políticas de confirmação mais rígidas.`,
        dados: { noShows: noShows.length },
        acoes_sugeridas: [
          'Implementar taxa de no-show',
          'Ligar para confirmar reservas com antecedência',
          'Enviar lembretes automáticos por WhatsApp'
        ],
        url: '/ferramentas/calendario'
      })
    }

    return alertas
  }

  // ========================================
  // 💰 ANÁLISE DE PAGAMENTOS
  // ========================================
  async analisarPagamentos(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]
    
    // Próximos 7 dias
    const seteDias = new Date(hoje)
    seteDias.setDate(seteDias.getDate() + 7)
    const seteDiasStr = seteDias.toISOString().split('T')[0]

    // Buscar pagamentos vencendo hoje
    const { data: vencendoHoje } = await this.supabase
      .from('nibo_agendamentos')
      .select('*')
      .eq('bar_id', barId)
      .eq('data_vencimento', hojeStr)
      .eq('tipo', 'pagar')
      .neq('status', 'pago')
      .eq('deletado', false)

    // Buscar pagamentos vencidos (não pagos)
    const { data: vencidos } = await this.supabase
      .from('nibo_agendamentos')
      .select('*')
      .eq('bar_id', barId)
      .lt('data_vencimento', hojeStr)
      .eq('tipo', 'pagar')
      .neq('status', 'pago')
      .eq('deletado', false)

    // Buscar pagamentos próximos 7 dias
    const { data: proximosPagamentos } = await this.supabase
      .from('nibo_agendamentos')
      .select('*')
      .eq('bar_id', barId)
      .gt('data_vencimento', hojeStr)
      .lte('data_vencimento', seteDiasStr)
      .eq('tipo', 'pagar')
      .neq('status', 'pago')
      .eq('deletado', false)

    // Alerta de contas vencidas
    if (vencidos && vencidos.length > 0) {
      const valorTotal = vencidos.reduce((acc, v) => acc + (v.valor || 0), 0)
      const primeiraConta = vencidos[0]
      alertas.push({
        tipo: 'critico',
        categoria: 'pagamentos',
        titulo: '🚨 Contas Vencidas!',
        mensagem: `${vencidos.length} conta(s) vencida(s) totalizando R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        dados: { 
          quantidade: vencidos.length, 
          valorTotal,
          contas: vencidos.slice(0, 5).map(v => ({
            descricao: v.descricao || v.titulo,
            valor: v.valor,
            vencimento: v.data_vencimento,
            fornecedor: v.stakeholder_nome
          }))
        },
        acoes_sugeridas: [
          'Efetuar pagamento imediatamente',
          'Verificar possíveis multas/juros',
          'Renegociar prazos se necessário'
        ],
        referencia_tipo: 'pagamento',
        referencia_id: primeiraConta.id,
        referencia_nome: primeiraConta.descricao || primeiraConta.titulo || 'Conta vencida',
        url: '/fp'
      })
    }

    // Alerta de contas vencendo hoje
    if (vencendoHoje && vencendoHoje.length > 0) {
      const valorTotal = vencendoHoje.reduce((acc, v) => acc + (v.valor || 0), 0)
      const primeiraConta = vencendoHoje[0]
      alertas.push({
        tipo: 'aviso',
        categoria: 'pagamentos',
        titulo: '⚠️ Contas Vencendo Hoje',
        mensagem: `${vencendoHoje.length} conta(s) vencem hoje, totalizando R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        dados: { 
          quantidade: vencendoHoje.length, 
          valorTotal,
          contas: vencendoHoje.map(v => ({
            descricao: v.descricao || v.titulo,
            valor: v.valor,
            fornecedor: v.stakeholder_nome
          }))
        },
        acoes_sugeridas: [
          'Efetuar pagamentos antes do fechamento bancário',
          'Verificar saldo disponível'
        ],
        referencia_tipo: 'pagamento',
        referencia_id: primeiraConta.id,
        referencia_nome: primeiraConta.descricao || primeiraConta.titulo || 'Conta vencendo',
        url: '/fp'
      })
    }

    // Alerta de contas próximas (resumo)
    if (proximosPagamentos && proximosPagamentos.length > 0) {
      const valorTotal = proximosPagamentos.reduce((acc, v) => acc + (v.valor || 0), 0)
      alertas.push({
        tipo: 'info',
        categoria: 'pagamentos',
        titulo: '💰 Pagamentos Próximos',
        mensagem: `${proximosPagamentos.length} conta(s) a vencer nos próximos 7 dias, totalizando R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        dados: { 
          quantidade: proximosPagamentos.length, 
          valorTotal 
        },
        url: '/fp'
      })
    }

    // Buscar recebimentos esperados
    const { data: recebimentos } = await this.supabase
      .from('nibo_agendamentos')
      .select('*')
      .eq('bar_id', barId)
      .lte('data_vencimento', seteDiasStr)
      .gte('data_vencimento', hojeStr)
      .eq('tipo', 'receber')
      .neq('status', 'pago')
      .eq('deletado', false)

    if (recebimentos && recebimentos.length > 0) {
      const valorTotal = recebimentos.reduce((acc, v) => acc + (v.valor || 0), 0)
      alertas.push({
        tipo: 'sucesso',
        categoria: 'pagamentos',
        titulo: '💵 Recebimentos Esperados',
        mensagem: `${recebimentos.length} recebimento(s) esperado(s) nos próximos 7 dias, totalizando R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        dados: { 
          quantidade: recebimentos.length, 
          valorTotal 
        },
        url: '/fp'
      })
    }

    return alertas
  }

  // ========================================
  // 📦 ANÁLISE DE ESTOQUE DETALHADA
  // ========================================
  async analisarEstoqueDetalhado(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]
    
    // Buscar última contagem de estoque
    const { data: ultimaContagem } = await this.supabase
      .from('contagem_estoque_produtos')
      .select('*')
      .eq('bar_id', barId)
      .order('data_contagem', { ascending: false })
      .limit(100)

    if (!ultimaContagem || ultimaContagem.length === 0) {
      return alertas
    }

    // Identificar produtos com estoque baixo (usando variação ou estoque zerado)
    const produtosEstoqueBaixo = ultimaContagem.filter(p => 
      p.estoque_total <= 0 || p.alerta_variacao === true
    )

    if (produtosEstoqueBaixo.length > 0) {
      const zerados = produtosEstoqueBaixo.filter(p => p.estoque_total <= 0)
      const comVariacao = produtosEstoqueBaixo.filter(p => p.alerta_variacao && p.estoque_total > 0)

      if (zerados.length > 0) {
        const primeiroProduto = zerados[0]
        alertas.push({
          tipo: 'critico',
          categoria: 'estoque',
          titulo: '🚨 Produtos com Estoque Zerado!',
          mensagem: `${zerados.length} produto(s) estão com estoque zerado e precisam reposição urgente`,
          dados: { 
            quantidade: zerados.length,
            produtos: zerados.slice(0, 10).map(p => ({
              descricao: p.descricao,
              categoria: p.categoria
            }))
          },
          acoes_sugeridas: [
            'Fazer pedido de reposição urgente',
            'Verificar alternativas com fornecedores',
            'Atualizar cardápio se necessário'
          ],
          referencia_tipo: 'produto',
          referencia_id: primeiroProduto.id,
          referencia_nome: primeiroProduto.descricao,
          url: '/ferramentas/contagem-estoque'
        })
      }

      if (comVariacao.length > 0) {
        const primeiroProduto = comVariacao[0]
        alertas.push({
          tipo: 'aviso',
          categoria: 'estoque',
          titulo: '⚠️ Variações Anormais de Estoque',
          mensagem: `${comVariacao.length} produto(s) apresentam variação anormal de estoque`,
          dados: { 
            quantidade: comVariacao.length,
            produtos: comVariacao.slice(0, 5).map(p => ({
              descricao: p.descricao,
              variacao: p.variacao_percentual
            }))
          },
          acoes_sugeridas: [
            'Investigar possíveis perdas',
            'Verificar processos de controle',
            'Revisar contagem de estoque'
          ],
          referencia_tipo: 'produto',
          referencia_id: primeiroProduto.id,
          referencia_nome: primeiroProduto.descricao,
          url: '/ferramentas/contagem-estoque'
        })
      }
    }

    // Verificar última data de contagem (se muito antiga)
    if (ultimaContagem.length > 0) {
      const ultimaData = new Date(ultimaContagem[0].data_contagem)
      const diasSemContagem = Math.ceil((hoje.getTime() - ultimaData.getTime()) / (1000 * 60 * 60 * 24))

      if (diasSemContagem > 7) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'estoque',
          titulo: '📦 Contagem de Estoque Desatualizada',
          mensagem: `Última contagem foi há ${diasSemContagem} dias. Recomenda-se contagem semanal.`,
          dados: { diasSemContagem, ultimaContagem: ultimaData.toLocaleDateString('pt-BR') },
          acoes_sugeridas: [
            'Realizar nova contagem de estoque',
            'Agendar contagens periódicas'
          ],
          url: '/ferramentas/contagem-estoque'
        })
      }
    }

    return alertas
  }

  // ========================================
  // ⭐ ANÁLISE DE AVALIAÇÕES
  // ========================================
  async analisarAvaliacoes(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    const hoje = new Date()
    const seteDiasAtras = new Date(hoje)
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
    const seteDiasAtrasStr = seteDiasAtras.toISOString().split('T')[0]

    // Buscar avaliações do NPS interno
    const { data: npsRecentes } = await this.supabase
      .from('nps')
      .select('*')
      .eq('bar_id', barId)
      .gte('data_pesquisa', seteDiasAtrasStr)
      .order('data_pesquisa', { ascending: false })

    if (npsRecentes && npsRecentes.length > 0) {
      // Calcular média geral
      const mediaGeral = npsRecentes.reduce((acc, n) => acc + (n.nps_geral || n.media_geral || 0), 0) / npsRecentes.length

      if (mediaGeral < 7) {
        alertas.push({
          tipo: 'critico',
          categoria: 'avaliacoes',
          titulo: '🚨 NPS Crítico!',
          mensagem: `Média de NPS da última semana: ${mediaGeral.toFixed(1)}/10. Ação urgente necessária!`,
          dados: { 
            mediaGeral,
            totalAvaliacoes: npsRecentes.length
          },
          acoes_sugeridas: [
            'Analisar comentários dos clientes',
            'Identificar pontos de melhoria prioritários',
            'Treinar equipe em pontos críticos'
          ],
          url: '/ferramentas/nps'
        })
      } else if (mediaGeral < 8) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'avaliacoes',
          titulo: '⚠️ NPS em Atenção',
          mensagem: `Média de NPS da última semana: ${mediaGeral.toFixed(1)}/10. Há espaço para melhorias.`,
          dados: { mediaGeral, totalAvaliacoes: npsRecentes.length },
          url: '/ferramentas/nps'
        })
      } else if (mediaGeral >= 9) {
        alertas.push({
          tipo: 'sucesso',
          categoria: 'avaliacoes',
          titulo: '⭐ NPS Excelente!',
          mensagem: `Média de NPS da última semana: ${mediaGeral.toFixed(1)}/10. Continue o ótimo trabalho!`,
          dados: { mediaGeral, totalAvaliacoes: npsRecentes.length },
          url: '/ferramentas/nps'
        })
      }

      // Verificar avaliações específicas baixas
      const avaliacoesAtendimento = npsRecentes.filter(n => n.nps_atendimento && n.nps_atendimento < 7)
      const avaliacoesComida = npsRecentes.filter(n => n.nps_comida && n.nps_comida < 7)
      const avaliacoesLimpeza = npsRecentes.filter(n => n.nps_limpeza && n.nps_limpeza < 7)

      if (avaliacoesAtendimento.length >= 3) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'avaliacoes',
          titulo: '👥 Problemas com Atendimento',
          mensagem: `${avaliacoesAtendimento.length} avaliações recentes apontam problemas no atendimento`,
          dados: { quantidade: avaliacoesAtendimento.length },
          acoes_sugeridas: ['Treinar equipe de atendimento', 'Verificar escala de funcionários'],
          url: '/ferramentas/nps'
        })
      }

      if (avaliacoesComida.length >= 3) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'avaliacoes',
          titulo: '🍽️ Problemas com Comida/Drinks',
          mensagem: `${avaliacoesComida.length} avaliações recentes apontam problemas com comida/drinks`,
          dados: { quantidade: avaliacoesComida.length },
          acoes_sugeridas: ['Revisar qualidade dos ingredientes', 'Verificar processos da cozinha'],
          url: '/ferramentas/nps'
        })
      }

      if (avaliacoesLimpeza.length >= 3) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'avaliacoes',
          titulo: '🧹 Problemas com Limpeza',
          mensagem: `${avaliacoesLimpeza.length} avaliações recentes apontam problemas com limpeza`,
          dados: { quantidade: avaliacoesLimpeza.length },
          acoes_sugeridas: ['Intensificar rotina de limpeza', 'Verificar checklists de limpeza'],
          url: '/ferramentas/nps'
        })
      }
    }

    // Buscar avaliações do Google (google_reviews - Apify)
    const { data: googleReviews } = await this.supabase
      .from('google_reviews')
      .select('*')
      .gte('published_at_date', seteDiasAtrasStr)
      .order('published_at_date', { ascending: false })
      .limit(20)

    if (googleReviews && googleReviews.length > 0) {
      // Contar avaliações negativas (1-2 estrelas)
      const avaliacoesNegativas = googleReviews.filter(r => {
        return r.stars && r.stars <= 2
      })

      if (avaliacoesNegativas.length > 0) {
        alertas.push({
          tipo: 'aviso',
          categoria: 'avaliacoes',
          titulo: '⭐ Avaliações Negativas no Google',
          mensagem: `${avaliacoesNegativas.length} avaliação(ões) negativa(s) no Google nos últimos 7 dias`,
          dados: { 
            quantidade: avaliacoesNegativas.length,
            avaliacoes: avaliacoesNegativas.slice(0, 3).map(r => ({
              autor: r.name,
              comentario: r.text?.substring(0, 100)
            }))
          },
          acoes_sugeridas: [
            'Responder às avaliações no Google',
            'Identificar problemas mencionados',
            'Contatar cliente para resolver (se possível)'
          ],
          url: '/ferramentas/google-reviews'
        })
      }
    }

    return alertas
  }

  // ========================================
  // 📅 ANÁLISE DE EVENTOS PRÓXIMOS
  // ========================================
  async analisarEventosProximos(barId: number): Promise<Alerta[]> {
    const alertas: Alerta[] = []
    
    // 🇧🇷 Usar timezone de Brasília (Edge roda em UTC)
    const agora = new Date()
    const spFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const partes = spFormatter.formatToParts(agora)
    const getPart = (t: string) => partes.find(p => p.type === t)?.value || ''
    const hojeStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const hojeDate = new Date(`${hojeStr}T12:00:00-03:00`)
    const amanhaDate = new Date(hojeDate)
    amanhaDate.setDate(amanhaDate.getDate() + 1)
    const amanhaStr = amanhaDate.toISOString().split('T')[0]

    // Buscar evento de amanhã
    const { data: eventoAmanha } = await this.supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId)
      .eq('data_evento', amanhaStr)
      .eq('ativo', true)
      .maybeSingle()

    if (eventoAmanha) {
      const meta = eventoAmanha.m1_r || 0
      const atracao = eventoAmanha.artista || eventoAmanha.nome || 'Sem atração definida'

      alertas.push({
        tipo: 'info',
        categoria: 'eventos',
        titulo: '📅 Evento amanhã',
        mensagem: `Amanhã (${amanhaStr}): ${atracao}. Meta: R$ ${meta.toLocaleString('pt-BR')}`,
        dados: { 
          data: amanhaStr, 
          atracao, 
          meta,
          diaSemana: amanhaDate.toLocaleDateString('pt-BR', { weekday: 'long' })
        },
        referencia_tipo: 'evento',
        referencia_id: eventoAmanha.id,
        referencia_nome: `${atracao} - ${amanhaStr}`,
        url: '/analitico/eventos'
      })
    } else {
      // Verificar se é dia que deveria ter evento (4=qui, 5=sex, 6=sáb)
      const diaSemana = amanhaDate.getDay()
      if (diaSemana >= 4 && diaSemana <= 6) { // Qui, Sex, Sab
        alertas.push({
          tipo: 'aviso',
          categoria: 'eventos',
          titulo: '⚠️ Sem evento cadastrado',
          mensagem: `Não há evento cadastrado para amanhã (${amanhaDate.toLocaleDateString('pt-BR', { weekday: 'long' })})`,
          dados: { data: amanhaStr },
          acoes_sugeridas: [
            'Verificar calendário de eventos',
            'Cadastrar evento se houver',
            'Confirmar se é dia de operação'
          ],
          url: '/analitico/eventos'
        })
      }
    }

    return alertas
  }

  // ========================================
  // 🤖 ANÁLISE COM IA (Gemini)
  // ========================================
  async analisarComIA(dados: Record<string, unknown>): Promise<string[]> {
    if (!geminiApiKey) {
      console.log('Gemini API Key não configurada')
      return []
    }

    try {
      const prompt = `
Você é um analista de negócios de um bar/restaurante. Analise os dados abaixo e retorne até 3 insights relevantes.
Seja direto e objetivo. Foque em ações que podem ser tomadas.

Dados:
${JSON.stringify(dados, null, 2)}

Retorne APENAS um JSON array de strings com os insights, sem markdown:
["insight 1", "insight 2", "insight 3"]
`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500
            }
          })
        }
      )

      if (!response.ok) {
        console.error('Erro na API Gemini:', response.status)
        return []
      }

      const result = await response.json()
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      
      // Extrair JSON do texto
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      return []
    } catch (error) {
      console.error('Erro ao analisar com IA:', error)
      return []
    }
  }

  // ========================================
  // 🔔 EXECUTAR ANÁLISE COMPLETA
  // ========================================
  async executarAnaliseCompleta(barId: number): Promise<AnaliseResultado> {
    console.log(`[Alertas Inteligentes] Iniciando análise para bar ${barId}`)

    // Executar todas as análises em paralelo
    const [
      alertasFaturamento, 
      alertasCMV, 
      alertasClientes, 
      alertasEstoques,
      alertasChecklists,
      alertasMetas,
      alertasEventos,
      alertasAniversariantes,
      alertasReservas,
      alertasPagamentos,
      alertasEstoqueDetalhado,
      alertasAvaliacoes
    ] = await Promise.all([
      this.analisarFaturamento(barId),
      this.analisarCMV(barId),
      this.analisarClientes(barId),
      this.analisarEstoques(barId),
      this.analisarChecklists(barId),
      this.analisarMetas(barId),
      this.analisarEventosProximos(barId),
      this.analisarAniversariantes(barId),
      this.analisarReservas(barId),
      this.analisarPagamentos(barId),
      this.analisarEstoqueDetalhado(barId),
      this.analisarAvaliacoes(barId)
    ])

    const todosAlertas = [
      ...alertasFaturamento,
      ...alertasCMV,
      ...alertasClientes,
      ...alertasEstoques,
      ...alertasChecklists,
      ...alertasMetas,
      ...alertasEventos,
      ...alertasAniversariantes,
      ...alertasReservas,
      ...alertasPagamentos,
      ...alertasEstoqueDetalhado,
      ...alertasAvaliacoes
    ]

    // Coletar métricas para análise IA
    const metricas: Record<string, number> = {}
    todosAlertas.forEach(a => {
      if (a.dados) {
        Object.entries(a.dados).forEach(([key, value]) => {
          if (typeof value === 'number') {
            metricas[`${a.categoria}_${key}`] = value
          }
        })
      }
    })

    // Gerar insights com IA (se houver dados)
    let insights: string[] = []
    if (Object.keys(metricas).length > 0) {
      insights = await this.analisarComIA({ metricas, alertas: todosAlertas.map(a => a.titulo) })
    }

    console.log(`[Alertas Inteligentes] Análise concluída: ${todosAlertas.length} alertas, ${insights.length} insights`)

    return {
      alertas: todosAlertas,
      insights,
      metricas
    }
  }

  // ========================================
  // 📤 ENVIAR PARA DISCORD
  // ========================================
  async enviarParaDiscord(barId: number, resultado: AnaliseResultado): Promise<boolean> {
    // Buscar webhook configurado
    const { data: webhook } = await this.supabase
      .from('discord_webhooks')
      .select('webhook_url')
      .eq('bar_id', barId)
      .eq('tipo', 'alertas')
      .eq('ativo', true)
      .single()

    if (!webhook?.webhook_url) {
      console.log('Webhook de alertas não configurado')
      return false
    }

    // Filtrar apenas alertas importantes (crítico, erro, aviso)
    const alertasImportantes = resultado.alertas.filter(a => 
      ['critico', 'erro', 'aviso'].includes(a.tipo)
    )

    if (alertasImportantes.length === 0 && resultado.insights.length === 0) {
      console.log('Nenhum alerta importante para enviar')
      return true
    }

    // Montar embed
    const fields = alertasImportantes.map(alerta => {
      const emoji = alerta.tipo === 'critico' ? '🚨' : 
                    alerta.tipo === 'erro' ? '❌' : 
                    alerta.tipo === 'aviso' ? '⚠️' : 'ℹ️'
      return {
        name: `${emoji} ${alerta.titulo}`,
        value: alerta.mensagem.substring(0, 200),
        inline: false
      }
    })

    // Adicionar insights
    if (resultado.insights.length > 0) {
      fields.push({
        name: '💡 Insights da IA',
        value: resultado.insights.map(i => `• ${i}`).join('\n').substring(0, 500),
        inline: false
      })
    }

    const color = resultado.alertas.some(a => a.tipo === 'critico') ? 0xff0000 :
                  resultado.alertas.some(a => a.tipo === 'erro') ? 0xff6600 :
                  resultado.alertas.some(a => a.tipo === 'aviso') ? 0xffcc00 : 0x00ff00

    const embed = {
      title: `🤖 Análise Inteligente - ${new Date().toLocaleDateString('pt-BR')}`,
      description: `Foram detectados **${alertasImportantes.length}** alertas e gerados **${resultado.insights.length}** insights.`,
      color,
      fields,
      footer: { text: 'SGB - Agente de Análise Automática' },
      timestamp: new Date().toISOString()
    }

    try {
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      })

      return response.ok
    } catch (error) {
      console.error('Erro ao enviar para Discord:', error)
      return false
    }
  }

  // ========================================
  // 💾 SALVAR ALERTAS NO BANCO
  // ========================================
  async salvarAlertas(barId: number, alertas: Alerta[]): Promise<void> {
    for (const alerta of alertas) {
      await this.supabase
        .from('alertas_enviados')
        .insert({
          bar_id: barId,
          tipo: alerta.tipo,
          categoria: alerta.categoria,
          titulo: alerta.titulo,
          mensagem: alerta.mensagem,
          dados: alerta.dados || {},
          criado_em: new Date().toISOString()
        })
    }
  }
}

// ========================================
// 🚀 HANDLER PRINCIPAL
// ========================================
serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const body = await req.json()
    const { action = 'analisar', barId = 3, enviarDiscord = true } = body

    const service = new AlertasInteligentesService()

    switch (action) {
      case 'analisar': {
        const resultado = await service.executarAnaliseCompleta(barId)
        
        // Salvar alertas
        if (resultado.alertas.length > 0) {
          await service.salvarAlertas(barId, resultado.alertas)
        }

        // Enviar para Discord se configurado
        if (enviarDiscord) {
          await service.enviarParaDiscord(barId, resultado)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            resultado,
            message: `Análise concluída: ${resultado.alertas.length} alertas detectados`
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'faturamento': {
        const alertas = await service.analisarFaturamento(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'cmv': {
        const alertas = await service.analisarCMV(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'clientes': {
        const alertas = await service.analisarClientes(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'estoques': {
        const alertas = await service.analisarEstoques(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'aniversariantes': {
        const alertas = await service.analisarAniversariantes(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'reservas': {
        const alertas = await service.analisarReservas(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'pagamentos': {
        const alertas = await service.analisarPagamentos(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'estoque-detalhado': {
        const alertas = await service.analisarEstoqueDetalhado(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'avaliacoes': {
        const alertas = await service.analisarAvaliacoes(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'checklists': {
        const alertas = await service.analisarChecklists(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'metas': {
        const alertas = await service.analisarMetas(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'eventos': {
        const alertas = await service.analisarEventosProximos(barId)
        return new Response(
          JSON.stringify({ success: true, alertas }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação inválida' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Erro na Edge Function alertas-inteligentes:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
