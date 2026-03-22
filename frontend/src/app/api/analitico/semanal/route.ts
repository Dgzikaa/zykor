import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarMultiplasDatas } from '@/lib/helpers/calendario-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface IndicadorSemanal {
  data: string;
  diaSemana: string;
  faturamentoTotal: number;
  clientesRecorrentes: number;
  clientesTotais: number;
  novosClientes: number;
  clientesAtivos: number;
  percentualNovos: number;
  percentualRecorrentes: number;
  percentualAtivos: number;
  cmoTotal: number;
  percentualArtistico: number;
  ticketMedio: number;
  totalPessoas: number;
  reputacao: number;
}

const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');
    const diaSemana = searchParams.get('diaSemana'); // 0=Domingo, 1=Segunda, ..., 6=Sábado

    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'barId é obrigatório'
      }, { status: 400 });
    }

    if (!diaSemana) {
      return NextResponse.json({
        success: false,
        error: 'diaSemana é obrigatório'
      }, { status: 400 });
    }

    const barIdNum = parseInt(barId);
    const diaSemanaNum = parseInt(diaSemana);
    
    // Encontrar as últimas 4 ocorrências do dia da semana selecionado
    const hoje = new Date();
    const datasParaBuscar: string[] = [];
    
    // Buscar as últimas 8 semanas para garantir que encontremos 4 ocorrências com dados
    for (let semanas = 0; semanas < 8; semanas++) {
      const dataBase = new Date(hoje);
      dataBase.setDate(dataBase.getDate() - (semanas * 7));
      
      // Encontrar o dia da semana desejado nesta semana
      const diasParaVoltar = (dataBase.getDay() - diaSemanaNum + 7) % 7;
      dataBase.setDate(dataBase.getDate() - diasParaVoltar);
      
      const dataFormatada = dataBase.toISOString().split('T')[0];
      datasParaBuscar.push(dataFormatada);
    }

    
    // ⚡ FILTRAR DIAS FECHADOS
    const statusDias = await verificarMultiplasDatas(datasParaBuscar, barIdNum);
    const datasAberto = datasParaBuscar.filter(data => {
      const status = statusDias.get(data);
      return status?.aberto !== false;
    });
    
    
    const indicadoresPorSemana: IndicadorSemanal[] = [];
    const limit = 1000;

    for (const data of datasAberto) {
      const inicioData = data;
      const fimData = data;

      
      // 1. FATURAMENTO TOTAL DO DIA (ContaHub + Yuzer + Sympla)
            
      // 1.1. FATURAMENTO_PAGAMENTOS (excluindo 'Conta Assinada')
      let contahubData: any[] = [];
      let fromContahub = 0;
      let hasMoreContahub = true;

      while (hasMoreContahub) {
        const { data: batch, error: batchError } = await supabase
          .from('faturamento_pagamentos')
          .select('valor_liquido, meio')
          .eq('bar_id', barIdNum)
          .gte('data_pagamento', inicioData)
          .lte('data_pagamento', fimData)
          .range(fromContahub, fromContahub + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch faturamento_pagamentos:', batchError);
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

      const contahubFiltrado = contahubData?.filter(item => item.meio !== 'Conta Assinada') || [];
      const faturamentoContahub = contahubFiltrado.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0);

      // 1.2. YUZER
      let yuzerData: any[] = [];
      let fromYuzer = 0;
      let hasMoreYuzer = true;

      while (hasMoreYuzer) {
        const { data: batch, error: batchError } = await supabase
          .from('yuzer_pagamento')
          .select('valor_liquido')
          .eq('bar_id', barIdNum)
          .gte('data_evento', inicioData)
          .lte('data_evento', fimData)
          .range(fromYuzer, fromYuzer + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch Yuzer:', batchError);
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
          .gte('data_pedido', inicioData)
          .lte('data_pedido', fimData)
          .range(fromSympla, fromSympla + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch Sympla:', batchError);
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

      const faturamentoTotal = faturamentoContahub + faturamentoYuzer + faturamentoSympla;
      
      // Se não há faturamento, pular este dia
      if (faturamentoTotal === 0) {
                continue;
      }

      // 2. CLIENTES TOTAIS ÚNICOS DO DIA
            let clientesTotaisData: any[] = [];
      let fromTotais = 0;
      let hasMoreTotais = true;

      while (hasMoreTotais) {
        const { data: batch, error: batchError } = await supabase
          .from('visitas')
          .select('cliente_fone')
          .eq('bar_id', barIdNum)
          .gte('data_visita', inicioData)
          .lte('data_visita', fimData)
          .not('cliente_fone', 'is', null)
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

      const clientesTotaisUnicos = new Set(
        (clientesTotaisData || []).map(row => (row.cliente_fone || '').toString().trim()).filter(Boolean)
      ).size;

      
      // 3. NOVOS CLIENTES (primeira visita no dia)
            
      // Buscar histórico completo até o dia anterior
      const dataAnterior = new Date(data);
      dataAnterior.setDate(dataAnterior.getDate() - 1);
      const dataAnteriorStr = dataAnterior.toISOString().split('T')[0];

      let historicoData: any[] = [];
      let fromHistorico = 0;
      let hasMoreHistorico = true;

      while (hasMoreHistorico) {
        const { data: batch, error: batchError } = await supabase
          .from('visitas')
          .select('cliente_fone')
          .eq('bar_id', barIdNum)
          .lte('data_visita', dataAnteriorStr)
          .not('cliente_fone', 'is', null)
          .range(fromHistorico, fromHistorico + limit - 1);

        if (batchError) {
          console.error('❌ Erro ao buscar batch de histórico:', batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) {
          hasMoreHistorico = false;
        } else {
          historicoData = historicoData.concat(batch);
          fromHistorico += limit;
          hasMoreHistorico = batch.length === limit;
        }
      }

      const clientesHistoricos = new Set(
        (historicoData || []).map(row => (row.cliente_fone || '').toString().trim()).filter(Boolean)
      );

      // Contar novos clientes
      let novosClientes = 0;
      const clientesDoMes = new Set(
        (clientesTotaisData || []).map(row => (row.cliente_fone || '').toString().trim()).filter(Boolean)
      );

      clientesDoMes.forEach(cliente => {
        if (!clientesHistoricos.has(cliente)) {
          novosClientes++;
        }
      });

      // 4. CLIENTES RECORRENTES
      const clientesRecorrentes = clientesTotaisUnicos - novosClientes;

      // 5. CLIENTES ATIVOS (visitaram no dia + pelo menos 1x nos últimos 90 dias)
            
      const data90DiasAtras = new Date(data);
      data90DiasAtras.setDate(data90DiasAtras.getDate() - 90);
      const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0];
      
      let historicoRecenteData: any[] = [];
      let fromHistoricoRecente = 0;
      let hasMoreHistoricoRecente = true;

      while (hasMoreHistoricoRecente) {
        const { data: batch, error: batchError } = await supabase
          .from('visitas')
          .select('cliente_fone')
          .eq('bar_id', barIdNum)
          .gte('data_visita', data90DiasAtrasStr)
          .lt('data_visita', inicioData)
          .not('cliente_fone', 'is', null)
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

      const clientesHistoricoRecente = new Set(
        (historicoRecenteData || []).map(row => (row.cliente_fone || '').toString().trim()).filter(Boolean)
      );

      let clientesAtivos = 0;
      clientesDoMes.forEach(cliente => {
        if (clientesHistoricoRecente.has(cliente)) {
          clientesAtivos++;
        }
      });

      // 6. CALCULAR CMO
            const { data: cmoData, error: cmoError } = await supabase
        .from('nibo_agendamentos')
        .select('valor')
        .eq('bar_id', barIdNum)
        .gte('data_competencia', inicioData)
        .lte('data_competencia', fimData)
        .in('categoria_nome', [
          'SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE',
          'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA'
        ]);

      const cmoTotal = !cmoError && cmoData ? 
        cmoData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0) : 0;

      // 7. CALCULAR % ARTÍSTICA/FATURAMENTO
            const { data: artisticaData, error: artisticaError } = await supabase
        .from('nibo_agendamentos')
        .select('valor')
        .eq('bar_id', barIdNum)
        .gte('data_competencia', inicioData)
        .lte('data_competencia', fimData)
        .in('categoria_nome', ['ATRAÇÕES', 'PRODUÇÃO', 'MARKETING']);

      const custoArtistico = !artisticaError && artisticaData ? 
        artisticaData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0) : 0;
      
      const percentualArtistico = faturamentoTotal > 0 ? (custoArtistico / faturamentoTotal) * 100 : 0;

      // 8. CALCULAR TICKET MÉDIO
            const { data: pessoasContahub, error: pessoasError } = await supabase
        .from('visitas')
        .select('pessoas')
        .eq('bar_id', barIdNum)
        .gte('data_visita', inicioData)
        .lte('data_visita', fimData);

      const totalPessoas = !pessoasError && pessoasContahub ? 
        pessoasContahub.reduce((sum, item) => sum + (parseInt(item.pessoas) || 0), 0) : 0;
      
      const ticketMedio = totalPessoas > 0 ? faturamentoTotal / totalPessoas : 0;

      // 9. REPUTAÇÃO (placeholder)
      const reputacao = 0;

      // Calcular percentuais
      const percentualNovos = clientesTotaisUnicos > 0 ? (novosClientes / clientesTotaisUnicos) * 100 : 0;
      const percentualRecorrentes = clientesTotaisUnicos > 0 ? (clientesRecorrentes / clientesTotaisUnicos) * 100 : 0;
      const percentualAtivos = clientesTotaisUnicos > 0 ? (clientesAtivos / clientesTotaisUnicos) * 100 : 0;

      indicadoresPorSemana.push({
        data,
        diaSemana: NOMES_DIAS[diaSemanaNum],
        faturamentoTotal,
        clientesRecorrentes,
        clientesTotais: clientesTotaisUnicos,
        novosClientes,
        clientesAtivos,
        percentualNovos,
        percentualRecorrentes,
        percentualAtivos,
        cmoTotal,
        percentualArtistico,
        ticketMedio,
        totalPessoas,
        reputacao
      });

      
      // Parar quando tivermos 4 semanas com dados
      if (indicadoresPorSemana.length >= 4) {
        break;
      }
    }

    // Reverter para ordem crescente (mais antigo primeiro)
    indicadoresPorSemana.reverse();

    // Calcular variações entre as semanas
    const indicadoresComVariacao = indicadoresPorSemana.map((indicador, index) => {
      const semanaAnterior = index > 0 ? indicadoresPorSemana[index - 1] : null;
      
      const calcularVariacao = (atual: number, anterior: number) => {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return ((atual - anterior) / anterior) * 100;
      };

      return {
        ...indicador,
        variacoes: semanaAnterior ? {
          faturamento: calcularVariacao(indicador.faturamentoTotal, semanaAnterior.faturamentoTotal),
          clientesRecorrentes: calcularVariacao(indicador.clientesRecorrentes, semanaAnterior.clientesRecorrentes),
          clientesTotais: calcularVariacao(indicador.clientesTotais, semanaAnterior.clientesTotais),
          novosClientes: calcularVariacao(indicador.novosClientes, semanaAnterior.novosClientes),
          clientesAtivos: calcularVariacao(indicador.clientesAtivos, semanaAnterior.clientesAtivos),
          percentualNovos: calcularVariacao(indicador.percentualNovos, semanaAnterior.percentualNovos),
          percentualRecorrentes: calcularVariacao(indicador.percentualRecorrentes, semanaAnterior.percentualRecorrentes),
          percentualAtivos: calcularVariacao(indicador.percentualAtivos, semanaAnterior.percentualAtivos),
          cmoTotal: calcularVariacao(indicador.cmoTotal, semanaAnterior.cmoTotal),
          percentualArtistico: calcularVariacao(indicador.percentualArtistico, semanaAnterior.percentualArtistico),
          ticketMedio: calcularVariacao(indicador.ticketMedio, semanaAnterior.ticketMedio),
          reputacao: calcularVariacao(indicador.reputacao, semanaAnterior.reputacao)
        } : null
      };
    });

    const primeiraSemana = indicadoresComVariacao[0]?.data || 'N/A';
    const ultimaSemana = indicadoresComVariacao[indicadoresComVariacao.length - 1]?.data || 'N/A';

    return NextResponse.json({
      success: true,
      data: {
        semanas: indicadoresComVariacao,
        diaSelecionado: NOMES_DIAS[diaSemanaNum],
        periodo: `${primeiraSemana} - ${ultimaSemana}`,
        ultimaAtualizacao: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao calcular indicadores semanais:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
