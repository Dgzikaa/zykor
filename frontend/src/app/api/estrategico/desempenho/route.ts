import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { filtrarDiasAbertos } from '@/lib/helpers/calendario-helper';

// Cache por 2 minutos para dados de desempenho
export const revalidate = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache em memória para dados de desempenho
const performanceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em millisegundos

export async function GET(request: NextRequest) {
  try {
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 API Desempenho - Buscando dados de performance');
    }

    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes');
    const mes = mesParam ? parseInt(mesParam) : null;
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());

    // Limpar cache temporariamente para debug
    const cacheKey = `desempenho-${user.bar_id}-${mes}-${ano}`;
    performanceCache.delete(cacheKey); // Forçar busca nova
    
    // const cached = performanceCache.get(cacheKey);
    // if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    //   if (process.env.NODE_ENV === 'development') {
    //     console.log('📦 Dados retornados do cache');
    //   }
    //   return NextResponse.json(cached.data);
    // }

    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`📅 Buscando dados de desempenho para ${mes}/${ano} - Bar ID: ${user.bar_id}`);
    }

    // Buscar eventos básicos de todo o ano
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select(`
        id,
        data_evento,
        nome,
        dia_semana,
        semana,
        cl_real,
        real_r,
        m1_r,
        cl_plan,
        te_real,
        tb_real,
        percent_art_fat,
        c_art,
        c_prod,
        res_tot,
        res_p
      `)
      .eq('bar_id', user.bar_id)
      .gte('data_evento', `${ano}-01-01`)
      .lt('data_evento', `${ano + 1}-01-01`)
      .eq('ativo', true)
      .order('data_evento', { ascending: true });

    if (eventosError) {
      console.error('❌ Erro ao buscar eventos:', eventosError);
      return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 });
    }

    // ⚡ FILTRAR DIAS FECHADOS
    const eventosFiltrados = await filtrarDiasAbertos(eventos || [], 'data_evento', user.bar_id);
    console.log(`📅 Eventos filtrados: ${eventos?.length || 0} → ${eventosFiltrados.length} (removidos ${(eventos?.length || 0) - eventosFiltrados.length} dias fechados)`);

    // Função para buscar dados agregados (RPC aggregate_by_date não existe - usar fallback direto)
    const fetchAggregatedData = async (table: string, dateColumn: string, aggregateColumn: string, _aggregateFunction = 'sum') => {
      return await fetchAllDataFallback(table, `${dateColumn}, ${aggregateColumn}`, dateColumn);
    };

    // Função de fallback (método original) caso RPC não esteja disponível
    const fetchAllDataFallback = async (table: string, columns: string, dateColumn: string) => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .gte(dateColumn, `${ano}-01-01`)
        .lt(dateColumn, `${ano + 1}-01-01`)
        .eq('bar_id', user.bar_id)
        .limit(10000) // Limite maior para reduzir chamadas
        .order(dateColumn);

      if (error) {
        console.error(`❌ Erro ao buscar dados de ${table}:`, error);
        return [];
      }

      return data || [];
    };

    // Função para buscar dados do ContaHub (agregação será feita no código)
    const fetchContaHubData = async () => {
      const { data, error } = await supabase
        .from('contahub_pagamentos')
        .select('dt_gerencial, liquido')
        .gte('dt_gerencial', `${ano}-01-01`)
        .lt('dt_gerencial', `${ano + 1}-01-01`)
        .neq('meio', 'Conta Assinada')  // Excluir consumo de sócios
        .eq('bar_id', user.bar_id)
        .limit(10000)
        .order('dt_gerencial');

      if (error) {
        console.error('❌ Erro ao buscar dados do ContaHub:', error);
        return [];
      }

      return data || [];
    };

    // OTIMIZAÇÃO: Como estamos usando real_r da tabela eventos_base,
    // só precisamos buscar dados externos para debug/comparação
    const [yuzerData, symplaData, contahubData] = await Promise.all([
      fetchAllDataFallback('yuzer_pagamento', 'data_evento, valor_liquido', 'data_evento'),
      fetchAllDataFallback('sympla_resumo', 'data_evento, total_liquido', 'data_evento'), 
      fetchContaHubData()
    ]);

    // Logs básicos apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Dados carregados - Yuzer: ${yuzerData.length}, Sympla: ${symplaData.length}, ContaHub: ${contahubData.length}`);
    }

    // Criar mapas agregados (somar valores por data)
    const yuzerMap = new Map();
    yuzerData?.forEach((item: any) => {
      const data = item.data_evento;
      const valor = item.valor_liquido || 0;
      yuzerMap.set(data, (yuzerMap.get(data) || 0) + valor);
    });

    const symplaMap = new Map();
    symplaData?.forEach((item: any) => {
      const data = item.data_evento;
      const valor = item.total_liquido || 0;
      symplaMap.set(data, (symplaMap.get(data) || 0) + valor);
    });

    const contahubMap = new Map();
    contahubData?.forEach(item => {
      const data = item.dt_gerencial;
      const valor = item.liquido || 0;
      contahubMap.set(data, (contahubMap.get(data) || 0) + valor);
    });

    // Buscar dados do Getin para reservas (agregação será feita no código)
    const { data: getinData } = await supabase
      .from('getin_reservations')
      .select('reservation_date')
      .gte('reservation_date', `${ano}-01-01`)
      .lt('reservation_date', `${ano + 1}-01-01`)
      .eq('bar_id', user.bar_id)
      .limit(10000)
      .order('reservation_date');

    const getinMap = new Map();
    getinData?.forEach(item => {
      const data = item.reservation_date;
      getinMap.set(data, (getinMap.get(data) || 0) + 1);
    });

    // Buscar dados do ContaHub Período para couvert (com paginação) - usar vr_couvert específico
    let contahubPeriodoData: { dt_gerencial: any; vr_couvert: any; }[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData } = await supabase
        .from('contahub_periodo')
        .select('dt_gerencial, vr_couvert')
        .gte('dt_gerencial', `${ano}-01-01`)
        .lt('dt_gerencial', `${ano + 1}-01-01`)
        .eq('bar_id', user.bar_id)
        .order('dt_gerencial')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageData && pageData.length > 0) {
        contahubPeriodoData = [...contahubPeriodoData, ...pageData];
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Remover duplicatas dos dados do ContaHub Período
    const contahubPeriodoUnicos: { dt_gerencial: any; vr_couvert: any; }[] = [];
    const chavesVistas = new Set();
    
    contahubPeriodoData?.forEach(item => {
      // Criar chave única baseada em campos que não deveriam se repetir
      const chave = `${item.dt_gerencial}`;
      // Para período, vamos apenas somar os valores por data (não há problema de duplicata real aqui)
      contahubPeriodoUnicos.push(item);
    });

    const contahubCouvertMap = new Map();
    contahubPeriodoUnicos.forEach(item => {
      const data = item.dt_gerencial;
      const valor = item.vr_couvert || 0;
      contahubCouvertMap.set(data, (contahubCouvertMap.get(data) || 0) + valor);
    });

    // Buscar dados do ContaHub para calcular clientes ativos (2+ visitas) - com paginação
    let contahubClientesData: { cli_fone: any; dt_gerencial: any; }[] = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
      const { data: pageData } = await supabase
        .from('contahub_periodo')
        .select('cli_fone, dt_gerencial')
        .eq('bar_id', user.bar_id)
        .gte('dt_gerencial', `${ano}-01-01`)
        .lt('dt_gerencial', `${ano + 1}-01-01`)
        .not('cli_fone', 'is', null)
        .order('dt_gerencial')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageData && pageData.length > 0) {
        contahubClientesData = [...contahubClientesData, ...pageData];
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Buscar dados do Nibo para CMO
    const categoriasCMO = [
      'SALARIO FUNCIONARIOS', 'VALE TRANSPORTE', 'ALIMENTAÇÃO', 'ADICIONAIS',
      'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA',
      'FREELA SEGURANÇA', 'PRO LABORE', 'PROVISÃO TRABALHISTA'
    ];

    // Buscar dados do Nibo para CMO - com paginação
    let niboData: { data_competencia: any; valor: any; categoria_nome?: any; }[] = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
      const { data: pageData } = await supabase
        .from('nibo_agendamentos')
        .select('data_competencia, valor, categoria_nome')
        .gte('data_competencia', `${ano}-01-01`)
        .lt('data_competencia', `${ano + 1}-01-01`)
        .eq('bar_id', user.bar_id)
        .in('categoria_nome', categoriasCMO)
        .order('data_competencia')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageData && pageData.length > 0) {
        niboData = [...niboData, ...pageData];
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Mapear CMO por mês/ano (competência mensal)
    const niboMap = new Map();
    niboData?.forEach(item => {
      const competencia = new Date(item.data_competencia);
      const chaveCompetencia = `${competencia.getFullYear()}-${(competencia.getMonth() + 1).toString().padStart(2, '0')}`;
      const valor = item.valor || 0;
      niboMap.set(chaveCompetencia, (niboMap.get(chaveCompetencia) || 0) + valor);
    });

    // Debug específico removido para reduzir logs desnecessários

    if (!eventosFiltrados || eventosFiltrados.length === 0) {
      // Log apenas em modo verbose
      if (process.env.NEXT_PUBLIC_VERBOSE_LOGS === 'true') {
        console.log('⚠️ Nenhum evento encontrado para o período');
      }
      return NextResponse.json({ 
        success: true,
        mes: mes,
        ano: ano,
        eventos: [],
        total_eventos: 0
      });
    }

    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${eventosFiltrados.length} eventos encontrados`);
    }

    // Função para calcular número da semana ISO (corrigida)
    const getWeekNumber = (date: Date): number => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    // Função para obter período da semana ISO
    const getWeekPeriod = (weekNumber: number, year: number): { inicio: Date, fim: Date } => {
      // Encontrar a primeira segunda-feira da primeira semana ISO do ano
      const jan4 = new Date(year, 0, 4); // 4 de janeiro sempre está na primeira semana ISO
      const dayOfWeek = jan4.getDay() || 7; // Domingo = 7, Segunda = 1
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() - dayOfWeek + 1); // Volta para a segunda-feira
      
      // Calcular início da semana desejada
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
      
      // Fim da semana (domingo)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return { inicio: weekStart, fim: weekEnd };
    };

    // Consolidar dados por semana
    const semanaMap = new Map<number, {
      semana: number;
      periodo: string;
      faturamento_total: number;
      faturamento_couvert: number;
      faturamento_bar: number;
      ticket_medio_contahub: number;
      tm_entrada: number;
      tm_bar: number;
      cmv_limpo_percentual: number;
      cmo_valor: number;
      cmo_percentual: number;
      atracao_faturamento: number;
      atracao_percentual: number;
      clientes_atendidos: number;
      clientes_ativos: number;
      reservas_totais: number;
      reservas_presentes: number;
      // Campos antigos mantidos para compatibilidade
      clientes_total: number;
      eventos_count: number;
      metas_faturamento: number;
      metas_clientes: number;
    }>();

    eventosFiltrados.forEach(evento => {
      // 🎯 CORREÇÃO: Calcular semana automaticamente se não estiver preenchida
      let semana = evento.semana;
      if (!semana) {
        const dataEvento = new Date(evento.data_evento + 'T12:00:00Z');
        semana = getWeekNumber(dataEvento);
        console.log(`📅 Calculando semana para ${evento.data_evento}: semana ${semana}`);
      }
      
      if (!semanaMap.has(semana)) {
        // NÃO recalcular período - será definido dinamicamente baseado nas datas reais dos eventos
        semanaMap.set(semana, {
          semana,
          periodo: '', // Será calculado depois baseado nas datas reais dos eventos
          faturamento_total: 0,
          faturamento_couvert: 0,
          faturamento_bar: 0,
          ticket_medio_contahub: 0,
          tm_entrada: 0,
          tm_bar: 0,
          cmv_limpo_percentual: 0,
          cmo_valor: 0,
          cmo_percentual: 0,
          atracao_faturamento: 0,
          atracao_percentual: 0,
          clientes_atendidos: 0,
          clientes_ativos: 0,
          reservas_totais: 0,
          reservas_presentes: 0,
          // Campos antigos mantidos para compatibilidade
          clientes_total: 0,
          eventos_count: 0,
          metas_faturamento: 0,
          metas_clientes: 0
        });
      }

      const semanaData = semanaMap.get(semana)!;
      // USAR DADOS JÁ CALCULADOS DA TABELA eventos_base
      // O campo real_r já contém o faturamento total calculado corretamente
      const faturamentoTotal = evento.real_r || 0;
      
      // Debug: Comparar com cálculo manual para verificar discrepâncias
      const faturamentoContaHub = contahubMap.get(evento.data_evento) || 0;
      const faturamentoYuzer = yuzerMap.get(evento.data_evento) || 0;
      const faturamenteSympla = symplaMap.get(evento.data_evento) || 0;
      const faturamentoManual = faturamentoContaHub + faturamentoYuzer + faturamenteSympla;
      

      
      semanaData.faturamento_total += faturamentoTotal;
      
      // Novos indicadores de desempenho usando dados das tabelas corretas
      const clientesReais = evento.cl_real || 0;
      
      // Faturamento Couvert será calculado no final da semana
      
      // Faturamento Bar será calculado no final (Total - Couvert)
      
      // Ticket Médio ContaHub = Faturamento Total / Clientes
      // Será calculado no final da semana
      
      // TM Entrada (te_real da eventos_base)
      semanaData.tm_entrada += evento.te_real || 0;
      
      // TM Bar (tb_real da eventos_base)
      semanaData.tm_bar += evento.tb_real || 0;
      
      // CMV Limpo % será calculado no final
      
      // CMO será calculado no final da semana
      
      // Atração/Faturamento (c_art + c_prod da eventos_base)
      semanaData.atracao_faturamento += (evento.c_art || 0) + (evento.c_prod || 0);
      
      // Clientes Atendidos (cl_real da eventos_base)
      semanaData.clientes_atendidos += clientesReais;
      
      // Clientes Ativos será calculado no final (2+ visitas na semana)
      
      // Reservas (usando dados corretos da eventos_base)
      semanaData.reservas_totais += evento.res_tot || 0;
      semanaData.reservas_presentes += evento.res_p || 0;
      
      // Campos antigos mantidos para compatibilidade
      semanaData.clientes_total += clientesReais;
      semanaData.eventos_count += 1;
      semanaData.metas_faturamento += evento.m1_r || 0;
      semanaData.metas_clientes += evento.cl_plan || 0;
    });

    // Obter semana atual
    const hoje = new Date();
    const semanaAtual = getWeekNumber(hoje);

    // Buscar períodos da tabela de referência
    const { data: semanasReferencia } = await supabase
      .from('semanas_referencia')
      .select('semana, periodo_formatado')
      .in('semana', Array.from(semanaMap.keys()));

    // Aplicar períodos corretos da tabela de referência
    semanaMap.forEach((semanaData, numeroSemana) => {
      const referenciaEncontrada = semanasReferencia?.find(ref => ref.semana === numeroSemana);
      if (referenciaEncontrada) {
        semanaData.periodo = referenciaEncontrada.periodo_formatado;
      } else {
        // Fallback: calcular baseado nas datas dos eventos (caso não encontre na referência)
        const eventosDesaSemana = eventos.filter(e => e.semana === numeroSemana);
        if (eventosDesaSemana.length > 0) {
          const datas = eventosDesaSemana.map(e => new Date(e.data_evento)).sort((a, b) => a.getTime() - b.getTime());
          const dataInicio = datas[0];
          const dataFim = datas[datas.length - 1];
          
          semanaData.periodo = `${dataInicio.getDate().toString().padStart(2, '0')}.${(dataInicio.getMonth() + 1).toString().padStart(2, '0')} - ${dataFim.getDate().toString().padStart(2, '0')}.${(dataFim.getMonth() + 1).toString().padStart(2, '0')}`;
        }
      }
    });

    // Converter para array e calcular métricas (mostrar semanas da atual até a 5)
    let semanasConsolidadas = Array.from(semanaMap.values())
      .filter(semana => {
        // 🎯 CORREÇÃO: Mostrar semanas com eventos OU com faturamento (para incluir outubro)
        if (semana.eventos_count === 0 && semana.faturamento_total === 0) return false;
        
        // Não mostrar semanas futuras
        if (semana.semana > semanaAtual) return false;
        
        // Para semanas do ano atual, mostrar da atual até a 5
        if (semana.semana >= 5) return true;
        
        return false;
      });

    // Debug: Verificar se chegou até aqui
    console.log(`🔍 Iniciando cálculo de Couvert e CMO para ${semanasConsolidadas.length} semanas`);
    console.log(`🔍 Semana atual calculada: ${semanaAtual}`);
    console.log(`🔍 Semanas encontradas: ${Array.from(semanaMap.keys()).sort((a, b) => b - a).join(', ')}`);
    console.log(`🔍 Total contahubPeriodoData: ${contahubPeriodoData?.length || 0} registros`);
    console.log(`🔍 Total contahubClientesData: ${contahubClientesData?.length || 0} registros`);
    console.log(`🔍 Total niboData: ${niboData?.length || 0} registros`);

    // 🔧 CORREÇÃO: Buscar dados históricos de clientes (3 meses antes do período)
    // para calcular clientes ativos corretamente
    let contahubClientesHistoricoData: { cli_fone: any; dt_gerencial: any; }[] = [];
    page = 0;
    hasMore = true;
    const data3MesesAntes = new Date(ano - 1, 0, 1); // Buscar desde o início do ano anterior

    while (hasMore) {
      const { data: pageData } = await supabase
        .from('contahub_periodo')
        .select('cli_fone, dt_gerencial')
        .eq('bar_id', user.bar_id)
        .gte('dt_gerencial', data3MesesAntes.toISOString().split('T')[0])
        .lt('dt_gerencial', `${ano}-01-01`)
        .not('cli_fone', 'is', null)
        .order('dt_gerencial')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageData && pageData.length > 0) {
        contahubClientesHistoricoData = [...contahubClientesHistoricoData, ...pageData];
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    // Combinar dados do ano atual com histórico
    const todosClientesData = [...contahubClientesHistoricoData, ...contahubClientesData];

    // Calcular clientes ativos por semana
    // DEFINIÇÃO: Clientes que visitaram na semana atual E também visitaram nos 3 meses anteriores
    semanasConsolidadas.forEach(semana => {
      const periodoSemana = getWeekPeriod(semana.semana, ano);
      const inicioSemana = periodoSemana.inicio;
      const fimSemana = periodoSemana.fim;
      
      // Calcular data de 3 meses atrás a partir do início da semana
      const data3MesesAtras = new Date(inicioSemana);
      data3MesesAtras.setMonth(data3MesesAtras.getMonth() - 3);
      
      const inicioSemanaStr = inicioSemana.toISOString().split('T')[0];
      const fimSemanaStr = fimSemana.toISOString().split('T')[0];
      const data3MesesAtrasStr = data3MesesAtras.toISOString().split('T')[0];
      
      // Clientes que visitaram na semana atual
      const clientesDaSemana = new Set(
        todosClientesData
          .filter(item => item.dt_gerencial >= inicioSemanaStr && item.dt_gerencial <= fimSemanaStr)
          .map(item => item.cli_fone)
      );
      
      // Clientes que visitaram nos 3 meses anteriores (antes do início da semana)
      const clientes3MesesAnteriores = new Set(
        todosClientesData
          .filter(item => item.dt_gerencial >= data3MesesAtrasStr && item.dt_gerencial < inicioSemanaStr)
          .map(item => item.cli_fone)
      );
      
      // Clientes ativos = interseção (visitaram na semana E nos 3 meses anteriores)
      let clientesAtivosSemana = 0;
      clientesDaSemana.forEach(cliente => {
        if (clientes3MesesAnteriores.has(cliente)) {
          clientesAtivosSemana++;
        }
      });
      
      semana.clientes_ativos = clientesAtivosSemana;
      
      // Calcular Faturamento Couvert da semana (usando inicioSemanaStr e fimSemanaStr já declarados acima)
      let couvertSemana = 0;
      
      const periodosCouvertDaSemana = contahubPeriodoData?.filter(item => {
        return item.dt_gerencial >= inicioSemanaStr && item.dt_gerencial <= fimSemanaStr;
      }) || [];
      
      periodosCouvertDaSemana.forEach(item => {
        couvertSemana += item.vr_couvert || 0;
      });
      
      // Debug log (sempre ativo para investigação)
      if (semana.semana === 35) {
        console.log(`🔍 Semana ${semana.semana} - Período calculado:`, {
          inicioSemana: inicioSemana.toISOString(),
          fimSemana: fimSemana.toISOString(),
          inicioSemanaStr,
          fimSemanaStr
        });
        
        // Verificar alguns registros de contahub_periodo para debug
        const amostraPeriodo = contahubPeriodoData?.slice(0, 5).map(item => ({
          dt_gerencial: item.dt_gerencial,
          vr_couvert: item.vr_couvert
        })) || [];
        
        console.log(`🔍 Semana ${semana.semana} - Couvert:`, {
          registrosPeriodo: periodosCouvertDaSemana.length,
          couvertTotal: couvertSemana,
          totalContahubPeriodo: contahubPeriodoData?.length || 0,
          amostraPeriodo,
          primeiros3Registros: periodosCouvertDaSemana.slice(0, 3).map(item => ({
            dt_gerencial: item.dt_gerencial,
            vr_couvert: item.vr_couvert
          }))
        });
      }
      
      semana.faturamento_couvert = couvertSemana;
      semana.faturamento_bar = semana.faturamento_total - couvertSemana;
      
      // Calcular CMO da semana (agendamentos do mês da semana, dividido proporcionalmente)
      let cmoSemana = 0;
      const mesInicio = inicioSemana.getMonth() + 1;
      const anoInicio = inicioSemana.getFullYear();
      const mesFim = fimSemana.getMonth() + 1;
      const anoFim = fimSemana.getFullYear();
      
      // Buscar agendamentos do(s) mês(es) da semana
      const agendamentosDaSemana = niboData?.filter(item => {
        const dataCompetencia = new Date(item.data_competencia);
        const mesCompetencia = dataCompetencia.getMonth() + 1;
        const anoCompetencia = dataCompetencia.getFullYear();
        
        return (anoCompetencia === anoInicio && mesCompetencia === mesInicio) ||
               (anoCompetencia === anoFim && mesCompetencia === mesFim);
      }) || [];
      
      // Calcular proporção da semana no mês e aplicar ao CMO
      if (agendamentosDaSemana.length > 0) {
        const totalCmoMes = agendamentosDaSemana.reduce((sum, item) => sum + (item.valor || 0), 0);
        
        // Para semanas que cruzam meses, usar proporção simples de 7 dias no mês
        // Para semanas dentro do mesmo mês, calcular dias exatos
        let diasSemanaNoMes, diasTotalMes, proporcao;
        
        if (mesInicio !== mesFim) {
          // Semana cruza meses - usar proporção de 7 dias no mês principal (início)
          diasSemanaNoMes = 7;
          diasTotalMes = new Date(anoInicio, mesInicio, 0).getDate();
          proporcao = diasSemanaNoMes / diasTotalMes;
        } else {
          // Semana dentro do mesmo mês - calcular dias exatos
          diasSemanaNoMes = Math.min(7, fimSemana.getDate() - Math.max(1, inicioSemana.getDate()) + 1);
          diasTotalMes = new Date(anoInicio, mesInicio, 0).getDate();
          proporcao = diasSemanaNoMes / diasTotalMes;
        }
        
        cmoSemana = totalCmoMes * proporcao;
      }
      
      // Debug log (sempre ativo para investigação)
      if (semana.semana === 35 || semana.semana === 31) {
        const totalCmoMes = agendamentosDaSemana.reduce((sum, item) => sum + (item.valor || 0), 0);
        const diasSemanaNoMes = Math.min(7, fimSemana.getDate() - Math.max(1, inicioSemana.getDate()) + 1);
        const diasTotalMes = new Date(anoInicio, mesInicio, 0).getDate();
        const proporcao = diasSemanaNoMes / diasTotalMes;
        
        console.log(`🔍 Semana ${semana.semana} - CMO:`, {
          mesInicio,
          anoInicio,
          mesFim,
          anoFim,
          inicioSemana: inicioSemana.toISOString().split('T')[0],
          fimSemana: fimSemana.toISOString().split('T')[0],
          agendamentosEncontrados: agendamentosDaSemana.length,
          totalCmoMes,
          diasSemanaNoMes,
          diasTotalMes,
          proporcao,
          cmoSemana,
          primeiros3Agendamentos: agendamentosDaSemana.slice(0, 3).map(item => ({
            data_competencia: item.data_competencia,
            valor: item.valor,
            categoria_nome: (item as any).categoria_nome
          }))
        });
      }
      
      semana.cmo_valor = cmoSemana;
    });

    semanasConsolidadas = semanasConsolidadas.map(semana => {
      const ticketMedio = semana.clientes_total > 0 ? semana.faturamento_total / semana.clientes_total : 0;
      
      // Calcular Ticket Médio ContaHub
      const ticketMedioContahub = semana.clientes_atendidos > 0 ? semana.faturamento_total / semana.clientes_atendidos : 0;
      
      // Calcular TM Entrada médio (por evento)
      const tmEntradaMedia = semana.eventos_count > 0 ? semana.tm_entrada / semana.eventos_count : 0;
      
      // Calcular TM Bar médio (por evento)
      const tmBarMedia = semana.eventos_count > 0 ? semana.tm_bar / semana.eventos_count : 0;
      
      // CMV Limpo % (por enquanto 0, será implementado depois)
      const cmvLimpoPercentual = 0;
      
      // Calcular CMO% (CMO sobre faturamento)
      const cmoPercentual = semana.faturamento_total > 0 ? (semana.cmo_valor / semana.faturamento_total) * 100 : 0;
      
      // Calcular Atração/Faturamento %
      const atracaoPercentual = semana.faturamento_total > 0 ? (semana.atracao_faturamento / semana.faturamento_total) * 100 : 0;
      
      // Calcular performance geral da semana
      let performanceGeral = 0;
      let indicadores = 0;

      // Performance de receita (peso 60%)
      if (semana.metas_faturamento > 0) {
        const performanceReceita = Math.min((semana.faturamento_total / semana.metas_faturamento) * 100, 150);
        performanceGeral += performanceReceita * 0.6;
        indicadores += 0.6;
      }

      // Performance de clientes (peso 40%)
      if (semana.metas_clientes > 0) {
        const performanceClientes = Math.min((semana.clientes_total / semana.metas_clientes) * 100, 150);
        performanceGeral += performanceClientes * 0.4;
        indicadores += 0.4;
      }

      // Normalizar performance
      if (indicadores > 0) {
        performanceGeral = performanceGeral / indicadores;
      }

      return {
        semana: semana.semana,
        periodo: semana.periodo,
        faturamento_total: Math.round(semana.faturamento_total * 100) / 100,
        faturamento_couvert: Math.round(semana.faturamento_couvert * 100) / 100,
        faturamento_bar: Math.round(semana.faturamento_bar * 100) / 100,
        ticket_medio_contahub: Math.round(ticketMedioContahub * 100) / 100,
        tm_entrada: Math.round(tmEntradaMedia * 100) / 100,
        tm_bar: Math.round(tmBarMedia * 100) / 100,
        cmv_limpo_percentual: Math.round(cmvLimpoPercentual * 100) / 100,
        cmo_valor: Math.round(semana.cmo_valor * 100) / 100,
        cmo_percentual: Math.round(cmoPercentual * 100) / 100,
        atracao_faturamento: Math.round(semana.atracao_faturamento * 100) / 100,
        atracao_percentual: Math.round(atracaoPercentual * 100) / 100,
        clientes_atendidos: semana.clientes_atendidos,
        clientes_ativos: semana.clientes_ativos,
        reservas_totais: semana.reservas_totais,
        reservas_presentes: semana.reservas_presentes,
        // Metas padrão (podem ser configuráveis no futuro)
        meta_faturamento_total: 263000,
        meta_faturamento_couvert: 38000,
        meta_faturamento_bar: 225000,
        meta_ticket_medio_contahub: 103,
        meta_tm_entrada: 15.5,
        meta_tm_bar: 77.5,
        meta_cmv_limpo_percentual: 33,
        meta_cmo_percentual: 20,
        meta_atracao_percentual: 17,
        meta_clientes_atendidos: 2645,
        meta_clientes_ativos: 3000,
        meta_reservas_totais: 800,
        meta_reservas_presentes: 650,
        // Campos antigos mantidos para compatibilidade
        clientes_total: semana.clientes_total,
        eventos_count: semana.eventos_count,
        metas_faturamento: Math.round(semana.metas_faturamento * 100) / 100,
        metas_clientes: semana.metas_clientes,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        performance_geral: Math.round(performanceGeral * 100) / 100
      };
    }).sort((a, b) => b.semana - a.semana); // Ordenar decrescente (semana atual primeiro)



    // CORREÇÃO: Aplicar filtro mensal SEMPRE quando mes é especificado
    if (mes !== null && mes !== undefined) {
      // Filtrar semanas que contêm eventos do mês solicitado
      const eventosDoMes = eventos.filter(evento => {
        const dataEvento = new Date(evento.data_evento);
        return dataEvento.getMonth() + 1 === mes && dataEvento.getFullYear() === ano;
      });
      
      const semanasDoMes = new Set(eventosDoMes.map(evento => evento.semana));
      semanasConsolidadas = semanasConsolidadas.filter(semana => semanasDoMes.has(semana.semana));
    }

    // Ordenar semanas em ordem decrescente (mais recente primeiro)
    semanasConsolidadas.sort((a, b) => b.semana - a.semana);



    // Calcular totais mensais
    const totaisMensais = semanasConsolidadas.reduce((acc, semana) => ({
      faturamento_total: acc.faturamento_total + semana.faturamento_total,
      clientes_total: acc.clientes_total + semana.clientes_total,
      eventos_total: acc.eventos_total + semana.eventos_count,
      performance_media: acc.performance_media + (semana as any).performance_geral
    }), { faturamento_total: 0, clientes_total: 0, eventos_total: 0, performance_media: 0 });

    const ticketMedioMensal = totaisMensais.clientes_total > 0 ? 
      totaisMensais.faturamento_total / totaisMensais.clientes_total : 0;
    
    const performanceMediaMensal = semanasConsolidadas.length > 0 ? 
      totaisMensais.performance_media / semanasConsolidadas.length : 0;

    const responseData = {
      success: true,
      mes: mes,
      ano: ano,
      semanas: semanasConsolidadas,
      total_semanas: semanasConsolidadas.length,
      totais_mensais: {
        faturamento_total: Math.round(totaisMensais.faturamento_total * 100) / 100,
        clientes_total: totaisMensais.clientes_total,
        ticket_medio: Math.round(ticketMedioMensal * 100) / 100,
        performance_media: Math.round(performanceMediaMensal * 100) / 100,
        eventos_total: totaisMensais.eventos_total
      }
    };

    // Salvar no cache
    performanceCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Erro na API de desempenho:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
