import { SupabaseClient } from '@supabase/supabase-js';

// Função para calcular datas do trimestre
export function getTrimestreDates(trimestre: number, year?: number) {
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
export function getTrimestreAnterior(trimestre: number, year?: number) {
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

// Função para buscar dados com paginação (contorna limite de 1000 do Supabase)
async function fetchAllData(supabase: SupabaseClient, tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  
  const MAX_ITERATIONS = 100;
  let iterations = 0;
  
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
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
        query = query.in(key.replace('in_', ''), value as any[]);
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
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

// Função para calcular taxa de retornantes trimestral
export async function calcularRetencao(supabase: SupabaseClient, barIdNum: number, mesEspecifico?: string, trimestre?: number) {
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
export async function calcularRetencaoReal(supabase: SupabaseClient, barIdNum: number, trimestre?: number) {
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
    ]) as [any[], any[], any[]];
    
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
    
    return {
      valor: parseFloat(percentualRetencaoReal.toFixed(1)),
      variacao: parseFloat(variacaoRetencaoReal.toFixed(1))
    };
    
  } catch (error) {
    console.error('❌ Erro ao calcular retenção real:', error);
    return { valor: 0, variacao: 0 };
  }
}
