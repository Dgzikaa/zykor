import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Interfaces para tipagem correta dos dados
interface TempoItem {
  prd_desc: string;
  grp_desc: string;
  loc_desc: string;
  t0_lancamento: string | null;
  t1_prodini: string | null;
  t2_prodfim: string | null;
  t3_entrega: string | null;
  t0_t1: number | null;
  t0_t2: number | null;
  t0_t3: number | null;
  t1_t2: number | null;
  t1_t3: number | null;
  t2_t3: number | null;
  itm_qtd: number;
  dia?: number;
}

interface ProdutoAnalise {
  produto: string;
  grupo: string;
  tipo: string;
  tempo_usado: string;
  tempos_periodo: number[];
  tempos_dia: number[];
  pedidos_periodo: number;
  pedidos_dia: number;
}

interface AnaliseTempo {
  tempo: number;
  tempoValido: boolean;
  tipo: string;
  tempoUsado: string;
  dadosCompletos: boolean;
  motivoIncompleto: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dataEspecifica = searchParams.get('data_especifica');
    const periodoAnalise = searchParams.get('periodo_analise') || '30';
    const grupoFiltro = searchParams.get('grupo_filtro') || 'todos';
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    if (!dataEspecifica) {
      return NextResponse.json(
        { error: 'Data específica é obrigatória' },
        { status: 400 }
      );
    }

    console.log(
      `🔍 Analisando tempos para ${dataEspecifica}, período: ${periodoAnalise} dias, grupo: ${grupoFiltro}, bar: ${barId}`
    );

    // Calcular data de início do período de comparação
    const dataFim = new Date(dataEspecifica);
    const dataInicio = new Date(dataFim);

    if (periodoAnalise === 'todos') {
      dataInicio.setFullYear(2025, 0, 1); // Desde 01/01/2025
    } else {
      dataInicio.setDate(dataFim.getDate() - parseInt(periodoAnalise));
    }

    console.log(
      `📅 Período de análise: ${dataInicio.toISOString().split('T')[0]} até ${dataFim.toISOString().split('T')[0]}`
    );

    // Query base para buscar dados de tempo - AGORA COM TODOS OS CAMPOS NECESSÁRIOS
    const query = supabase
      .from('tempo')
      .select(
        `
        prd_desc,
        grp_desc,
        loc_desc,
        t0_lancamento,
        t1_prodini,
        t2_prodfim,
        t3_entrega,
        t0_t1,
        t0_t2,
        t0_t3,
        t1_t2,
        t1_t3,
        t2_t3,
        itm_qtd
      `
      )
      .eq('bar_id', barId)
      .not('prd_desc', 'is', null);

    // Aplicar filtro de grupo se especificado
    // if (grupoFiltro !== 'todos') {
    //   queryBase = queryBase.eq('grp_desc', grupoFiltro);
    // }

    // Buscar dados do período de comparação usando campo 'dia' - COM PAGINAÇÃO
    const diaInicioInt = parseInt(
      dataInicio.toISOString().split('T')[0].replace(/-/g, '')
    );
    const diaFimInt = parseInt(
      dataFim.toISOString().split('T')[0].replace(/-/g, '')
    );

    console.log(
      `📅 Buscando período de comparação: ${diaInicioInt} até ${diaFimInt}`
    );

    // Buscar dados do período com paginação
    let dadosPeriodo: TempoItem[] = [];
    let pagina = 0;
    const tamanhoPagina = 1000;

    let hasMoreData = true;
    while (hasMoreData) {
      const inicio = pagina * tamanhoPagina;
      const fim = inicio + tamanhoPagina - 1;

      const { data: dadosPagina, error: errorPagina } = await supabase
        .from('tempo')
        .select(
          `
          prd_desc,
          grp_desc,
          loc_desc,
          t0_lancamento,
          t1_prodini,
          t2_prodfim,
          t3_entrega,
          t0_t1,
          t0_t2,
          t0_t3,
          t1_t2,
          t1_t3,
          t2_t3,
          itm_qtd,
          dia
        `
        )
        .eq('bar_id', barId)
        .gte('dia', diaInicioInt)
        .lte('dia', diaFimInt)
        .not('prd_desc', 'is', null)
        .range(inicio, fim);

      if (errorPagina) {
        console.error('❌ Erro ao buscar dados do período:', errorPagina);
        return NextResponse.json(
          { error: 'Erro ao buscar dados do período' },
          { status: 500 }
        );
      }

      if (!dadosPagina || dadosPagina.length === 0) {
        hasMoreData = false;
        break;
      }

      dadosPeriodo = [...dadosPeriodo, ...(dadosPagina as any)];
      console.log(
        `📄 Página ${pagina + 1}: ${dadosPagina.length} registros (Total: ${dadosPeriodo.length})`
      );

      if (dadosPagina.length < tamanhoPagina) {
        hasMoreData = false;
      } else {
        pagina++;
      }
    }

    console.log(`📊 Total de registros do período: ${dadosPeriodo.length}`);

    // Buscar dados do dia específico - USANDO CAMPO 'dia' (YYYYMMDD)
    console.log(`🔍 Buscando dados para o dia: ${dataEspecifica}`);

    // Converter data para formato YYYYMMDD
    const diaEspecificoInt = parseInt(dataEspecifica.replace(/-/g, '')); // 2025-06-13 -> 20250613

    console.log(`📅 Convertendo data: ${dataEspecifica} → ${diaEspecificoInt}`);

    // Buscar dados do dia específico usando campo 'dia' - COM PAGINAÇÃO
    let dadosDia: TempoItem[] = [];
    pagina = 0;

    let hasMoreDataDia = true;
    while (hasMoreDataDia) {
      const inicio = pagina * tamanhoPagina;
      const fim = inicio + tamanhoPagina - 1;

      const { data: dadosPagina, error: errorPagina } = await supabase
        .from('tempo')
        .select(
          `
          prd_desc,
          grp_desc,
          loc_desc,
          t0_lancamento,
          t1_prodini,
          t2_prodfim,
          t3_entrega,
          t0_t1,
          t0_t2,
          t0_t3,
          t1_t2,
          t1_t3,
          t2_t3,
          itm_qtd,
          dia
        `
        )
        .eq('bar_id', barId)
        .eq('dia', diaEspecificoInt.toString())
        .not('prd_desc', 'is', null)
        .range(inicio, fim);

      if (errorPagina) {
        console.error('❌ Erro ao buscar dados do dia:', errorPagina);
        return NextResponse.json(
          { error: 'Erro ao buscar dados do dia' },
          { status: 500 }
        );
      }

      if (!dadosPagina || dadosPagina.length === 0) {
        hasMoreDataDia = false;
        break;
      }

      dadosDia = [...dadosDia, ...(dadosPagina as any)];
      console.log(
        `📄 Dia - Página ${pagina + 1}: ${dadosPagina.length} registros (Total: ${dadosDia.length})`
      );

      if (dadosPagina.length < tamanhoPagina) {
        hasMoreDataDia = false;
      } else {
        pagina++;
      }
    }

    console.log(
      `📊 Dados encontrados - Período: ${dadosPeriodo?.length || 0}, Dia específico: ${dadosDia?.length || 0}`
    );

    // Log de debug dos primeiros registros do dia
    if (dadosDia && dadosDia.length > 0) {
      console.log(
        `📋 Primeiros registros do dia:`,
        dadosDia.slice(0, 3).map((item: TempoItem) => ({
          produto: item.prd_desc,
          grupo: item.grp_desc,
          dia: item.dia,
          t0_lancamento: item.t0_lancamento,
          t1_t2: item.t1_t2,
          t0_t3: item.t0_t3,
        }))
      );
    }

    // Função para determinar se é bebida ou comida e calcular tempo correto
    const calcularTempo = (item: TempoItem): AnaliseTempo => {
      const grupo = (item.grp_desc || '').toLowerCase();
      const localizacao = (item.loc_desc || '').toLowerCase();

      // Determinar tipo baseado no grupo e localização
      const isBebida =
        grupo.includes('cerveja') ||
        grupo.includes('drink') ||
        grupo.includes('dose') ||
        grupo.includes('bebida') ||
        grupo.includes('balde') ||
        grupo.includes('combo') ||
        localizacao.includes('bar') ||
        grupo === '';

      const isComida =
        grupo.includes('prato') ||
        grupo.includes('comida') ||
        grupo.includes('lanche') ||
        grupo.includes('petisco') ||
        grupo.includes('entrada') ||
        localizacao.includes('cozinha');

      let tempo = 0;
      let tempoValido = false;
      let tipo = 'indefinido';
      let tempoUsado = '';
      let dadosCompletos = false;
      let motivoIncompleto = '';

      // Deboche (bar_id 4): usar t0_t2 para tudo
      const isDeboche = barId === 4;

      if (isDeboche) {
        // Deboche: usar t0_t2 (lançamento até fim produção) para tudo
        if (isBebida) {
          tipo = 'bebida';
        } else if (isComida) {
          tipo = 'comida';
        }

        if (item.t0_t2 && item.t0_t2 > 0) {
          tempo = item.t0_t2;
          tempoValido = tempo >= 30 && tempo <= 2700; // 0.5 a 45 minutos
          tempoUsado = 't0-t2';
          dadosCompletos = !!(item.t0_lancamento && item.t2_prodfim);
          if (!dadosCompletos) {
            motivoIncompleto = !item.t0_lancamento ? 'sem_t0' : 'sem_t2';
          }
        } else {
          motivoIncompleto = 'sem_calculo_t0_t2';
        }
      } else {
        // Ordinário: lógica original
        if (isBebida) {
          tipo = 'bebida';
          // Para bebidas: t0-t3 (lançamento até entrega)
          if (item.t0_t3 && item.t0_t3 > 0) {
            tempo = item.t0_t3;
            tempoValido = tempo >= 30 && tempo <= 1200; // 0.5 a 20 minutos
            tempoUsado = 't0-t3';
            dadosCompletos = !!(item.t0_lancamento && item.t3_entrega);
            if (!dadosCompletos) {
              motivoIncompleto = !item.t0_lancamento ? 'sem_t0' : 'sem_t3';
            }
          } else {
            motivoIncompleto = 'sem_calculo_t0_t3';
          }
        } else if (isComida) {
          tipo = 'comida';
          // Para comidas: t1-t2 (início produção até fim produção)
          if (item.t1_t2 && item.t1_t2 > 0) {
            tempo = item.t1_t2;
            tempoValido = tempo >= 60 && tempo <= 2700; // 1 a 45 minutos
            tempoUsado = 't1-t2';
            dadosCompletos = !!(item.t1_prodini && item.t2_prodfim);
            if (!dadosCompletos) {
              motivoIncompleto = !item.t1_prodini ? 'sem_t1' : 'sem_t2';
            }
          } else {
            motivoIncompleto = 'sem_calculo_t1_t2';
          }
        } else {
          // Produto indefinido - tentar t1_t2 como fallback
          tipo = 'indefinido';
          if (item.t1_t2 && item.t1_t2 > 0) {
            tempo = item.t1_t2;
            tempoValido = tempo >= 30 && tempo <= 3600; // 0.5 a 60 minutos
            tempoUsado = 't1-t2 (fallback)';
            dadosCompletos = !!(item.t1_prodini && item.t2_prodfim);
            if (!dadosCompletos) {
              motivoIncompleto = !item.t1_prodini ? 'sem_t1' : 'sem_t2';
            }
          } else {
            motivoIncompleto = 'sem_dados_tempo';
          }
        }
      }

      return {
        tempo,
        tempoValido,
        tipo,
        tempoUsado,
        dadosCompletos,
        motivoIncompleto,
      };
    };

    // Se não há dados para o dia específico, buscar dados dos últimos 7 dias para mostrar algo útil
    let dadosRecentes = dadosDia;
    let usandoDadosRecentes = false;

    if (!dadosDia || dadosDia.length === 0) {
      console.log(
        `⚠️ Nenhum dado encontrado para o dia ${dataEspecifica}. Buscando últimos 7 dias...`
      );

      // Calcular range dos últimos 7 dias em formato YYYYMMDD
      const dataFimObj = new Date(dataEspecifica);
      const dataInicioObj = new Date(dataFimObj);
      dataInicioObj.setDate(dataFimObj.getDate() - 7);

      const diaFimInt = parseInt(dataEspecifica.replace(/-/g, ''));
      const diaInicioInt = parseInt(
        dataInicioObj.toISOString().split('T')[0].replace(/-/g, '')
      );

      console.log(`📅 Buscando dados de ${diaInicioInt} até ${diaFimInt}`);

      // Buscar últimos 7 dias com paginação
      let dadosUltimos7Dias: TempoItem[] = [];
      let paginaRecente = 0;

      let hasMoreDataRecente = true;
      while (hasMoreDataRecente) {
        const inicio = paginaRecente * tamanhoPagina;
        const fim = inicio + tamanhoPagina - 1;

        const { data: dadosPagina } = await supabase
          .from('tempo')
          .select(
            `
            prd_desc,
            grp_desc,
            loc_desc,
            t0_lancamento,
            t1_prodini,
            t2_prodfim,
            t3_entrega,
            t0_t1,
            t0_t2,
            t0_t3,
            t1_t2,
            t1_t3,
            t2_t3,
            itm_qtd,
            dia
          `
          )
          .eq('bar_id', barId)
          .gte('dia', diaInicioInt)
          .lte('dia', diaFimInt)
          .not('prd_desc', 'is', null)
          .range(inicio, fim);

        if (!dadosPagina || dadosPagina.length === 0) {
          hasMoreDataRecente = false;
          break;
        }

        dadosUltimos7Dias = [...dadosUltimos7Dias, ...(dadosPagina as any)];
        console.log(
          `📄 Últimos 7 dias - Página ${paginaRecente + 1}: ${dadosPagina.length} registros (Total: ${dadosUltimos7Dias.length})`
        );

        if (dadosPagina.length < tamanhoPagina) {
          hasMoreDataRecente = false;
        } else {
          paginaRecente++;
        }
      }

      dadosRecentes = dadosUltimos7Dias;
      usandoDadosRecentes = true;
      console.log(
        `📊 Usando dados dos últimos 7 dias como referência: ${dadosRecentes.length} registros`
      );
    }

    // Métricas de qualidade dos dados
    const metricas = {
      bebidas: {
        total: 0,
        completas: 0,
        sem_t0: 0,
        sem_t3: 0,
        sem_calculo: 0,
        outliers: 0,
      },
      comidas: {
        total: 0,
        completas: 0,
        sem_t1: 0,
        sem_t2: 0,
        sem_calculo: 0,
        outliers: 0,
      },
      indefinidos: {
        total: 0,
        com_dados: 0,
        sem_dados: 0,
      },
    };

    // Processar dados por produto
    const produtosMap = new Map<string, ProdutoAnalise>();

    // Função para processar um conjunto de dados
    const processarDados = (dados: TempoItem[], isPeriodo: boolean) => {
      dados?.forEach((item: TempoItem) => {
        const key = `${item.prd_desc}_${item.grp_desc}`;
        const analise = calcularTempo(item);

        // Atualizar métricas
        if (analise.tipo === 'bebida') {
          metricas.bebidas.total++;
          if (analise.dadosCompletos) metricas.bebidas.completas++;
          if (analise.motivoIncompleto === 'sem_t0') metricas.bebidas.sem_t0++;
          if (analise.motivoIncompleto === 'sem_t3') metricas.bebidas.sem_t3++;
          if (analise.motivoIncompleto === 'sem_calculo_t0_t3')
            metricas.bebidas.sem_calculo++;
          if (analise.tempo > 0 && !analise.tempoValido)
            metricas.bebidas.outliers++;
        } else if (analise.tipo === 'comida') {
          metricas.comidas.total++;
          if (analise.dadosCompletos) metricas.comidas.completas++;
          if (analise.motivoIncompleto === 'sem_t1') metricas.comidas.sem_t1++;
          if (analise.motivoIncompleto === 'sem_t2') metricas.comidas.sem_t2++;
          if (analise.motivoIncompleto === 'sem_calculo_t1_t2')
            metricas.comidas.sem_calculo++;
          if (analise.tempo > 0 && !analise.tempoValido)
            metricas.comidas.outliers++;
        } else {
          metricas.indefinidos.total++;
          if (analise.tempo > 0) metricas.indefinidos.com_dados++;
          else metricas.indefinidos.sem_dados++;
        }

        // Só processar se o tempo é válido
        if (!analise.tempoValido || analise.tempo <= 0) return;

        if (!produtosMap.has(key)) {
          produtosMap.set(key, {
            produto: item.prd_desc,
            grupo: item.grp_desc,
            tipo: analise.tipo,
            tempo_usado: analise.tempoUsado,
            tempos_periodo: [],
            tempos_dia: [],
            pedidos_periodo: 0,
            pedidos_dia: 0,
          });
        }

        const produto = produtosMap.get(key);
        if (produto) {
          if (isPeriodo) {
            produto.tempos_periodo.push(analise.tempo);
            produto.pedidos_periodo += item.itm_qtd || 1;
          } else {
            produto.tempos_dia.push(analise.tempo);
            produto.pedidos_dia += item.itm_qtd || 1;
          }
        }
      });
    };

    // Processar dados do período e do dia
    processarDados(dadosPeriodo, true);
    processarDados(dadosRecentes, false);

    console.log(`📊 Métricas de qualidade dos dados:`, metricas);

    // Calcular estatísticas e detectar outliers
    const produtos = Array.from(produtosMap.values()).map(
      (produto: ProdutoAnalise) => {
        // Tempo médio do período (excluindo o dia específico para comparação justa)
        let temposPeriodoSemDia = produto.tempos_periodo;

        // Se estamos usando dados do dia específico, remover esses dados do período para comparação
        if (!usandoDadosRecentes && dadosDia && dadosDia.length > 0) {
          // Filtrar dados do período que não sejam do dia específico
          const dadosPeriodoSemDia =
            dadosPeriodo?.filter((item: TempoItem) => {
              return item.dia !== diaEspecificoInt;
            }) || [];

          // Recalcular tempos do período sem o dia específico
          const temposProdutoPeriodo: number[] = [];
          dadosPeriodoSemDia.forEach((item: TempoItem) => {
            if (
              `${item.prd_desc}_${item.grp_desc}` ===
              `${produto.produto}_${produto.grupo}`
            ) {
              const analise = calcularTempo(item);
              if (analise.tempoValido && analise.tempo > 0) {
                temposProdutoPeriodo.push(analise.tempo);
              }
            }
          });

          temposPeriodoSemDia = temposProdutoPeriodo;
        }

        const tempoMedioGeral =
          temposPeriodoSemDia.length > 0
            ? temposPeriodoSemDia.reduce((a: number, b: number) => a + b, 0) /
              temposPeriodoSemDia.length
            : 0;

        const tempoDiaEspecifico =
          produto.tempos_dia.length > 0
            ? produto.tempos_dia.reduce((a: number, b: number) => a + b, 0) /
              produto.tempos_dia.length
            : 0;

        // Calcular variação percentual
        const variacaoPercentual =
          tempoMedioGeral > 0
            ? ((tempoDiaEspecifico - tempoMedioGeral) / tempoMedioGeral) * 100
            : 0;

        // Determinar status baseado na variação
        let status = 'normal';
        if (Math.abs(variacaoPercentual) > 50) {
          status = 'muito_alto';
        } else if (Math.abs(variacaoPercentual) > 25) {
          status = 'alto';
        } else if (variacaoPercentual < -15) {
          status = 'baixo';
        }

        // Calcular desvio padrão para detectar outliers
        const temposValidos = temposPeriodoSemDia.filter((t: number) => t > 0);
        let desvio = 0;
        if (temposValidos.length > 1) {
          const media =
            temposValidos.reduce((a: number, b: number) => a + b, 0) /
            temposValidos.length;
          const variancia =
            temposValidos.reduce(
              (acc: number, tempo: number) => acc + Math.pow(tempo - media, 2),
              0
            ) / temposValidos.length;
          desvio = Math.sqrt(variancia);
        }

        return {
          produto: produto.produto,
          grupo: produto.grupo,
          tipo: produto.tipo,
          tempo_usado: produto.tempo_usado,
          tempo_medio_geral: Math.round(tempoMedioGeral),
          tempo_medio_30dias: Math.round(tempoMedioGeral), // Mantendo compatibilidade
          tempo_dia_especifico: Math.round(tempoDiaEspecifico),
          variacao_percentual: Math.round(variacaoPercentual * 10) / 10,
          total_pedidos: produto.pedidos_periodo,
          pedidos_30dias: produto.pedidos_periodo, // Mantendo compatibilidade
          pedidos_dia: produto.pedidos_dia,
          desvio_padrao: Math.round(desvio),
          status,
        };
      }
    );

    // Filtrar APENAS produtos que têm dados NO DIA ESPECÍFICO (não mostrar "Sem dados")
    const produtosFiltrados = produtos.filter(
      p => p.pedidos_dia > 0 && p.tempo_dia_especifico > 0
    );

    // Ordenar: 1º casos GRAVES (variações positivas altas), 2º casos BONS (variações negativas), 3º normais
    produtosFiltrados.sort((a, b) => {
      const variacaoA = a.variacao_percentual;
      const variacaoB = b.variacao_percentual;

      // Categorizar produtos
      const graveA = variacaoA > 50; // Casos graves: >50% (ex: +200%)
      const graveB = variacaoB > 50;

      const problemaA = variacaoA > 25 && variacaoA <= 50; // Problemas moderados: 25-50%
      const problemaB = variacaoB > 25 && variacaoB <= 50;

      const bomA = variacaoA < -15; // Casos bons: <-15% (ex: -70%)
      const bomB = variacaoB < -15;

      // 1º PRIORIDADE: Casos GRAVES (variações positivas muito altas)
      if (graveA && !graveB) return -1;
      if (graveB && !graveA) return 1;
      if (graveA && graveB) {
        // Ambos graves - ordenar pelo MAIS grave (maior variação positiva)
        return variacaoB - variacaoA; // +200% vem antes de +100%
      }

      // 2º PRIORIDADE: Problemas moderados (25-50%)
      if (problemaA && !problemaB && !bomB) return -1;
      if (problemaB && !problemaA && !bomA) return 1;
      if (problemaA && problemaB) {
        // Ambos problemas moderados - ordenar pelo maior problema
        return variacaoB - variacaoA;
      }

      // 3º PRIORIDADE: Casos BONS (variações negativas - melhorias)
      if (bomA && !bomB && !graveB && !problemaB) return -1;
      if (bomB && !bomA && !graveA && !problemaA) return 1;
      if (bomA && bomB) {
        // Ambos bons - ordenar pela MAIOR melhoria (mais negativo)
        return variacaoA - variacaoB; // -70% vem antes de -30%
      }

      // 4º PRIORIDADE: Casos normais (-15% a +25%)
      // Ordenar por melhor tempo (menor tempo = melhor performance)
      if (a.tempo_dia_especifico !== b.tempo_dia_especifico) {
        return a.tempo_dia_especifico - b.tempo_dia_especifico;
      }

      // Se tempos iguais, ordenar por mais pedidos
      return b.pedidos_dia - a.pedidos_dia;
    });

    // Log da ordenação para debug
    const categorias = {
      graves: produtosFiltrados.filter(p => p.variacao_percentual > 50).length,
      problemas: produtosFiltrados.filter(
        p => p.variacao_percentual > 25 && p.variacao_percentual <= 50
      ).length,
      bons: produtosFiltrados.filter(p => p.variacao_percentual < -15).length,
      normais: produtosFiltrados.filter(
        p => p.variacao_percentual >= -15 && p.variacao_percentual <= 25
      ).length,
    };

    console.log(`📊 Ordenação aplicada:`, categorias);
    console.log(
      `🔴 Primeiros 3 produtos:`,
      produtosFiltrados.slice(0, 3).map(p => ({
        produto: p.produto,
        variacao: p.variacao_percentual,
        categoria:
          p.variacao_percentual > 50
            ? 'GRAVE'
            : p.variacao_percentual > 25
              ? 'PROBLEMA'
              : p.variacao_percentual < -15
                ? 'BOM'
                : 'NORMAL',
      }))
    );

    console.log(
      `✅ Processamento concluído: ${produtosFiltrados.length} produtos analisados`
    );

    return NextResponse.json({
      success: true,
      produtos: produtosFiltrados,
      metricas_qualidade: metricas,
      meta: {
        data_especifica: dataEspecifica,
        periodo_analise: periodoAnalise,
        grupo_filtro: grupoFiltro,
        total_produtos: produtosFiltrados.length,
        produtos_com_dados_dia: produtosFiltrados.filter(p => p.pedidos_dia > 0)
          .length,
        produtos_com_variacao_alta: produtosFiltrados.filter(
          p => Math.abs(p.variacao_percentual) > 25
        ).length,
        dados_periodo_total: dadosPeriodo?.length || 0,
        dados_dia_total: dadosRecentes?.length || 0,
        usando_dados_recentes: usandoDadosRecentes,
      },
    });
  } catch (error) {
    console.error('❌ Erro na API de tempos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
