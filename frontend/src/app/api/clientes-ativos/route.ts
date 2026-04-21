import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Função para buscar dados com paginação (contorna limite de 1000 do Supabase)
async function fetchAllData(supabase: any, tableName: string, columns: string, filters: any = {}) {
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
      } else if (key.includes('lt_')) {
        query = query.lt(key.replace('lt_', ''), value);
      } else if (key.includes('eq_')) {
        query = query.eq(key.replace('eq_', ''), value);
      } else if (key.includes('neq_')) {
        query = query.neq(key.replace('neq_', ''), value);
      } else if (key.includes('not_null_')) {
        query = query.not(key.replace('not_null_', ''), 'is', null);
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`❌ Erro ao buscar ${tableName}:`, error);
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

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const periodo = searchParams.get('periodo') || 'semana'; // dia, semana, mes
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    let inicioAtual: string;
    let fimAtual: string;
    let inicioAnterior: string;
    let fimAnterior: string;
    let label: string;

    // Calcular períodos baseado no tipo
    if (periodo === 'dia') {
      // DIA ESPECÍFICO - Comparar com mesmo dia da semana passada (7 dias atrás)
      if (dataInicio) {
        inicioAtual = dataInicio;
        fimAtual = dataInicio;
      } else {
        const hoje = new Date();
        inicioAtual = hoje.toISOString().split('T')[0];
        fimAtual = inicioAtual;
      }
      
      // Calcular mesmo dia da semana anterior (7 dias atrás)
      const [ano, mes, dia] = inicioAtual.split('-').map(Number);
      const dataAtual = new Date(ano, mes - 1, dia);
      const dataAnterior = new Date(dataAtual);
      dataAnterior.setDate(dataAtual.getDate() - 7); // 7 dias atrás
      inicioAnterior = dataAnterior.toISOString().split('T')[0];
      fimAnterior = inicioAnterior;
      
      label = new Date(inicioAtual + 'T00:00:00').toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: '2-digit', 
        month: 'long' 
      });
    } else if (periodo === 'mes') {
      // MÊS ESPECÍFICO
      let ano: number, mes: number;
      if (dataInicio) {
        const [anoStr, mesStr] = dataInicio.split('-').map(Number);
        ano = anoStr;
        mes = mesStr - 1; // JavaScript usa 0-11 para meses
      } else {
        const hoje = new Date();
        ano = hoje.getFullYear();
        mes = hoje.getMonth();
      }
      
      inicioAtual = new Date(ano, mes, 1).toISOString().split('T')[0];
      fimAtual = new Date(ano, mes + 1, 0).toISOString().split('T')[0];
      
      inicioAnterior = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
      fimAnterior = new Date(ano, mes, 0).toISOString().split('T')[0];
      
      label = new Date(inicioAtual + 'T00:00:00').toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
      });
    } else {
      // SEMANA (segunda-feira a domingo) - Padrão ISO
      const hoje = dataInicio ? new Date(dataInicio + 'T12:00:00') : new Date();
      const ano = hoje.getFullYear();
      
      // Calcular início e fim da semana atual (segunda = 1, domingo = 0)
      const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
      
      // Criar data da segunda-feira da semana (início)
      const inicioSemanaAtual = new Date(hoje);
      const diasParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana; // Se domingo, volta 6 dias; senão, vai para segunda
      inicioSemanaAtual.setDate(hoje.getDate() + diasParaSegunda);
      inicioSemanaAtual.setHours(0, 0, 0, 0);
      
      // Criar data do domingo da semana (fim)
      const fimSemanaAtual = new Date(inicioSemanaAtual);
      fimSemanaAtual.setDate(inicioSemanaAtual.getDate() + 6); // Avança 6 dias até domingo
      fimSemanaAtual.setHours(23, 59, 59, 999);
      
      // Calcular semana anterior
      const inicioSemanaAnterior = new Date(inicioSemanaAtual);
      inicioSemanaAnterior.setDate(inicioSemanaAtual.getDate() - 7);
      const fimSemanaAnterior = new Date(inicioSemanaAnterior);
      fimSemanaAnterior.setDate(inicioSemanaAnterior.getDate() + 6);
      
      // Calcular número da semana no ano (padrão ISO - semana começa na segunda)
      const jan4 = new Date(ano, 0, 4); // 4 de janeiro sempre está na primeira semana ISO
      const jan4Day = jan4.getDay() || 7; // Domingo = 7
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() - jan4Day + 1); // Volta para a primeira segunda-feira
      const weeksDiff = Math.floor((inicioSemanaAtual.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const semanaAtual = weeksDiff + 1;

      inicioAtual = inicioSemanaAtual.toISOString().split('T')[0];
      fimAtual = fimSemanaAtual.toISOString().split('T')[0];
      inicioAnterior = inicioSemanaAnterior.toISOString().split('T')[0];
      fimAnterior = fimSemanaAnterior.toISOString().split('T')[0];
      
      label = `Semana ${semanaAtual} (${inicioSemanaAtual.toLocaleDateString('pt-BR')} - ${fimSemanaAtual.toLocaleDateString('pt-BR')})`;
    }

    // 🔒 DADOS FIXOS: Para SEMANAS PASSADAS, buscar dados salvos da tabela desempenho_semanal
    if (periodo === 'semana') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const fimSemanaDate = new Date(fimAtual + 'T00:00:00');
      
      // Se a semana já terminou (domingo já passou), buscar dados fixos
      if (fimSemanaDate < hoje) {
        // Buscar dados fixos da semana atual e anterior
        const { data: dadosSemana, error: errorSemana } = await supabase
          .from('desempenho_semanal')
          .select('numero_semana, data_inicio, data_fim, perc_clientes_novos, clientes_ativos')
          .eq('bar_id', barId)
          .in('data_inicio', [inicioAtual, inicioAnterior])
          .order('data_inicio', { ascending: false });

        if (!errorSemana && dadosSemana && dadosSemana.length > 0) {
          // Encontrar dados da semana atual e anterior
          const semanaAtualData = dadosSemana.find(s => s.data_inicio === inicioAtual);
          const semanaAnteriorData = dadosSemana.find(s => s.data_inicio === inicioAnterior);

          // Se temos dados fixos de % Novos e Clientes Ativos, usar eles
          if (semanaAtualData && semanaAtualData.perc_clientes_novos !== null && semanaAtualData.clientes_ativos !== null) {
            // Ainda precisamos calcular os totais de clientes (que não mudam)
            const { data: metricas } = await supabase.rpc('calcular_metricas_clientes', {
              p_bar_id: barId,
              p_data_inicio_atual: inicioAtual,
              p_data_fim_atual: fimAtual,
              p_data_inicio_anterior: inicioAnterior,
              p_data_fim_anterior: fimAnterior
            });

            if (metricas && metricas[0]) {
              const resultado = metricas[0];
              const totalClientesAtual = Number(resultado.total_atual);
              const totalClientesAnterior = Number(resultado.total_anterior);
              
              // Usar % fixo para calcular novos e retornantes
              const percNovosFixo = Number(semanaAtualData.perc_clientes_novos);
              const novosClientesFixo = Math.round(totalClientesAtual * (percNovosFixo / 100));
              const clientesRetornantesFixo = totalClientesAtual - novosClientesFixo;
              
              // Usar dados anteriores fixos se disponíveis
              let novosClientesAnterior = Number(resultado.novos_anterior);
              let clientesRetornantesAnterior = Number(resultado.retornantes_anterior);
              if (semanaAnteriorData && semanaAnteriorData.perc_clientes_novos !== null) {
                const percNovosAnteriorFixo = Number(semanaAnteriorData.perc_clientes_novos);
                novosClientesAnterior = Math.round(totalClientesAnterior * (percNovosAnteriorFixo / 100));
                clientesRetornantesAnterior = totalClientesAnterior - novosClientesAnterior;
              }
              
              // Dados fixos de clientes ativos
              const clientesAtivosFixo = Number(semanaAtualData.clientes_ativos);
              const clientesAtivosAnteriorFixo = semanaAnteriorData?.clientes_ativos ? Number(semanaAnteriorData.clientes_ativos) : clientesAtivosFixo;

              // Calcular variações
              const variacaoTotal = totalClientesAnterior > 0 
                ? ((totalClientesAtual - totalClientesAnterior) / totalClientesAnterior) * 100 
                : 0;
              const variacaoNovos = novosClientesAnterior > 0 
                ? ((novosClientesFixo - novosClientesAnterior) / novosClientesAnterior) * 100 
                : 0;
              const variacaoRetornantes = clientesRetornantesAnterior > 0 
                ? ((clientesRetornantesFixo - clientesRetornantesAnterior) / clientesRetornantesAnterior) * 100 
                : 0;
              const variacaoAtivos = clientesAtivosAnteriorFixo > 0 
                ? ((clientesAtivosFixo - clientesAtivosAnteriorFixo) / clientesAtivosAnteriorFixo) * 100 
                : 0;

              const percentualRetornantes = totalClientesAtual > 0 
                ? (clientesRetornantesFixo / totalClientesAtual) * 100 
                : 0;

              // Gerar insights
              const insights: any[] = [];
              if (variacaoTotal < -10) {
                insights.push({
                  tipo: 'atencao',
                  titulo: 'Queda no Fluxo',
                  descricao: `Redução de ${Math.abs(variacaoTotal).toFixed(1)}% no número de clientes. Considere ações de marketing e promoções.`
                });
              } else if (variacaoTotal > 10) {
                insights.push({
                  tipo: 'positivo',
                  titulo: 'Crescimento Acelerado',
                  descricao: `O número de clientes cresceu ${variacaoTotal.toFixed(1)}% em relação ao período anterior. Continue investindo nas estratégias atuais!`
                });
              }
              if (percNovosFixo > 60) {
                insights.push({
                  tipo: 'info',
                  titulo: 'Alta Aquisição de Novos Clientes',
                  descricao: `${percNovosFixo.toFixed(1)}% dos clientes são novos. Ótimo para crescimento! Foque em estratégias de fidelização.`
                });
              }
              if (percentualRetornantes > 60) {
                insights.push({
                  tipo: 'positivo',
                  titulo: 'Excelente Fidelização',
                  descricao: `${percentualRetornantes.toFixed(1)}% dos clientes já conhecem o bar. A experiência está gerando retorno!`
                });
              }
              if (variacaoAtivos > 15) {
                insights.push({
                  tipo: 'positivo',
                  titulo: 'Clientes Ativos em Crescimento',
                  descricao: `Os clientes ativos cresceram ${variacaoAtivos.toFixed(1)}%. Excelente engajamento!`
                });
              } else if (variacaoAtivos < -15) {
                insights.push({
                  tipo: 'atencao',
                  titulo: 'Atenção: Clientes Ativos em Queda',
                  descricao: `Redução de ${Math.abs(variacaoAtivos).toFixed(1)}% nos clientes ativos. Priorize reengajamento de clientes.`
                });
              }

              return NextResponse.json({
                success: true,
                data: {
                  periodo,
                  label,
                  periodoAtual: { inicio: inicioAtual, fim: fimAtual },
                  periodoAnterior: { inicio: inicioAnterior, fim: fimAnterior },
                  atual: {
                    totalClientes: totalClientesAtual,
                    novosClientes: novosClientesFixo,
                    clientesRetornantes: clientesRetornantesFixo,
                    percentualNovos: parseFloat(percNovosFixo.toFixed(1)),
                    percentualRetornantes: parseFloat(percentualRetornantes.toFixed(1)),
                    clientesAtivos: clientesAtivosFixo
                  },
                  anterior: {
                    totalClientes: totalClientesAnterior,
                    novosClientes: novosClientesAnterior,
                    clientesRetornantes: clientesRetornantesAnterior,
                    clientesAtivos: clientesAtivosAnteriorFixo
                  },
                  variacoes: {
                    total: parseFloat(variacaoTotal.toFixed(1)),
                    novos: parseFloat(variacaoNovos.toFixed(1)),
                    retornantes: parseFloat(variacaoRetornantes.toFixed(1)),
                    ativos: parseFloat(variacaoAtivos.toFixed(1))
                  },
                  insights,
                  fonte: 'dados_fixos' // Indicador de que são dados fixos
                }
              });
            }
          }
        }
      }
    }

    // ⚡ NOVA ESTRATÉGIA: Consumir Gold diretamente para SEMANA/MÊS
    let totalClientesAtual = 0;
    let totalClientesAnterior = 0;
    let novosClientes = 0;
    let clientesRetornantes = 0;
    let novosClientesAnterior = 0;
    let clientesRetornantesAnterior = 0;

    if (periodo === 'dia') {
      // DIA: Usar RPC (performance OK para 1 dia)
      const { data: metricas, error: errorMetricas } = await supabase.rpc('calcular_metricas_clientes', {
        p_bar_id: barId,
        p_data_inicio_atual: inicioAtual,
        p_data_fim_atual: fimAtual,
        p_data_inicio_anterior: inicioAnterior,
        p_data_fim_anterior: fimAnterior
      });

      if (errorMetricas) {
        console.error('❌ Erro ao calcular métricas:', errorMetricas);
        throw errorMetricas;
      }

      const resultado = metricas[0];
      totalClientesAtual = Number(resultado.total_atual);
      totalClientesAnterior = Number(resultado.total_anterior);
      novosClientes = Number(resultado.novos_atual);
      clientesRetornantes = Number(resultado.retornantes_atual);
      novosClientesAnterior = Number(resultado.novos_anterior);
      clientesRetornantesAnterior = Number(resultado.retornantes_anterior);
    } else {
      // SEMANA/MÊS: Consumir Gold diretamente (métricas aditivas já calculadas)
      const [goldAtual, goldAnterior] = await Promise.all([
        supabase
          .schema('gold' as any)
          .from('clientes_diario')
          .select('novos_clientes_dia, retornantes_dia, total_clientes_unicos_dia')
          .eq('bar_id', barId)
          .gte('data_referencia', inicioAtual)
          .lte('data_referencia', fimAtual)
          .order('data_referencia', { ascending: true }),
        supabase
          .schema('gold' as any)
          .from('clientes_diario')
          .select('novos_clientes_dia, retornantes_dia, total_clientes_unicos_dia')
          .eq('bar_id', barId)
          .gte('data_referencia', inicioAnterior)
          .lte('data_referencia', fimAnterior)
          .order('data_referencia', { ascending: true })
      ]);

      if (goldAtual.error) {
        console.error('❌ Erro ao buscar Gold atual:', goldAtual.error);
        throw goldAtual.error;
      }
      if (goldAnterior.error) {
        console.error('❌ Erro ao buscar Gold anterior:', goldAnterior.error);
        throw goldAnterior.error;
      }

      const goldsAtual = goldAtual.data || [];
      const goldsAnterior = goldAnterior.data || [];

      // Aditivos: SUM
      novosClientes = goldsAtual.reduce((s, d) => s + (Number(d.novos_clientes_dia) || 0), 0);
      clientesRetornantes = goldsAtual.reduce((s, d) => s + (Number(d.retornantes_dia) || 0), 0);
      novosClientesAnterior = goldsAnterior.reduce((s, d) => s + (Number(d.novos_clientes_dia) || 0), 0);
      clientesRetornantesAnterior = goldsAnterior.reduce((s, d) => s + (Number(d.retornantes_dia) || 0), 0);

      // Total clientes únicos: COUNT DISTINCT da Silver (não é aditivo)
      const [silverAtual, silverAnterior] = await Promise.all([
        supabase
          .schema('silver' as any)
          .from('cliente_visitas')
          .select('cliente_fone_norm')
          .eq('bar_id', barId)
          .eq('tem_telefone', true)
          .gte('data_visita', inicioAtual)
          .lte('data_visita', fimAtual),
        supabase
          .schema('silver' as any)
          .from('cliente_visitas')
          .select('cliente_fone_norm')
          .eq('bar_id', barId)
          .eq('tem_telefone', true)
          .gte('data_visita', inicioAnterior)
          .lte('data_visita', fimAnterior)
      ]);

      if (silverAtual.error) {
        console.error('❌ Erro ao buscar Silver atual:', silverAtual.error);
        throw silverAtual.error;
      }
      if (silverAnterior.error) {
        console.error('❌ Erro ao buscar Silver anterior:', silverAnterior.error);
        throw silverAnterior.error;
      }

      const fonesAtual = silverAtual.data || [];
      const fonesAnterior = silverAnterior.data || [];

      totalClientesAtual = new Set(fonesAtual.map(v => v.cliente_fone_norm)).size;
      totalClientesAnterior = new Set(fonesAnterior.map(v => v.cliente_fone_norm)).size;
    }

    // ⚡ CLIENTES ATIVOS - Snapshot do último dia (sempre da Gold)
    // DIA/SEMANA/MÊS: Buscar total_ativos do último dia do período
    const [goldAtivosAtual, goldAtivosAnterior] = await Promise.all([
      supabase
        .schema('gold' as any)
        .from('clientes_diario')
        .select('total_ativos')
        .eq('bar_id', barId)
        .eq('data_referencia', fimAtual)
        .maybeSingle(),
      supabase
        .schema('gold' as any)
        .from('clientes_diario')
        .select('total_ativos')
        .eq('bar_id', barId)
        .eq('data_referencia', fimAnterior)
        .maybeSingle()
    ]);

    const clientesAtivos = Number(goldAtivosAtual.data?.total_ativos || 0);
    const clientesAtivosAnterior = Number(goldAtivosAnterior.data?.total_ativos || 0);

    // 8. CALCULAR VARIAÇÕES
    const variacaoTotal = totalClientesAnterior > 0 
      ? ((totalClientesAtual - totalClientesAnterior) / totalClientesAnterior) * 100 
      : 0;

    const variacaoNovos = novosClientesAnterior > 0 
      ? ((novosClientes - novosClientesAnterior) / novosClientesAnterior) * 100 
      : 0;

    const variacaoRetornantes = clientesRetornantesAnterior > 0 
      ? ((clientesRetornantes - clientesRetornantesAnterior) / clientesRetornantesAnterior) * 100 
      : 0;

    const variacaoAtivos = clientesAtivosAnterior > 0 
      ? ((clientesAtivos - clientesAtivosAnterior) / clientesAtivosAnterior) * 100 
      : 0;

    // 9. PERCENTUAIS
    const percentualNovos = totalClientesAtual > 0 
      ? (novosClientes / totalClientesAtual) * 100 
      : 0;
    const percentualRetornantes = totalClientesAtual > 0 
      ? (clientesRetornantes / totalClientesAtual) * 100 
      : 0;

    // 10. INSIGHTS E INDICADORES
    interface Insight {
      tipo: string;
      titulo: string;
      descricao: string;
    }

    const insights: Insight[] = [];

    // 🎯 NOVO: Projeção de período (se ainda não terminou)
    const hoje = new Date();
    const dataFimPeriodo = new Date(fimAtual + 'T23:59:59');
    const dataInicioPeriodo = new Date(inicioAtual + 'T00:00:00');
    const periodoNaoTerminou = hoje < dataFimPeriodo;

    if (periodoNaoTerminou && periodo !== 'dia') {
      // Calcular dias decorridos e dias restantes
      const diasDecorridos = Math.max(1, Math.ceil((hoje.getTime() - dataInicioPeriodo.getTime()) / (1000 * 60 * 60 * 24)));
      const diasTotais = Math.ceil((dataFimPeriodo.getTime() - dataInicioPeriodo.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const diasRestantes = Math.max(0, diasTotais - diasDecorridos);

      if (diasRestantes > 0) {
        // Calcular média diária do período atual
        const mediaDiaria = totalClientesAtual / diasDecorridos;
        
        // Projetar total até o fim do período
        const clientesProjetados = Math.round(totalClientesAtual + (mediaDiaria * diasRestantes));
        
        // Comparar com período anterior
        const variacaoProjetada = totalClientesAnterior > 0 
          ? ((clientesProjetados - totalClientesAnterior) / totalClientesAnterior) * 100 
          : 0;

        const nomePeriodo = periodo === 'semana' ? 'semana' : 'mês';
        const preposicao = periodo === 'semana' ? 'a' : 'o';
        
        if (variacaoProjetada > 5) {
          insights.push({
            tipo: 'positivo',
            titulo: `🎯 Projeção Positiva`,
            descricao: `Faltam ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} n${preposicao} ${nomePeriodo}. No ritmo atual (${Math.round(mediaDiaria)} clientes/dia), você deve atingir cerca de ${clientesProjetados.toLocaleString('pt-BR')} clientes. Isso seria ${variacaoProjetada.toFixed(1)}% acima do período anterior!`
          });
        } else if (variacaoProjetada < -5) {
          insights.push({
            tipo: 'atencao',
            titulo: `🎯 Atenção à Projeção`,
            descricao: `Faltam ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} n${preposicao} ${nomePeriodo}. No ritmo atual (${Math.round(mediaDiaria)} clientes/dia), você deve atingir cerca de ${clientesProjetados.toLocaleString('pt-BR')} clientes. Isso seria ${Math.abs(variacaoProjetada).toFixed(1)}% abaixo do período anterior. Considere ações para acelerar!`
          });
        } else {
          insights.push({
            tipo: 'info',
            titulo: `🎯 Projeção de ${nomePeriodo.charAt(0).toUpperCase() + nomePeriodo.slice(1)}`,
            descricao: `Faltam ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} n${preposicao} ${nomePeriodo}. No ritmo atual (${Math.round(mediaDiaria)} clientes/dia), você deve atingir cerca de ${clientesProjetados.toLocaleString('pt-BR')} clientes até o final, similar ao período anterior.`
          });
        }
      }
    }

    // Crescimento geral (só mostra se período já terminou ou queda muito grande)
    if (!periodoNaoTerminou || variacaoTotal < -15) {
      if (variacaoTotal > 10) {
        insights.push({
          tipo: 'positivo',
          titulo: 'Crescimento Acelerado',
          descricao: `O número de clientes cresceu ${variacaoTotal.toFixed(1)}% em relação ao período anterior. Continue investindo nas estratégias atuais!`
        });
      } else if (variacaoTotal < -10) {
        insights.push({
          tipo: 'atencao',
          titulo: 'Queda no Fluxo',
          descricao: `Redução de ${Math.abs(variacaoTotal).toFixed(1)}% no número de clientes. Considere ações de marketing e promoções.`
        });
      }
    }

    // Novos clientes
    if (percentualNovos > 60) {
      insights.push({
        tipo: 'info',
        titulo: 'Alta Aquisição de Novos Clientes',
        descricao: `${percentualNovos.toFixed(1)}% dos clientes são novos. Ótimo para crescimento! Foque em estratégias de fidelização.`
      });
    }

    // Clientes retornantes
    if (percentualRetornantes > 60) {
      insights.push({
        tipo: 'positivo',
        titulo: 'Excelente Fidelização',
        descricao: `${percentualRetornantes.toFixed(1)}% dos clientes já conhecem o Ordinário. A experiência está gerando retorno!`
      });
    }

    // Clientes ativos
    if (variacaoAtivos > 15) {
      insights.push({
        tipo: 'positivo',
        titulo: 'Clientes Ativos em Crescimento',
        descricao: `Os clientes ativos cresceram ${variacaoAtivos.toFixed(1)}%. Excelente engajamento!`
      });
    } else if (variacaoAtivos < -15) {
      insights.push({
        tipo: 'atencao',
        titulo: 'Atenção: Clientes Ativos em Queda',
        descricao: `Redução de ${Math.abs(variacaoAtivos).toFixed(1)}% nos clientes ativos. Priorize reengajamento de clientes.`
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        periodo,
        label,
        periodoAtual: {
          inicio: inicioAtual,
          fim: fimAtual
        },
        periodoAnterior: {
          inicio: inicioAnterior,
          fim: fimAnterior
        },
        atual: {
          totalClientes: totalClientesAtual,
          novosClientes,
          clientesRetornantes,
          percentualNovos: parseFloat(percentualNovos.toFixed(1)),
          percentualRetornantes: parseFloat(percentualRetornantes.toFixed(1)),
          clientesAtivos
        },
        anterior: {
          totalClientes: totalClientesAnterior,
          novosClientes: novosClientesAnterior,
          clientesRetornantes: clientesRetornantesAnterior,
          clientesAtivos: clientesAtivosAnterior
        },
        variacoes: {
          total: parseFloat(variacaoTotal.toFixed(1)),
          novos: parseFloat(variacaoNovos.toFixed(1)),
          retornantes: parseFloat(variacaoRetornantes.toFixed(1)),
          ativos: parseFloat(variacaoAtivos.toFixed(1))
        },
        insights
      }
    });

  } catch (error: any) {
    console.error('❌ Erro na API de clientes ativos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erro ao buscar dados de clientes ativos' 
      },
      { status: 500 }
    );
  }
}
