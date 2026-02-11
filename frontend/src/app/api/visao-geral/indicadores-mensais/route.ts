import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface IndicadoresMes {
  mes: string;
  mesNome: string;
  mesAbrev: string;
  faturamentoTotal: number;
  clientesAtivos: number;
  clientesTotais: number;
  novosClientes: number;
  clientesRecorrentes: number;
  taxaRetencao: number;
  reputacao: number;
  percentualNovos: number;
  percentualRecorrentes: number;
  percentualAtivos: number;
  cmoTotal: number;
  percentualArtistico: number;
  ticketMedio: number;
  totalPessoas: number;
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');
    const mesReferencia = searchParams.get('mes'); // Formato: YYYY-MM (será o último dos 3 meses)

    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'barId é obrigatório'
      }, { status: 400 });
    }

    const barIdNum = parseInt(barId);
    
    // Definir os 4 meses para análise
    const dataRef = mesReferencia ? 
      new Date(parseInt(mesReferencia.split('-')[0]), parseInt(mesReferencia.split('-')[1]) - 1, 1) : 
      new Date(2025, 8, 1); // Setembro = mês 8 (base 0)
    const meses: { mes: string; mesNome: string; mesAbrev: string }[] = [];
    
    // Criar os 4 meses: 3 meses atrás, 2 meses atrás, 1 mês atrás, mês atual
    for (let i = 3; i >= 0; i--) {
      const mesData = new Date(dataRef.getFullYear(), dataRef.getMonth() - i, 1);
      meses.push({
        mes: `${mesData.getFullYear()}-${(mesData.getMonth() + 1).toString().padStart(2, '0')}`,
        mesNome: mesData.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        mesAbrev: mesData.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()
      });
    }

    console.log(`🔍 Calculando indicadores mensais para bar ${barIdNum}:`);
    console.log(`📅 Meses: ${meses.map(m => m.mes).join(', ')}`);
    console.log(`📊 barId recebido: ${barId}, barIdNum: ${barIdNum}`);

    const indicadoresPorMes: IndicadoresMes[] = [];

    // Calcular indicadores para cada mês
    for (const mesInfo of meses) {
      const [ano, mes] = mesInfo.mes.split('-');
      const inicioMes = `${mesInfo.mes}-01`;
      const fimMes = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];

      console.log(`📊 Processando ${mesInfo.mesNome} (${inicioMes} a ${fimMes})`);

      // 1. FATURAMENTO TOTAL DO MÊS (ContaHub + Yuzer + Sympla)
      console.log(`💰 Buscando faturamento para bar_id=${barIdNum}, período=${inicioMes} a ${fimMes}`);
      
      const limit = 1000; // Limite para paginação
      
      // 1.1. CONTAHUB (excluindo 'Conta Assinada')
      let contahubData: any[] = [];
      let fromContahub = 0;
      let hasMoreContahub = true;

      while (hasMoreContahub) {
        const { data: batch, error: batchError } = await supabase
          .from('contahub_pagamentos')
          .select('liquido, meio')
          .eq('bar_id', barIdNum)
          .gte('dt_gerencial', inicioMes)
          .lte('dt_gerencial', fimMes)
          .range(fromContahub, fromContahub + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch ContaHub:', batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) {
          hasMoreContahub = false;
        } else {
          contahubData = contahubData.concat(batch);
          fromContahub += limit;
          hasMoreContahub = batch.length === limit;
        }
      }

      // Filtrar para excluir 'Conta Assinada' (consumo de sócios)
      const contahubFiltrado = contahubData?.filter(item => item.meio !== 'Conta Assinada') || [];
      const faturamentoContahub = contahubFiltrado.reduce((sum, item) => sum + (parseFloat(item.liquido) || 0), 0);

      // 1.2. YUZER
      let yuzerData: any[] = [];
      let fromYuzer = 0;
      let hasMoreYuzer = true;

      while (hasMoreYuzer) {
        const { data: batch, error: batchError } = await supabase
          .from('yuzer_pagamento')
          .select('valor_liquido')
          .eq('bar_id', barIdNum)
          .gte('data_evento', inicioMes)
          .lte('data_evento', fimMes)
          .range(fromYuzer, fromYuzer + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch Yuzer:', batchError);
          // Yuzer pode não existir para alguns bares, continuar
          break;
        }

        if (!batch || batch.length === 0) {
          hasMoreYuzer = false;
        } else {
          yuzerData = yuzerData.concat(batch);
          fromYuzer += limit;
          hasMoreYuzer = batch.length === limit;
        }
      }

      const faturamentoYuzer = yuzerData.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0);

      // 1.3. SYMPLA
      let symplaData: any[] = [];
      let fromSympla = 0;
      let hasMoreSympla = true;

      while (hasMoreSympla) {
        const { data: batch, error: batchError } = await supabase
          .from('sympla_pedidos')
          .select('valor_liquido')
          .gte('data_pedido', inicioMes)
          .lte('data_pedido', fimMes)
          .range(fromSympla, fromSympla + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch Sympla:', batchError);
          // Sympla pode não existir para alguns bares, continuar
          break;
        }

        if (!batch || batch.length === 0) {
          hasMoreSympla = false;
        } else {
          symplaData = symplaData.concat(batch);
          fromSympla += limit;
          hasMoreSympla = batch.length === limit;
        }
      }

      const faturamentoSympla = symplaData.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0);

      // 1.4. TOTAL
      const faturamentoTotal = faturamentoContahub + faturamentoYuzer + faturamentoSympla;
      
      console.log(`💰 Faturamento ContaHub: R$ ${faturamentoContahub.toLocaleString('pt-BR')} (${contahubFiltrado.length} registros)`);
      console.log(`💰 Faturamento Yuzer: R$ ${faturamentoYuzer.toLocaleString('pt-BR')} (${yuzerData.length} registros)`);
      console.log(`💰 Faturamento Sympla: R$ ${faturamentoSympla.toLocaleString('pt-BR')} (${symplaData.length} registros)`);
      console.log(`💰 Faturamento TOTAL: R$ ${faturamentoTotal.toLocaleString('pt-BR')}`);

      // 2. PREPARAR DADOS PARA CLIENTES ATIVOS
      // Vamos calcular depois que tivermos os clientes totais do mês

      // 3. CLIENTES TOTAIS DO MÊS - TODOS os registros
      console.log(`📊 Buscando clientes totais do mês ${inicioMes} a ${fimMes}`);

      let clientesTotaisData: any[] = [];
      let fromTotais = 0;
      let hasMoreTotais = true;

      while (hasMoreTotais) {
        const { data: batch, error: batchError } = await supabase
          .from('contahub_periodo')
          .select('cli_fone')
          .eq('bar_id', barIdNum)
          .gte('dt_gerencial', inicioMes)
          .lte('dt_gerencial', fimMes)
          .not('cli_fone', 'is', null)
          .range(fromTotais, fromTotais + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch de clientes totais:', batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) {
          hasMoreTotais = false;
        } else {
          clientesTotaisData = clientesTotaisData.concat(batch);
          fromTotais += limit;
          hasMoreTotais = batch.length === limit;
        }
      }

      console.log(`📊 Registros de clientes totais encontrados: ${clientesTotaisData?.length || 0}`);

      const clientesTotaisUnicos = new Set(
        (clientesTotaisData || []).map(row => (row.cli_fone || '').toString().trim()).filter(Boolean)
      ).size;

      console.log(`📊 Clientes totais únicos: ${clientesTotaisUnicos}`);

      // 3. NOVOS CLIENTES (primeira visita no mês)
      console.log(`📊 Calculando novos clientes para ${mesInfo.mesNome} (${inicioMes} a ${fimMes})`);
      
      // Buscar TODOS os clientes históricos para calcular primeira visita (sem limite)
      let todosClientesData: any[] = [];
      let fromHistorico = 0;
      const limitHistorico = 1000;
      let hasMoreHistorico = true;

      while (hasMoreHistorico) {
        const { data: batch, error: batchError } = await supabase
          .from('contahub_periodo')
          .select('cli_fone, dt_gerencial')
          .eq('bar_id', barIdNum)
          .not('cli_fone', 'is', null)
          .order('dt_gerencial', { ascending: true })
          .range(fromHistorico, fromHistorico + limitHistorico - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch de dados:', batchError);
          break;
        }

        if (!batch || batch.length === 0) {
          hasMoreHistorico = false;
        } else {
          todosClientesData = todosClientesData.concat(batch);
          fromHistorico += limitHistorico;
          hasMoreHistorico = batch.length === limitHistorico; // Se retornou menos que o limite, não há mais dados
        }
      }

      const todosClientesError = null; // Já tratamos os erros acima

      let novosClientes = 0;
      if (!todosClientesError && todosClientesData) {
        console.log(`📊 Processando ${todosClientesData.length} registros para calcular novos clientes`);
        
        const primeiraVisitaMap = new Map<string, string>();
        todosClientesData.forEach(row => {
          const fone = (row.cli_fone || '').toString().trim();
          const data = row.dt_gerencial;
          if (fone && data) {
            // Só adiciona se não existe (primeira ocorrência já que está ordenado por data)
            if (!primeiraVisitaMap.has(fone)) {
              primeiraVisitaMap.set(fone, data);
            }
          }
        });

        // Contar quantos clientes tiveram primeira visita neste mês
        primeiraVisitaMap.forEach((primeiraVisita) => {
          if (primeiraVisita >= inicioMes && primeiraVisita <= fimMes) {
            novosClientes++;
          }
        });
        
        console.log(`📊 Novos clientes calculados: ${novosClientes} (primeira visita entre ${inicioMes} e ${fimMes})`);
      } else {
        console.error('❌ Erro ao buscar dados para novos clientes:', todosClientesError);
      }

      // 4. CLIENTES RECORRENTES (visitaram no mês MAS não são novos)
      console.log(`🔄 Calculando clientes recorrentes para ${mesInfo.mesNome}`);
      
      // Clientes recorrentes = Clientes totais do mês - Novos clientes
      const clientesRecorrentes = clientesTotaisUnicos - novosClientes;
      console.log(`🔄 Clientes recorrentes calculados: ${clientesRecorrentes} (${clientesTotaisUnicos} totais - ${novosClientes} novos)`);

      // 5. VALIDAÇÃO: Novos + Recorrentes deve = Totais
      const soma = novosClientes + clientesRecorrentes;
      if (soma !== clientesTotaisUnicos) {
        console.warn(`⚠️ ATENÇÃO: Soma não confere! Novos(${novosClientes}) + Recorrentes(${clientesRecorrentes}) = ${soma}, mas Totais = ${clientesTotaisUnicos}`);
      } else {
        console.log(`✅ Validação OK: ${novosClientes} + ${clientesRecorrentes} = ${clientesTotaisUnicos}`);
      }

      // 5. CLIENTES ATIVOS (visitaram no mês + pelo menos 1x nos últimos 90 dias)
      console.log(`👥 Calculando clientes ativos para ${mesInfo.mesNome}`);
      
      // Buscar clientes que visitaram no mês
      const clientesDoMes = new Set(
        (clientesTotaisData || []).map(row => (row.cli_fone || '').toString().trim()).filter(Boolean)
      );
      
      // Buscar histórico dos últimos 90 dias (antes do mês)
      const data90DiasAtras = new Date(inicioMes);
      data90DiasAtras.setDate(data90DiasAtras.getDate() - 90);
      const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0];
      const fimPeriodoAnterior = new Date(inicioMes);
      fimPeriodoAnterior.setDate(fimPeriodoAnterior.getDate() - 1);
      const fimPeriodoAnteriorStr = fimPeriodoAnterior.toISOString().split('T')[0];

      console.log(`👥 Buscando histórico recente de ${data90DiasAtrasStr} a ${fimPeriodoAnteriorStr}`);

      let historicoRecenteData: any[] = [];
      let fromHistoricoRecente = 0;
      let hasMoreHistoricoRecente = true;

      while (hasMoreHistoricoRecente) {
        const { data: batch, error: batchError } = await supabase
          .from('contahub_periodo')
          .select('cli_fone')
          .eq('bar_id', barIdNum)
          .gte('dt_gerencial', data90DiasAtrasStr)
          .lte('dt_gerencial', fimPeriodoAnteriorStr)
          .not('cli_fone', 'is', null)
          .range(fromHistoricoRecente, fromHistoricoRecente + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch de histórico recente:', batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) {
          hasMoreHistoricoRecente = false;
        } else {
          historicoRecenteData = historicoRecenteData.concat(batch);
          fromHistoricoRecente += limit;
          hasMoreHistoricoRecente = batch.length === limit;
        }
      }

      // Clientes que visitaram nos últimos 90 dias (antes do mês)
      const clientesHistoricoRecente = new Set(
        (historicoRecenteData || []).map(row => (row.cli_fone || '').toString().trim()).filter(Boolean)
      );

      // Clientes ativos = visitaram no mês E também visitaram nos 90 dias anteriores
      let clientesAtivos = 0;
      clientesDoMes.forEach(cliente => {
        if (clientesHistoricoRecente.has(cliente)) {
          clientesAtivos++;
        }
      });

      console.log(`👥 Clientes ativos calculados: ${clientesAtivos} (visitaram no mês + nos últimos 90 dias)`);

      // 6. PERCENTUAIS
      const percentualNovos = clientesTotaisUnicos > 0 ? (novosClientes / clientesTotaisUnicos) * 100 : 0;
      const percentualRecorrentes = clientesTotaisUnicos > 0 ? (clientesRecorrentes / clientesTotaisUnicos) * 100 : 0;
      const percentualAtivos = clientesTotaisUnicos > 0 ? (clientesAtivos / clientesTotaisUnicos) * 100 : 0;

      // 7. REPUTAÇÃO (média do mês - Google Reviews via Apify)
      // Usando timezone de Brasília (-03:00) para evitar problemas de dia
      const { data: reputacaoData, error: reputacaoError } = await supabase
        .from('google_reviews')
        .select('stars')
        .eq('bar_id', barIdNum)
        .gte('published_at_date', inicioMes + 'T00:00:00-03:00')
        .lte('published_at_date', fimMes + 'T23:59:59-03:00');

      let reputacao = 0;
      if (!reputacaoError && reputacaoData && reputacaoData.length > 0) {
        const somaRatings = reputacaoData.reduce((sum, row) => sum + (row.stars || 0), 0);
        reputacao = somaRatings / reputacaoData.length;
      }

      // 8. CALCULAR CMO (Custo de Mão de Obra) - buscar da tabela nibo_agendamentos
      console.log(`💼 Calculando CMO para ${mesInfo.mesNome}`);
      const { data: cmoData, error: cmoError } = await supabase
        .from('nibo_agendamentos')
        .select('valor')
        .eq('bar_id', barIdNum)
        .gte('data_competencia', inicioMes)
        .lte('data_competencia', fimMes)
        .in('categoria_nome', [
          'SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE',
          'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA'
        ]);

      const cmoTotal = !cmoError && cmoData ? 
        cmoData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0) : 0;
      
      console.log(`💼 CMO calculado: R$ ${cmoTotal.toLocaleString('pt-BR')} (${cmoData?.length || 0} registros)`);

      // 9. CALCULAR % ARTÍSTICA/FATURAMENTO
      console.log(`🎭 Calculando % Artística para ${mesInfo.mesNome}`);
      const { data: artisticaData, error: artisticaError } = await supabase
        .from('nibo_agendamentos')
        .select('valor')
        .eq('bar_id', barIdNum)
        .gte('data_competencia', inicioMes)
        .lte('data_competencia', fimMes)
        .in('categoria_nome', ['ATRAÇÕES', 'PRODUÇÃO', 'MARKETING']);

      const custoArtistico = !artisticaError && artisticaData ? 
        artisticaData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0) : 0;
      
      const percentualArtistico = faturamentoTotal > 0 ? (custoArtistico / faturamentoTotal) * 100 : 0;
      
      console.log(`🎭 Custo Artístico: R$ ${custoArtistico.toLocaleString('pt-BR')} (${percentualArtistico.toFixed(1)}%)`);

      // 10. CALCULAR TICKET MÉDIO CORRETO
      // Ticket médio = Faturamento / Número de pessoas (não clientes únicos)
      console.log(`🎯 Calculando Ticket Médio para ${mesInfo.mesNome}`);
      
      // Buscar pessoas do ContaHub
      const { data: pessoasContahub, error: pessoasError } = await supabase
        .from('contahub_periodo')
        .select('pessoas')
        .eq('bar_id', barIdNum)
        .gte('dt_gerencial', inicioMes)
        .lte('dt_gerencial', fimMes);

      const totalPessoas = !pessoasError && pessoasContahub ? 
        pessoasContahub.reduce((sum, item) => sum + (parseInt(item.pessoas) || 0), 0) : 0;
      
      const ticketMedio = totalPessoas > 0 ? faturamentoTotal / totalPessoas : 0;
      
      console.log(`🎯 Pessoas: ${totalPessoas}, Ticket Médio: R$ ${ticketMedio.toFixed(2)}`);

      indicadoresPorMes.push({
        mes: mesInfo.mes,
        mesNome: mesInfo.mesNome,
        mesAbrev: mesInfo.mesAbrev,
        faturamentoTotal,
        clientesRecorrentes,
        clientesTotais: clientesTotaisUnicos,
        novosClientes,
        clientesAtivos,
        taxaRetencao: clientesTotaisUnicos > 0 ? (clientesAtivos / clientesTotaisUnicos) * 100 : 0,
        percentualNovos,
        percentualRecorrentes,
        percentualAtivos,
        cmoTotal,
        percentualArtistico,
        ticketMedio,
        totalPessoas,
        reputacao
      });

      console.log(`✅ ${mesInfo.mesNome}: Fat=${faturamentoTotal.toLocaleString()}, Totais=${clientesTotaisUnicos}, Novos=${novosClientes}, Recorrentes=${clientesRecorrentes}, Ativos=${clientesAtivos}`);
    }

    // Calcular variações entre os meses
    const indicadoresComVariacao = indicadoresPorMes.map((indicador, index) => {
      const mesAnterior = index > 0 ? indicadoresPorMes[index - 1] : null;
      
      const calcularVariacao = (atual: number, anterior: number) => {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return ((atual - anterior) / anterior) * 100;
      };

      return {
        ...indicador,
        variacoes: mesAnterior ? {
          faturamento: calcularVariacao(indicador.faturamentoTotal, mesAnterior.faturamentoTotal),
          clientesRecorrentes: calcularVariacao(indicador.clientesRecorrentes, mesAnterior.clientesRecorrentes),
          clientesTotais: calcularVariacao(indicador.clientesTotais, mesAnterior.clientesTotais),
          novosClientes: calcularVariacao(indicador.novosClientes, mesAnterior.novosClientes),
          clientesAtivos: calcularVariacao(indicador.clientesAtivos, mesAnterior.clientesAtivos),
          percentualNovos: calcularVariacao(indicador.percentualNovos, mesAnterior.percentualNovos),
          percentualRecorrentes: calcularVariacao(indicador.percentualRecorrentes, mesAnterior.percentualRecorrentes),
          percentualAtivos: calcularVariacao(indicador.percentualAtivos, mesAnterior.percentualAtivos),
          cmoTotal: calcularVariacao(indicador.cmoTotal, mesAnterior.cmoTotal),
          percentualArtistico: calcularVariacao(indicador.percentualArtistico, mesAnterior.percentualArtistico),
          ticketMedio: calcularVariacao(indicador.ticketMedio, mesAnterior.ticketMedio),
          reputacao: calcularVariacao(indicador.reputacao, mesAnterior.reputacao)
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        meses: indicadoresComVariacao, // Ordem crescente: Junho -> Setembro
        periodo: `${meses[3].mesNome} - ${meses[0].mesNome}`, // Junho - Setembro
        ultimaAtualizacao: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao calcular indicadores mensais:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
