import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { filtrarDiasAbertos } from '@/lib/helpers/calendario-helper';

export const dynamic = 'force-dynamic'

// Função para calcular datas do trimestre
function getTrimestreDates(trimestre: number, year?: number) {
  const anoAtual = year || new Date().getFullYear();
  const quarters = {
    1: { start: `${anoAtual}-01-01`, end: `${anoAtual}-03-31` }, // Jan-Mar
    2: { start: `${anoAtual}-04-01`, end: `${anoAtual}-06-30` }, // Abr-Jun
    3: { start: `${anoAtual}-07-01`, end: `${anoAtual}-09-30` }, // Jul-Set  
    4: { start: `${anoAtual}-10-01`, end: `${anoAtual}-12-31` }  // Out-Dez
  };
  
  return quarters[trimestre as keyof typeof quarters] || quarters[1];
}

// Função para calcular trimestre anterior
function getTrimestreAnterior(trimestre: number, year?: number) {
  const anoAtual = year || new Date().getFullYear();
  const anoAnterior = anoAtual - 1;
  const quarters = {
    1: { start: `${anoAnterior}-10-01`, end: `${anoAnterior}-12-31` }, // T4 ano anterior - anterior ao T1
    2: { start: `${anoAtual}-01-01`, end: `${anoAtual}-03-31` }, // T1 (Jan-Mar) - anterior ao T2
    3: { start: `${anoAtual}-04-01`, end: `${anoAtual}-06-30` }, // T2 (Abr-Jun) - anterior ao T3
    4: { start: `${anoAtual}-07-01`, end: `${anoAtual}-09-30` }  // T3 (Jul-Set) - anterior ao T4
  };
  
  return quarters[trimestre as keyof typeof quarters] || quarters[1]; // Default T4 anterior
}

// Função para calcular taxa de retornantes trimestral
// MESMA LÓGICA DA PÁGINA CLIENTES-ATIVOS:
// Retornantes = clientes do período que JÁ VIERAM ANTES do início do período
// Taxa = retornantes / total_clientes_do_período
async function calcularRetencao(supabase: any, barIdNum: number, mesEspecifico?: string, trimestre?: number) {
  try {
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const year = new Date().getFullYear();
    
    // Definir período do trimestre
    let inicioPeriodo: string;
    let fimPeriodo: string;
    let inicioPeriodoAnterior: string;
    let fimPeriodoAnterior: string;
    
    if (trimestre) {
      // Usar trimestre específico
      const quarters: { [key: number]: { start: string; end: string } } = {
        1: { start: `${year}-01-01`, end: `${year}-03-31` },
        2: { start: `${year}-04-01`, end: `${year}-06-30` },
        3: { start: `${year}-07-01`, end: `${year}-09-30` },
        4: { start: `${year}-10-01`, end: `${year}-12-31` }
      };
      
      const quarterAnterior: { [key: number]: { start: string; end: string } } = {
        1: { start: `${year - 1}-10-01`, end: `${year - 1}-12-31` }, // T4 ano anterior
        2: { start: `${year}-01-01`, end: `${year}-03-31` },          // T1
        3: { start: `${year}-04-01`, end: `${year}-06-30` },          // T2
        4: { start: `${year}-07-01`, end: `${year}-09-30` }           // T3
      };
      
      const periodoAtual = quarters[trimestre] || quarters[4];
      const periodoAnterior = quarterAnterior[trimestre] || quarterAnterior[4];
      
      // Ajustar fim do período atual para não ultrapassar hoje
      const hoje = new Date();
      const fimPeriodoDate = new Date(periodoAtual.end);
      const fimEfetivo = hoje < fimPeriodoDate ? hoje : fimPeriodoDate;
      
      inicioPeriodo = periodoAtual.start;
      fimPeriodo = formatDate(fimEfetivo);
      inicioPeriodoAnterior = periodoAnterior.start;
      fimPeriodoAnterior = periodoAnterior.end;
    } else if (mesEspecifico) {
      // Usar mês específico como referência para rolling 90 dias
      const [ano, mes] = mesEspecifico.split('-').map(Number);
      const dataReferencia = new Date(ano, mes, 0); // último dia do mês
      
      const fimPeriodoAtual = dataReferencia;
      const inicioPeriodoAtual = new Date(dataReferencia);
      inicioPeriodoAtual.setDate(fimPeriodoAtual.getDate() - 90);
      
      const fimPeriodoAnt = new Date(inicioPeriodoAtual);
      fimPeriodoAnt.setDate(fimPeriodoAnt.getDate() - 1);
      const inicioPeriodoAnt = new Date(fimPeriodoAnt);
      inicioPeriodoAnt.setDate(fimPeriodoAnt.getDate() - 90);
      
      inicioPeriodo = formatDate(inicioPeriodoAtual);
      fimPeriodo = formatDate(fimPeriodoAtual);
      inicioPeriodoAnterior = formatDate(inicioPeriodoAnt);
      fimPeriodoAnterior = formatDate(fimPeriodoAnt);
    } else {
      // Usar últimos 90 dias
      const hoje = new Date();
      const inicio90d = new Date(hoje);
      inicio90d.setDate(hoje.getDate() - 90);
      
      inicioPeriodo = formatDate(inicio90d);
      fimPeriodo = formatDate(hoje);
      
      const fimAnt = new Date(inicio90d);
      fimAnt.setDate(fimAnt.getDate() - 1);
      const inicioAnt = new Date(fimAnt);
      inicioAnt.setDate(fimAnt.getDate() - 90);
      
      inicioPeriodoAnterior = formatDate(inicioAnt);
      fimPeriodoAnterior = formatDate(fimAnt);
    }
    
    console.log('🔄 CALCULANDO TAXA DE RETORNANTES (mesma lógica clientes-ativos):');
    console.log(`Período ATUAL: ${inicioPeriodo} até ${fimPeriodo}`);
    console.log(`Período ANTERIOR: ${inicioPeriodoAnterior} até ${fimPeriodoAnterior}`);
    
    // ✅ USAR A STORED PROCEDURE calcular_metricas_clientes (mesma da clientes-ativos)
    const { data: metricas, error: errorMetricas } = await supabase.rpc('calcular_metricas_clientes', {
      p_bar_id: barIdNum,
      p_data_inicio_atual: inicioPeriodo,
      p_data_fim_atual: fimPeriodo,
      p_data_inicio_anterior: inicioPeriodoAnterior,
      p_data_fim_anterior: fimPeriodoAnterior
    });
    
    if (errorMetricas) {
      console.error('❌ Erro ao calcular métricas:', errorMetricas);
      throw errorMetricas;
    }
    
    const resultado = metricas[0];
    const totalClientesAtual = Number(resultado.total_atual) || 0;
    const retornantesAtual = Number(resultado.retornantes_atual) || 0;
    const totalClientesAnterior = Number(resultado.total_anterior) || 0;
    const retornantesAnterior = Number(resultado.retornantes_anterior) || 0;
    
    // ✅ TAXA DE RETORNANTES = retornantes / total (igual clientes-ativos)
    const percentualRetornantes = totalClientesAtual > 0 
      ? (retornantesAtual / totalClientesAtual) * 100 
      : 0;
    
    const percentualRetornantesAnterior = totalClientesAnterior > 0 
      ? (retornantesAnterior / totalClientesAnterior) * 100 
      : 0;
    
    // Calcular variação
    const variacaoRetornantes = percentualRetornantesAnterior > 0 
      ? ((percentualRetornantes - percentualRetornantesAnterior) / percentualRetornantesAnterior * 100)
      : 0;
    
    console.log('🔄 TAXA DE RETORNANTES CALCULADA:');
    console.log(`Total clientes período atual: ${totalClientesAtual}`);
    console.log(`Retornantes período atual: ${retornantesAtual}`);
    console.log(`Taxa de retornantes: ${percentualRetornantes.toFixed(1)}%`);
    console.log(`Taxa de retornantes anterior: ${percentualRetornantesAnterior.toFixed(1)}%`);
    console.log(`Variação: ${variacaoRetornantes.toFixed(1)}%`);
    
    return {
      valor: parseFloat(percentualRetornantes.toFixed(1)),
      variacao: parseFloat(variacaoRetornantes.toFixed(1))
    };
    
  } catch (error) {
    console.error('❌ Erro ao calcular retenção:', error);
    return { valor: 0, variacao: 0 };
  }
}

// Função para calcular RETENÇÃO REAL (rolling 90 dias)
// "Dos clientes do trimestre anterior, quantos voltaram neste trimestre?"
async function calcularRetencaoReal(supabase: any, barIdNum: number, trimestre?: number) {
  try {
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const year = new Date().getFullYear();
    
    // Definir período do trimestre atual e anterior
    let inicioPeriodoAtual: string;
    let fimPeriodoAtual: string;
    let inicioPeriodoAnterior: string;
    let fimPeriodoAnterior: string;
    let inicioPeriodoComparacao: string;
    let fimPeriodoComparacao: string;
    
    if (trimestre) {
      const quarters: { [key: number]: { start: string; end: string } } = {
        1: { start: `${year}-01-01`, end: `${year}-03-31` },
        2: { start: `${year}-04-01`, end: `${year}-06-30` },
        3: { start: `${year}-07-01`, end: `${year}-09-30` },
        4: { start: `${year}-10-01`, end: `${year}-12-31` }
      };
      
      const quarterAnterior: { [key: number]: { start: string; end: string } } = {
        1: { start: `${year - 1}-10-01`, end: `${year - 1}-12-31` },
        2: { start: `${year}-01-01`, end: `${year}-03-31` },
        3: { start: `${year}-04-01`, end: `${year}-06-30` },
        4: { start: `${year}-07-01`, end: `${year}-09-30` }
      };
      
      const quarterComparacao: { [key: number]: { start: string; end: string } } = {
        1: { start: `${year - 1}-07-01`, end: `${year - 1}-09-30` },
        2: { start: `${year - 1}-10-01`, end: `${year - 1}-12-31` },
        3: { start: `${year}-01-01`, end: `${year}-03-31` },
        4: { start: `${year}-04-01`, end: `${year}-06-30` }
      };
      
      const periodoAtual = quarters[trimestre] || quarters[4];
      const periodoAnterior = quarterAnterior[trimestre] || quarterAnterior[4];
      const periodoComparacao = quarterComparacao[trimestre] || quarterComparacao[4];
      
      // Ajustar fim do período atual para não ultrapassar hoje
      const hoje = new Date();
      const fimPeriodoDate = new Date(periodoAtual.end);
      const fimEfetivo = hoje < fimPeriodoDate ? hoje : fimPeriodoDate;
      
      inicioPeriodoAtual = periodoAtual.start;
      fimPeriodoAtual = formatDate(fimEfetivo);
      inicioPeriodoAnterior = periodoAnterior.start;
      fimPeriodoAnterior = periodoAnterior.end;
      inicioPeriodoComparacao = periodoComparacao.start;
      fimPeriodoComparacao = periodoComparacao.end;
    } else {
      // Fallback: rolling 90 dias
      const hoje = new Date();
      const inicio90d = new Date(hoje);
      inicio90d.setDate(hoje.getDate() - 90);
      
      inicioPeriodoAtual = formatDate(inicio90d);
      fimPeriodoAtual = formatDate(hoje);
      
      const fimAnt = new Date(inicio90d);
      fimAnt.setDate(fimAnt.getDate() - 1);
      const inicioAnt = new Date(fimAnt);
      inicioAnt.setDate(fimAnt.getDate() - 90);
      
      inicioPeriodoAnterior = formatDate(inicioAnt);
      fimPeriodoAnterior = formatDate(fimAnt);
      
      const fimComp = new Date(inicioAnt);
      fimComp.setDate(fimComp.getDate() - 1);
      const inicioComp = new Date(fimComp);
      inicioComp.setDate(fimComp.getDate() - 90);
      
      inicioPeriodoComparacao = formatDate(inicioComp);
      fimPeriodoComparacao = formatDate(fimComp);
    }
    
    console.log('🔄 CALCULANDO RETENÇÃO REAL (% que voltaram):');
    console.log(`Período ATUAL: ${inicioPeriodoAtual} até ${fimPeriodoAtual}`);
    console.log(`Período ANTERIOR: ${inicioPeriodoAnterior} até ${fimPeriodoAnterior}`);
    
    // Buscar clientes dos períodos
    const [clientesPeriodoAtualBruto, clientesPeriodoAnteriorBruto, clientesPeriodoComparacaoBruto] = await Promise.all([
      fetchAllData(supabase, 'contahub_periodo', 'cli_fone', {
        'eq_bar_id': barIdNum,
        'gte_dt_gerencial': inicioPeriodoAtual,
        'lte_dt_gerencial': fimPeriodoAtual
      }),
      fetchAllData(supabase, 'contahub_periodo', 'cli_fone', {
        'eq_bar_id': barIdNum,
        'gte_dt_gerencial': inicioPeriodoAnterior,
        'lte_dt_gerencial': fimPeriodoAnterior
      }),
      fetchAllData(supabase, 'contahub_periodo', 'cli_fone', {
        'eq_bar_id': barIdNum,
        'gte_dt_gerencial': inicioPeriodoComparacao,
        'lte_dt_gerencial': fimPeriodoComparacao
      })
    ]);
    
    // Criar sets de clientes únicos
    const clientesPeriodoAtual = new Set(
      clientesPeriodoAtualBruto?.filter(item => item.cli_fone && item.cli_fone.length >= 8).map(item => item.cli_fone) || []
    );
    
    const clientesPeriodoAnterior = new Set(
      clientesPeriodoAnteriorBruto?.filter(item => item.cli_fone && item.cli_fone.length >= 8).map(item => item.cli_fone) || []
    );
    
    const clientesPeriodoComparacao = new Set(
      clientesPeriodoComparacaoBruto?.filter(item => item.cli_fone && item.cli_fone.length >= 8).map(item => item.cli_fone) || []
    );
    
    // RETENÇÃO REAL = clientes do período ANTERIOR que voltaram no período ATUAL
    const clientesQueVoltaram = [...clientesPeriodoAnterior].filter(cliente => 
      clientesPeriodoAtual.has(cliente)
    );
    
    const totalClientesAnterior = clientesPeriodoAnterior.size;
    const totalQueVoltaram = clientesQueVoltaram.length;
    
    // Taxa de retenção real = quantos do período anterior voltaram
    const percentualRetencaoReal = totalClientesAnterior > 0 
      ? (totalQueVoltaram / totalClientesAnterior) * 100 
      : 0;
    
    // Calcular variação (comparar com período ainda anterior)
    const clientesQueVoltaramAnterior = [...clientesPeriodoComparacao].filter(cliente => 
      clientesPeriodoAnterior.has(cliente)
    );
    
    const percentualRetencaoRealAnterior = clientesPeriodoComparacao.size > 0 
      ? (clientesQueVoltaramAnterior.length / clientesPeriodoComparacao.size) * 100 
      : 0;
    
    const variacaoRetencaoReal = percentualRetencaoRealAnterior > 0 
      ? ((percentualRetencaoReal - percentualRetencaoRealAnterior) / percentualRetencaoRealAnterior * 100)
      : 0;
    
    console.log('🔄 RETENÇÃO REAL CALCULADA:');
    console.log(`Clientes período anterior: ${totalClientesAnterior}`);
    console.log(`Clientes que voltaram: ${totalQueVoltaram}`);
    console.log(`Taxa de retenção real: ${percentualRetencaoReal.toFixed(1)}%`);
    console.log(`Variação: ${variacaoRetencaoReal.toFixed(1)}%`);
    
    return {
      valor: parseFloat(percentualRetencaoReal.toFixed(1)),
      variacao: parseFloat(variacaoRetencaoReal.toFixed(1))
    };
    
  } catch (error) {
    console.error('❌ Erro ao calcular retenção real:', error);
    return { valor: 0, variacao: 0 };
  }
}

// Função para buscar dados com paginação (contorna limite de 1000 do Supabase)
async function fetchAllData(supabase: any, tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  let pageCount = 0;
  
  const MAX_ITERATIONS = 100;
  let iterations = 0;
  
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    pageCount++;
    
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);
    
    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) {
        query = query.gte(key.replace('gte_', ''), value);
      } else if (key.includes('lte_')) {
        query = query.lte(key.replace('lte_', ''), value);
      } else if (key.includes('eq_')) {
        query = query.eq(key.replace('eq_', ''), value);
      } else if (key.includes('in_')) {
        query = query.in(key.replace('in_', ''), value);
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
      // Log apenas em desenvolvimento para evitar poluir console em produção
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Erro ao buscar ${tableName}:`, error);
      }
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    allData.push(...data);
    
    if (data.length < limit) {
      break; // Última página
    }
    
    from += limit;
  }
  
  return allData;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || 'anual';
    const trimestre = parseInt(searchParams.get('trimestre') || '3'); // 2, 3 ou 4
    const mesRetencao = searchParams.get('mes_retencao'); // formato YYYY-MM
    const barId = searchParams.get('bar_id') || 
      (request.headers.get('x-user-data') 
        ? JSON.parse(request.headers.get('x-user-data') || '{}').bar_id 
        : null);
    
    // Log simplificado de início
    // Log principal apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Visão Geral: Calculando ${periodo}${trimestre ? ` T${trimestre}` : ''} - Bar ${barId}`);
      console.log(`🔍 DEBUG: mesRetencao recebido: "${mesRetencao}"`);
    }
    
    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }
    
    // Converter para número
    const barIdNum = parseInt(barId.toString());
    
    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Headers de cache HTTP para CDN (Vercel) e navegador
    //  - s-maxage: cache em edge por 60s
    //  - stale-while-revalidate: serve cache enquanto revalida por 5min
    //  Obs: a resposta final mais abaixo inclui estes headers via NextResponse
    
    // Logs de diagnóstico antigos removidos para reduzir IO/overhead

    // Buscar dados anuais
    if (periodo === 'anual') {
      const anoAtual = new Date().getFullYear();
      
      // 🚀 OTIMIZAÇÃO: Usar stored procedure consolidada (1 query em vez de 7+)
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 USANDO STORED PROCEDURE: calcular_visao_geral_anual');
      }
      
      const { data: anualData, error: anualError } = await supabase
        .rpc('calcular_visao_geral_anual', {
          p_bar_id: barIdNum,
          p_ano: anoAtual
        });
      
      if (anualError) {
        console.error('❌ Erro ao buscar dados anuais:', anualError);
        throw anualError;
      }
      
      const dados = anualData[0];
      
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`💰 Faturamento Anual: R$ ${Number(dados.faturamento_total).toLocaleString('pt-BR')}`);
        console.log(`👥 Total Pessoas: ${dados.pessoas_total.toLocaleString('pt-BR')}`);
      }

      // EBITDA (será calculado futuramente com DRE)
      const ebitda = 0;

      const resp = NextResponse.json({
        anual: {
          faturamento: {
            valor: Number(dados.faturamento_total),
            meta: 18000000, // Meta 2026: R$ 18M
            detalhes: {
              contahub: Number(dados.faturamento_contahub),
              yuzer: Number(dados.faturamento_yuzer),
              sympla: Number(dados.faturamento_sympla)
            }
          },
          pessoas: {
            valor: dados.pessoas_total,
            meta: 78000, // 6.500 média/mês * 12
            detalhes: {
              contahub: dados.pessoas_contahub,
              yuzer: dados.pessoas_yuzer,
              sympla: dados.pessoas_sympla
            }
          },
          reputacao: {
            valor: Number(dados.reputacao_media),
            meta: 4.9 // Meta 2026
          },
          ebitda: {
            valor: ebitda,
            meta: 1800000 // Meta 2026: R$ 1.8M
          }
        }
      });
      
      // Cache agressivo de 5 minutos
      resp.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      resp.headers.set('X-Optimized', 'stored-procedure');
      return resp;
    }

    // Buscar dados trimestrais
    if (periodo === 'trimestral') {
      const anoAtual = new Date().getFullYear();
      
      // 🚀 OTIMIZAÇÃO: Usar stored procedure consolidada (1 query em vez de 20+)
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 USANDO STORED PROCEDURE: calcular_visao_geral_trimestral (T${trimestre})`);
      }
      
      const { data: trimestreData, error: trimestreError } = await supabase
        .rpc('calcular_visao_geral_trimestral', {
          p_bar_id: barIdNum,
          p_trimestre: trimestre,
          p_ano: anoAtual
        });
      
      if (trimestreError) {
        console.error('❌ Erro ao buscar dados trimestrais:', trimestreError);
        throw trimestreError;
      }
      
      const dados = trimestreData[0];
      
      // Log apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`👥 Clientes Ativos (90d): ${dados.clientes_ativos} | Var: ${Number(dados.variacao_clientes_ativos).toFixed(1)}%`);
        console.log(`👥 Clientes Totais T${trimestre}: ${dados.clientes_totais} | Var: ${Number(dados.variacao_clientes_totais).toFixed(1)}%`);
        console.log(`💰 Faturamento T${trimestre}: R$ ${Number(dados.faturamento_trimestre).toLocaleString('pt-BR')}`);
        console.log(`📊 CMO: ${Number(dados.cmo_percentual).toFixed(1)}% | Var: ${Number(dados.variacao_cmo).toFixed(1)}%`);
        console.log(`🎭 Artística: ${Number(dados.artistica_percentual).toFixed(1)}% | Var: ${Number(dados.variacao_artistica).toFixed(1)}%`);
      }
      
      // Datas para retenção (ainda usa funções existentes)
      const { start: startDate, end: endDate } = getTrimestreDates(trimestre);
      const hoje = new Date();
      const endDateObj = new Date(endDate);
      const endDateEfetivo = hoje < endDateObj ? hoje.toISOString().split('T')[0] : endDate;

      // Metas dinâmicas por trimestre - 2026
      const getMetasTrimestre = (trimestre: number) => {
        const metas = {
          1: { // T1 2026 (Jan-Mar) - "Ver de Qualé - Segura a Peteca"
            clientesAtivos: 5100, // Meta 31/03
            clientesTotais: 30000,
            retencao: 40,
            retencaoReal: 5,
            cmvLimpo: 34, // CMV Limpo Médio do Tri
            cmo: 20,
            artistica: 20 // Atrações/Fat
          },
          2: { // T2 (Abr-Jun)
            clientesAtivos: 5500,
            clientesTotais: 35000,
            retencao: 40,
            retencaoReal: 5,
            cmvLimpo: 34,
            cmo: 20,
            artistica: 19
          },
          3: { // T3 (Jul-Set)
            clientesAtivos: 6000,
            clientesTotais: 38000,
            retencao: 40,
            retencaoReal: 5,
            cmvLimpo: 34,
            cmo: 20,
            artistica: 19
          },
          4: { // T4 (Out-Dez)
            clientesAtivos: 6500, // Meta ano: 6.500 média
            clientesTotais: 40000,
            retencao: 40,
            retencaoReal: 5,
            cmvLimpo: 34,
            cmo: 20,
            artistica: 19
          }
        };
        return metas[trimestre as keyof typeof metas] || metas[1];
      };

      const metasTrimestre = getMetasTrimestre(trimestre);

      // Buscar CMV Limpo (ainda usa tabela cmv_manual)
      const cmvLimpo = await (async () => {
        const ano = new Date().getFullYear();
        const trimestresDatas: Record<number, { inicio: string; fim: string }> = {
          2: { inicio: `${ano}-04-01`, fim: `${ano}-06-30` },
          3: { inicio: `${ano}-07-01`, fim: `${ano}-09-30` },
          4: { inicio: `${ano}-10-01`, fim: `${ano}-12-31` }
        };
        
        const periodoAtual = trimestresDatas[trimestre] || trimestresDatas[4];
        
        const { data: cmvData } = await supabase
          .from('cmv_manual')
          .select('cmv_percentual')
          .eq('bar_id', barIdNum)
          .eq('periodo_tipo', 'trimestral')
          .eq('periodo_inicio', periodoAtual.inicio)
          .single();
        
        // Buscar CMV do trimestre anterior para variação
        const trimestreAnterior = trimestre === 2 ? 4 : trimestre - 1;
        const anoAnterior = trimestre === 2 ? ano - 1 : ano;
        const periodoAnterior = {
          2: { inicio: `${anoAnterior}-04-01`, fim: `${anoAnterior}-06-30` },
          3: { inicio: `${anoAnterior}-07-01`, fim: `${anoAnterior}-09-30` },
          4: { inicio: `${anoAnterior}-10-01`, fim: `${anoAnterior}-12-31` }
        }[trimestreAnterior] || { inicio: `${anoAnterior}-10-01`, fim: `${anoAnterior}-12-31` };
        
        const { data: cmvAnterior } = await supabase
          .from('cmv_manual')
          .select('cmv_percentual')
          .eq('bar_id', barIdNum)
          .eq('periodo_tipo', 'trimestral')
          .eq('periodo_inicio', periodoAnterior.inicio)
          .single();
        
        const valorAtual = cmvData?.cmv_percentual || 0;
        const valorAnterior = cmvAnterior?.cmv_percentual || 0;
        const variacao = valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
        
        return {
          valor: valorAtual,
          meta: metasTrimestre.cmvLimpo,
          variacao: variacao
        };
      })();

      const resp = NextResponse.json({
        trimestral: {
          clientesAtivos: {
            valor: dados.clientes_ativos,
            meta: metasTrimestre.clientesAtivos,
            variacao: Number(dados.variacao_clientes_ativos)
          },
          clientesTotais: {
            valor: dados.clientes_totais,
            meta: metasTrimestre.clientesTotais,
            variacao: Number(dados.variacao_clientes_totais)
          },
          retencao: {
            ...(await calcularRetencao(supabase, barIdNum, mesRetencao || undefined, trimestre)),
            meta: metasTrimestre.retencao
          },
          retencaoReal: {
            ...(await calcularRetencaoReal(supabase, barIdNum, trimestre)),
            meta: metasTrimestre.retencaoReal
          },
          cmvLimpo: cmvLimpo,
          cmo: {
            valor: Number(dados.cmo_percentual),
            meta: metasTrimestre.cmo,
            valorAbsoluto: Number(dados.cmo_total),
            variacao: Number(dados.variacao_cmo)
          },
          artistica: {
            valor: Number(dados.artistica_percentual),
            meta: metasTrimestre.artistica,
            variacao: Number(dados.variacao_artistica)
          }
        }
      });
      
      // Cache agressivo de 5 minutos
      resp.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      resp.headers.set('X-Optimized', 'stored-procedure');
      return resp;
    }

    // Buscar dados mensais
    if (periodo === 'mensal') {
      const mes = searchParams.get('mes'); // formato YYYY-MM
      
      if (!mes) {
        return NextResponse.json(
          { success: false, error: 'Mês não especificado' },
          { status: 400 }
        );
      }

      const [ano, mesNum] = mes.split('-').map(Number);
      const startDate = `${ano}-${mesNum.toString().padStart(2, '0')}-01`;
      const endDate = new Date(ano, mesNum, 0).toISOString().split('T')[0]; // Último dia do mês

      // Clientes Ativos (visitaram 2+ vezes nos últimos 30 dias)
      const dataLimite30Dias = new Date();
      dataLimite30Dias.setDate(dataLimite30Dias.getDate() - 30);
      const dataLimite30DiasStr = dataLimite30Dias.toISOString().split('T')[0];

      const { data: clientesAtivosData, error: clientesAtivosError } = await supabase
        .from('contahub_periodo')
        .select('cli_fone')
        .eq('bar_id', barIdNum)
        .gte('dt_gerencial', dataLimite30DiasStr)
        .not('cli_fone', 'is', null);

      if (clientesAtivosError) {
        console.error('Erro ao buscar clientes ativos mensais:', clientesAtivosError);
      }

      // Contar clientes únicos com 2+ visitas
      const clientesMap = new Map<string, number>();
      (clientesAtivosData || []).forEach(row => {
        const fone = (row.cli_fone || '').toString().trim();
        if (fone) {
          clientesMap.set(fone, (clientesMap.get(fone) || 0) + 1);
        }
      });

      const clientesAtivos = Array.from(clientesMap.values()).filter(count => count >= 2).length;

      // Clientes Totais do mês
      const { data: clientesTotaisData, error: clientesTotaisError } = await supabase
        .from('contahub_periodo')
        .select('cli_fone')
        .eq('bar_id', barIdNum)
        .gte('dt_gerencial', startDate)
        .lte('dt_gerencial', endDate)
        .not('cli_fone', 'is', null);

      if (clientesTotaisError) {
        console.error('Erro ao buscar clientes totais mensais:', clientesTotaisError);
      }

      const clientesTotaisUnicos = new Set(
        (clientesTotaisData || []).map(row => (row.cli_fone || '').toString().trim()).filter(Boolean)
      ).size;

      // Faturamento Total do mês
      const { data: faturamentoData, error: faturamentoError } = await supabase
        .from('contahub_periodo')
        .select('vr_total')
        .eq('bar_id', barIdNum)
        .gte('dt_gerencial', startDate)
        .lte('dt_gerencial', endDate);

      if (faturamentoError) {
        console.error('Erro ao buscar faturamento mensal:', faturamentoError);
      }

      const faturamentoTotal = (faturamentoData || []).reduce((sum, row) => sum + (row.vr_total || 0), 0);

      // Taxa de Retenção (clientes ativos / clientes totais)
      const taxaRetencao = clientesTotaisUnicos > 0 ? (clientesAtivos / clientesTotaisUnicos) * 100 : 0;

      // Artística (valores simulados para o mês)
      const artistica = faturamentoTotal * 0.05; // 5% do faturamento

      const resp = NextResponse.json({
        success: true,
        data: {
          faturamentoTotal: {
            valor: faturamentoTotal,
            meta: 800000, // Meta mensal
            variacao: 0 // TODO: Calcular variação vs mês anterior
          },
          clientesAtivos: {
            valor: clientesAtivos,
            meta: 250, // Meta mensal
            variacao: 0
          },
          clientesTotais: {
            valor: clientesTotaisUnicos,
            meta: 1000, // Meta mensal
            variacao: 0
          },
          retencao: {
            valor: taxaRetencao,
            meta: 40, // Meta de 40% (retornantes)
            variacao: 0
          },
          retencaoReal: {
            valor: 0, // TODO: Calcular para visão anual
            meta: 5, // Meta de 5% (que voltaram)
            variacao: 0
          },
          artistica: {
            valor: artistica,
            meta: faturamentoTotal * 0.08, // Meta de 8%
            variacao: 0
          }
        }
      });

      resp.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return resp;
    }

    const resp = NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    resp.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return resp;

  } catch (error) {
    // Log detalhado apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Erro ao buscar indicadores:', error);
    } else {
      // Em produção, log simplificado
      console.error('Erro na API visão-geral:', error instanceof Error ? error.message : 'Erro desconhecido');
    }
    
    const resp = NextResponse.json(
      { 
        success: false,
        error: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  }
}
