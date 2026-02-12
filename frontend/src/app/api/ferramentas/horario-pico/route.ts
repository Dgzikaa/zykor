import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarMultiplasDatas, verificarBarAberto } from '@/lib/helpers/calendario-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HorarioPicoData {
  hora: number;
  faturamento: number;
  transacoes: number;
  faturamento_semana_passada: number;
  media_ultimas_4: number;
  recorde_faturamento: number;
}

export async function POST(request: NextRequest) {
  try {
    const { data_selecionada, bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!data_selecionada) {
      return NextResponse.json(
        { error: 'Data é obrigatória' },
        { status: 400 }
      );
    }

    // Calcular datas para comparações (corrigir timezone)
    const dataAtual = new Date(data_selecionada + 'T12:00:00'); // Forçar meio-dia para evitar problemas de timezone
    const diaSemana = dataAtual.getDay(); // 0=domingo, 1=segunda, etc.
    
    // Data da semana passada (mesmo dia da semana)
    const semanaPassada = new Date(dataAtual);
    semanaPassada.setDate(semanaPassada.getDate() - 7);
    
    // 1. Buscar faturamento por hora PRIMEIRO (para não bloquear quando contahub_analitico está atrasado)
    const { data: faturamentoDiaAtualPre, error: errorFaturamentoDiaPre } = await supabase
      .from('contahub_fatporhora')
      .select('hora, valor, qtd')
      .eq('vd_dtgerencial', data_selecionada)
      .eq('bar_id', bar_id)
      .gte('hora', 17)
      .lte('hora', 26);
    const temDadosFatPorHora = (faturamentoDiaAtualPre?.length || 0) > 0;

    // ⚠️ Só bloquear se bar fechado E não temos dados em fatporhora (sync atrasado)
    // Quando temos dados, sempre retornar - permite ver faturamento mesmo se calendário marcar fechado
    const statusDiaAtual = await verificarBarAberto(data_selecionada, bar_id);
    if (!statusDiaAtual.aberto && !temDadosFatPorHora) {
      // Estrutura vazia para o gráfico não quebrar (horario_pico obrigatório)
      const horariosVazios = [17,18,19,20,21,22,23,0,1,2,3].map(h => ({
        hora: h, faturamento: 0, transacoes: 0,
        faturamento_semana_passada: 0, media_ultimas_4: 0, recorde_faturamento: 0
      }));
      return NextResponse.json({
        success: true,
        bar_fechado: true,
        motivo: statusDiaAtual.motivo,
        data: {
          data_selecionada,
          data_analisada: data_selecionada,
          dia_semana: '',
          horario_pico: horariosVazios,
          estatisticas: {
            total_faturamento: 0, total_faturamento_semana_passada: 0, total_media_ultimas_4: 0,
            total_recorde: 0, total_recorde_real: 0, hora_pico_faturamento: null, max_faturamento: 0,
            total_pessoas_dia: 0, total_couvert: 0, total_pagamentos: 0, total_repique: 0,
            faturamento_total_calculado: 0, faturamento_bar: 0, total_produtos_vendidos: 0,
            produto_mais_vendido: null, produto_mais_vendido_qtd: 0, produto_mais_faturou: null, produto_mais_faturou_valor: 0,
            produtos_ranking: [], data_recorde: null,
            comparacao_semana_passada: 0, comparacao_media_ultimas_4: 0, comparacao_recorde: 0
          },
          mensagem: `Bar fechado em ${data_selecionada}: ${statusDiaAtual.motivo}`
        }
      });
    }

    // Últimas 4 ocorrências do mesmo dia da semana (buscar 8 para garantir 4 abertos)
    const ultimas8Datas = [] as string[];
    for (let i = 1; i <= 8; i++) {
      const data = new Date(dataAtual);
      data.setDate(data.getDate() - (7 * i));
      ultimas8Datas.push(data.toISOString().split('T')[0]);
    }
    
    // ⚡ FILTRAR DIAS FECHADOS
    const statusDias = await verificarMultiplasDatas(ultimas8Datas, bar_id);
    const ultimas4Datas = ultimas8Datas.filter(data => {
      const status = statusDias.get(data);
      return status?.aberto !== false;
    }).slice(0, 4); // Pegar apenas 4 dias abertos
    
    console.log(`📅 Comparando com ${ultimas4Datas.length} dias abertos:`, ultimas4Datas);

    // Horários de operação: 17:00 às 03:00
    const horariosOperacao = [] as number[];
    // 17:00 às 23:59
    for (let h = 17; h <= 23; h++) {
      horariosOperacao.push(h);
    }
    // 00:00 às 03:00
    for (let h = 0; h <= 3; h++) {
      horariosOperacao.push(h);
    }

    // 1. Buscar dados de faturamento por hora (contahub_fatporhora - dados oficiais)
    // Horários 17:00-23:00 do dia atual
    const { data: faturamentoDiaAtual, error: errorFaturamentoDia } = await supabase
      .from('contahub_fatporhora')
      .select('hora, valor, qtd')
      .eq('vd_dtgerencial', data_selecionada)
      .eq('bar_id', bar_id)
      .gte('hora', 17)
      .lte('hora', 23);

    // Horários 24h, 25h, 26h (que são 00h, 01h, 02h) do mesmo dia
    const { data: faturamentoMadrugada, error: errorFaturamentoMadrugada } = await supabase
      .from('contahub_fatporhora')
      .select('hora, valor, qtd')
      .eq('vd_dtgerencial', data_selecionada)
      .eq('bar_id', bar_id)
      .gte('hora', 24)
      .lte('hora', 26);

    // Combinar os dados e normalizar horários 24h+ para 0-2h
    const faturamentoPorHora = [
      ...(faturamentoDiaAtual || []),
      ...(faturamentoMadrugada || []).map(item => ({
        ...item,
        hora: item.hora - 24 // 24->0, 25->1, 26->2
      }))
    ];

    if (errorFaturamentoDia || errorFaturamentoMadrugada) {
      console.error('Erro ao buscar faturamento por hora:', errorFaturamentoDia || errorFaturamentoMadrugada);
    }

    // 2. Buscar dados do período (pessoas + couvert + pagamentos + repique) - EVITAR DUPLICATAS
    const { data: dadosPeriodoRaw, error: errorPeriodo } = await supabase
      .from('contahub_periodo')
      .select('vd_mesadesc, pessoas, vr_couvert, vr_pagamentos, vr_repique')
      .eq('dt_gerencial', data_selecionada)
      .eq('bar_id', bar_id);

    if (errorPeriodo) {
      console.error('Erro ao buscar dados do período:', errorPeriodo);
    }

    // Remover duplicatas agrupando por vd_mesadesc (mesa) e somando apenas uma vez cada mesa
    const mesasUnicas = new Map();
    dadosPeriodoRaw?.forEach(item => {
      const mesa = item.vd_mesadesc;
      if (!mesasUnicas.has(mesa)) {
        mesasUnicas.set(mesa, {
          pessoas: parseFloat(item.pessoas) || 0,
          vr_couvert: parseFloat(item.vr_couvert) || 0,
          vr_pagamentos: parseFloat(item.vr_pagamentos) || 0,
          vr_repique: parseFloat(item.vr_repique) || 0
        });
      }
    });

    const dadosPeriodo = Array.from(mesasUnicas.values());

    const totalPessoasDia = dadosPeriodo.reduce((sum, item) => sum + item.pessoas, 0);
    const totalCouvert = dadosPeriodo.reduce((sum, item) => sum + item.vr_couvert, 0);
    const totalPagamentos = dadosPeriodo.reduce((sum, item) => sum + item.vr_pagamentos, 0);
    const totalRepique = dadosPeriodo.reduce((sum, item) => sum + item.vr_repique, 0);
    
    // 🔧 CORREÇÃO: Usar vr_pagamentos do contahub_periodo (que JÁ É O TOTAL)
    // Não usar contahub_pagamentos para evitar diferenças de processamento
    const faturamentoTotalDia = totalPagamentos; // vr_pagamentos já é o total correto
    
    console.log(`🔧 CORREÇÃO HORÁRIO PICO ${data_selecionada}:`, {
      vr_pagamentos_TOTAL: `R$ ${totalPagamentos.toLocaleString('pt-BR')}`,
      vr_couvert: `R$ ${totalCouvert.toLocaleString('pt-BR')}`,
      vr_repique: `R$ ${totalRepique.toLocaleString('pt-BR')}`,
      observacao: 'Usando apenas vr_pagamentos (sem duplicação)'
    });
    
    // Faturamento do bar = total do dia - couvert (produtos/bebidas)
    const faturamentoBar = Math.max(0, faturamentoTotalDia - totalCouvert);

    // 3. Buscar dados da semana passada (17-23h + 24-26h)
    const semanaPassadaStr = semanaPassada.toISOString().split('T')[0];
    const { data: faturamentoSemanaPassadaDia } = await supabase
      .from('contahub_fatporhora')
      .select('hora, valor, qtd')
      .eq('vd_dtgerencial', semanaPassadaStr)
      .eq('bar_id', bar_id)
      .gte('hora', 17)
      .lte('hora', 26);

    // Normalizar horários 24h+ da semana passada
    const faturamentoSemanaPassada = faturamentoSemanaPassadaDia?.map(item => ({
      ...item,
      hora: item.hora > 23 ? item.hora - 24 : item.hora
    })) || [];

    // 4. Buscar dados das últimas 4 semanas (17-23h + 24-26h)
    const { data: faturamentoUltimas4Raw } = await supabase
      .from('contahub_fatporhora')
      .select('hora, valor, qtd, vd_dtgerencial')
      .in('vd_dtgerencial', ultimas4Datas)
      .eq('bar_id', bar_id)
      .gte('hora', 17)
      .lte('hora', 26);

    // Normalizar horários 24h+ das últimas 4 semanas
    const faturamentoUltimas4 = faturamentoUltimas4Raw?.map(item => ({
      ...item,
      hora: item.hora > 23 ? item.hora - 24 : item.hora
    })) || [];

    // 5. Buscar recorde de faturamento para o mesmo dia da semana
    // Buscar TODOS os dados do mesmo dia da semana (COM PAGINAÇÃO)
    let todosFaturamentos: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error } = await supabase
        .from('contahub_fatporhora')
        .select('hora, valor, qtd, vd_dtgerencial')
        .eq('bar_id', bar_id)
        .gte('hora', 17)
        .lte('hora', 26)
        .order('vd_dtgerencial', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Erro ao buscar dados paginados:', error);
        break;
      }

      if (pageData && pageData.length > 0) {
        todosFaturamentos = [...todosFaturamentos, ...pageData];
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }


    // Filtrar apenas o mesmo dia da semana para encontrar o recorde
    const faturamentosRecorde = todosFaturamentos?.filter(f => {
      const dataFat = new Date(f.vd_dtgerencial + 'T12:00:00');
      return dataFat.getDay() === diaSemana;
    }) || [];

    // Agrupar por data e calcular faturamento total por dia da semana
    const faturamentoPorDia: { [data: string]: number } = {};
    faturamentosRecorde.forEach(f => {
      if (!faturamentoPorDia[f.vd_dtgerencial]) {
        faturamentoPorDia[f.vd_dtgerencial] = 0;
      }
      faturamentoPorDia[f.vd_dtgerencial] += parseFloat(f.valor);
    });

    // Encontrar a data com maior faturamento
    const dataRecorde = Object.keys(faturamentoPorDia).length > 0 
      ? Object.keys(faturamentoPorDia).reduce((a, b) => 
          faturamentoPorDia[a] > faturamentoPorDia[b] ? a : b
        )
      : null;


    // Buscar dados detalhados do dia recorde e normalizar horários
    const faturamentosRecordeDetalhado = dataRecorde 
      ? faturamentosRecorde
          .filter(f => f.vd_dtgerencial === dataRecorde)
          .map(item => ({
            ...item,
            hora: item.hora > 23 ? item.hora - 24 : item.hora
          }))
      : [];

    // 6. Dados de presença já calculados acima junto com faturamento

    // 7. Calcular médias das últimas 4 semanas por hora
    // Primeiro, calcular o total por data das últimas 4 semanas
    const faturamentoPorDataUltimas4: { [data: string]: number } = {};
    faturamentoUltimas4?.forEach(f => {
      if (!faturamentoPorDataUltimas4[f.vd_dtgerencial]) {
        faturamentoPorDataUltimas4[f.vd_dtgerencial] = 0;
      }
      faturamentoPorDataUltimas4[f.vd_dtgerencial] += parseFloat(f.valor);
    });

    // Calcular a média total das 4 semanas
    const valoresUltimas4 = Object.values(faturamentoPorDataUltimas4);
    const mediaTotal4Semanas = valoresUltimas4.length > 0 ? 
      valoresUltimas4.reduce((sum, val) => sum + val, 0) / valoresUltimas4.length : 0;


    // Agora calcular a proporção por hora baseada na média total
    const mediaUltimas4PorHora: { [hora: number]: number } = {};
    horariosOperacao.forEach(hora => {
      const valoresHora = faturamentoUltimas4?.filter(f => f.hora === hora) || [];
      const somaHora = valoresHora.reduce((sum, f) => sum + parseFloat(f.valor), 0);
      const totalGeralUltimas4 = faturamentoUltimas4?.reduce((sum, f) => sum + parseFloat(f.valor), 0) || 1;
      const proporcaoHora = totalGeralUltimas4 > 0 ? somaHora / totalGeralUltimas4 : 0;
      mediaUltimas4PorHora[hora] = mediaTotal4Semanas * proporcaoHora;
    });

    // 8. Calcular recorde por hora (usando dados do dia recorde)
    const recordePorHora: { [hora: number]: number } = {};
    horariosOperacao.forEach(hora => {
      const valorHora = faturamentosRecordeDetalhado.find(f => f.hora === hora);
      recordePorHora[hora] = valorHora ? parseFloat(valorHora.valor) : 0;
    });

    // 9. Combinar todos os dados
    const dadosHorarioPico: HorarioPicoData[] = [];
    
    horariosOperacao.forEach(hora => {
      const faturamentoHora = faturamentoPorHora?.find(f => f.hora === hora);
      const faturamentoSemPassada = faturamentoSemanaPassada?.find(f => f.hora === hora);
      
      dadosHorarioPico.push({
        hora,
        faturamento: faturamentoHora ? parseFloat(faturamentoHora.valor) : 0,
        transacoes: faturamentoHora ? parseFloat(faturamentoHora.qtd) : 0,
        faturamento_semana_passada: faturamentoSemPassada ? parseFloat(faturamentoSemPassada.valor) : 0,
        media_ultimas_4: mediaUltimas4PorHora[hora] || 0,
        recorde_faturamento: recordePorHora[hora] || 0
      });
    });

    // 10. Calcular estatísticas
    const totalFaturamento = dadosHorarioPico.reduce((sum, h) => sum + h.faturamento, 0);
    const totalFaturamentoSemanaPassada = dadosHorarioPico.reduce((sum, h) => sum + h.faturamento_semana_passada, 0);
    const totalMediaUltimas4 = dadosHorarioPico.reduce((sum, h) => sum + h.media_ultimas_4, 0);
    
    // CORREÇÃO: Buscar o total REAL do dia recorde (contahub_pagamentos - não fatporhora)
    let totalRecordeReal = 0;
    if (dataRecorde) {
      const { data: pagamentosRecorde } = await supabase
        .from('contahub_pagamentos')
        .select('liquido')
        .eq('dt_gerencial', dataRecorde)
        .eq('bar_id', bar_id);
      
      totalRecordeReal = pagamentosRecorde?.reduce((sum, item) => sum + (parseFloat(item.liquido) || 0), 0) || 0;
    }
    
    const totalRecorde = dadosHorarioPico.reduce((sum, h) => sum + h.recorde_faturamento, 0); // Para o gráfico (produtos por hora)
    const totalProdutosVendidos = dadosHorarioPico.reduce((sum, h) => sum + h.transacoes, 0);
    
    
    const maxFaturamento = Math.max(...dadosHorarioPico.map(h => h.faturamento));
    const horaPicoFaturamento = dadosHorarioPico.find(h => h.faturamento === maxFaturamento)?.hora;

    // 11. Buscar produto mais vendido do dia (agrupando por produto e somando todas as horas)
    // Primeiro tentar contahub_prodporhora
    const { data: produtoMaisVendidoRaw } = await supabase
      .from('contahub_prodporhora')
      .select('produto_descricao, quantidade, valor_total')
      .eq('data_gerencial', data_selecionada)
      .eq('bar_id', bar_id);

    // Agrupar por produto e somar quantidades
    const produtosPorQuantidade: { [key: string]: { quantidade: number, valor: number } } = {};
    
    if (produtoMaisVendidoRaw && produtoMaisVendidoRaw.length > 0) {
      // Usar dados do prodporhora se disponível
      produtoMaisVendidoRaw.forEach(item => {
        const produto = item.produto_descricao;
        if (!produtosPorQuantidade[produto]) {
          produtosPorQuantidade[produto] = { quantidade: 0, valor: 0 };
        }
        produtosPorQuantidade[produto].quantidade += parseFloat(item.quantidade);
        produtosPorQuantidade[produto].valor += parseFloat(item.valor_total);
      });
    } else {
      // Fallback: usar dados do contahub_analitico
      // Excluir categorias que são compras/estoque, não vendas
      console.log('📊 Usando contahub_analitico para produtos (prodporhora vazio)');
      const { data: produtosAnalitico } = await supabase
        .from('contahub_analitico')
        .select('prd_desc, qtd, valorfinal, grp_desc')
        .eq('trn_dtgerencial', data_selecionada)
        .eq('bar_id', bar_id)
        .not('grp_desc', 'in', '("Mercadorias- Compras","Insumos","Uso Interno")');

      produtosAnalitico?.forEach(item => {
        const produto = item.prd_desc;
        if (!produtosPorQuantidade[produto]) {
          produtosPorQuantidade[produto] = { quantidade: 0, valor: 0 };
        }
        produtosPorQuantidade[produto].quantidade += parseFloat(item.qtd) || 0;
        produtosPorQuantidade[produto].valor += parseFloat(item.valorfinal) || 0;
      });
    }

    // Encontrar produto mais vendido
    const produtoMaisVendido = Object.keys(produtosPorQuantidade).length > 0 
      ? Object.keys(produtosPorQuantidade).reduce((a, b) => 
          produtosPorQuantidade[a].quantidade > produtosPorQuantidade[b].quantidade ? a : b
        )
      : null;

    // 12. Encontrar produto que mais faturou
    const produtoMaisFaturou = Object.keys(produtosPorQuantidade).length > 0
      ? Object.keys(produtosPorQuantidade).reduce((a, b) => 
          produtosPorQuantidade[a].valor > produtosPorQuantidade[b].valor ? a : b
        )
      : null;

    // Calcular nome do dia da semana
    const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const nomeDiaSemana = nomesDias[diaSemana];

    return NextResponse.json({
      success: true,
      data: {
        data_analisada: data_selecionada,
        dia_semana: nomeDiaSemana,
        horario_pico: dadosHorarioPico,
        estatisticas: {
          total_faturamento: totalFaturamento,
          total_faturamento_semana_passada: totalFaturamentoSemanaPassada,
          total_media_ultimas_4: totalMediaUltimas4,
          total_recorde: totalRecorde,
          hora_pico_faturamento: horaPicoFaturamento,
          max_faturamento: maxFaturamento,
          total_pessoas_dia: totalPessoasDia,
          total_couvert: totalCouvert,
          total_pagamentos: totalPagamentos,
          total_repique: totalRepique,
          faturamento_total_calculado: faturamentoTotalDia,
          faturamento_bar: faturamentoBar,
          total_produtos_vendidos: totalProdutosVendidos,
          produto_mais_vendido: produtoMaisVendido,
          produto_mais_vendido_qtd: produtoMaisVendido ? produtosPorQuantidade[produtoMaisVendido].quantidade : 0,
          produto_mais_faturou: produtoMaisFaturou,
          produto_mais_faturou_valor: produtoMaisFaturou ? produtosPorQuantidade[produtoMaisFaturou].valor : 0,
          produtos_ranking: Object.keys(produtosPorQuantidade)
            .map(produto => ({
              produto: produto,
              quantidade: produtosPorQuantidade[produto].quantidade,
              valor: produtosPorQuantidade[produto].valor
            }))
            .sort((a, b) => b.quantidade - a.quantidade),
          data_recorde: dataRecorde,
          total_recorde_real: totalRecordeReal, // Valor real do recorde para comparação
          comparacao_semana_passada: totalFaturamento - totalFaturamentoSemanaPassada,
          comparacao_media_ultimas_4: totalFaturamento - totalMediaUltimas4,
          comparacao_recorde: faturamentoTotalDia - totalRecordeReal // Usar valores reais (vr_pagamentos) para comparação
        }
      }
    });

  } catch (error) {
    console.error('Erro na API de horário de pico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}