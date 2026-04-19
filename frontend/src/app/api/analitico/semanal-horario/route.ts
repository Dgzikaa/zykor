import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarMultiplasDatas } from '@/lib/helpers/calendario-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HorarioSemanalData {
  hora: number;
  hora_formatada: string;
  faturamento_atual: number;
  faturamento_semana1: number;
  faturamento_semana2: number;
  faturamento_semana3: number;
  media_4_semanas: number;
  data_atual?: string;
  data_semana1?: string;
  data_semana2?: string;
  data_semana3?: string;
  // Novos campos para suportar múltiplas datas
  todas_datas?: { [data: string]: number }; // { "2025-09-12": 1234.56, "2025-08-29": 2345.67, ... }
  datas_ordenadas?: string[]; // ["2025-09-12", "2025-08-29", "2025-08-22", ...]
  [key: string]: any; // Para campos dinâmicos como data_YYYY_MM_DD
}

interface ResumoPorData {
  data: string;
  data_formatada: string;
  dia_semana: string;
  total_faturamento: number;
  horario_pico: number;
  horario_pico_valor: number;
  produto_mais_vendido: string;
  produto_mais_vendido_qtd: number;
  produto_mais_vendido_valor: number;
  total_produtos_vendidos: number;
  produtos_unicos: number;
}

interface EstatisticasSemana {
  total_faturamento_atual: number;
  total_faturamento_semana1: number;
  total_faturamento_semana2: number;
  total_faturamento_semana3: number;
  media_total_4_semanas: number;
  horario_pico_atual: number;
  horario_pico_media: number;
  crescimento_vs_semana_anterior: number;
  crescimento_vs_media: number;
  data_atual: string;
  data_semana1: string;
  data_semana2: string;
  data_semana3: string;
}

const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export async function GET(request: NextRequest) {
  // 🚀 TIMEOUT PROTECTION: Configurar timeout de 25 segundos
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout após 25 segundos')), 25000);
  });

  const mainPromise = async () => {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');
    const diaSemana = searchParams.get('diaSemana'); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    const meses = searchParams.get('meses'); // formato: 2025-09,2025-08
    const modo = searchParams.get('modo') || 'individual'; // individual ou mes_x_mes

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

    if (!meses) {
      return NextResponse.json({
        success: false,
        error: 'meses é obrigatório'
      }, { status: 400 });
    }

    const barIdNum = parseInt(barId);
    const mesesSelecionados = meses.split(',');
    const diaSemanaNum = diaSemana === 'todos' ? null : parseInt(diaSemana);
    
            
    // Para cada mês selecionado, encontrar todas as ocorrências do dia da semana
    const datasParaBuscar: string[] = [];
    
    for (const mesAno of mesesSelecionados) {
      const [ano, mes] = mesAno.split('-').map(Number);
      
      if (diaSemana === 'todos') {
        // Buscar todos os dias do mês
        const primeiroDiaMes = new Date(ano, mes - 1, 1);
        const ultimoDiaMes = new Date(ano, mes, 0);
        
                
        for (let dia = 1; dia <= ultimoDiaMes.getDate(); dia++) {
          const dataFormatada = `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
          datasParaBuscar.push(dataFormatada);
        }
      } else {
        // Buscar apenas o dia da semana específico
        const primeiroDiaMes = new Date(ano, mes - 1, 1);
        const ultimoDiaMes = new Date(ano, mes, 0);
        
                
        // Encontrar a primeira ocorrência do dia da semana no mês
        let dataAtual = new Date(primeiroDiaMes);
        const diasParaAvancar = (diaSemanaNum! - dataAtual.getDay() + 7) % 7;
        dataAtual.setDate(dataAtual.getDate() + diasParaAvancar);
        
                
        // Adicionar todas as ocorrências do dia da semana no mês
        while (dataAtual.getMonth() === mes - 1) {
          const dataFormatada = dataAtual.toISOString().split('T')[0];
                    datasParaBuscar.push(dataFormatada);
          dataAtual.setDate(dataAtual.getDate() + 7); // Próxima semana
        }
      }
    }
    
    // Ordenar datas (mais recente primeiro)
    datasParaBuscar.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    
    // ⚡ FILTRAR DIAS FECHADOS
    const statusDias = await verificarMultiplasDatas(datasParaBuscar, barIdNum);
    const datasAberto = datasParaBuscar.filter(data => {
      const status = statusDias.get(data);
      return status?.aberto !== false;
    });
    
    
    // Buscar dados de faturamento por hora para cada data
    const dadosPorSemana: { [data: string]: { [hora: number]: number } } = {};
    const datasComDados: string[] = [];

    // 🚀 OTIMIZAÇÃO CRÍTICA: Limitar drasticamente para evitar timeout
    let datasParaProcessar: string[];
    
    if (diaSemana === 'todos') {
      if (modo === 'mes_x_mes') {
        // 🎯 MODO MÊS X MÊS: Buscar dados de todos os meses selecionados
        datasParaProcessar = datasAberto.slice(0, 60); // Aumentar para 60 datas (apenas abertos)
      } else {
        // 🎯 MODO INDIVIDUAL: Apenas últimos 5 dias
        const hoje = new Date();
        const dataLimite = new Date();
        dataLimite.setDate(hoje.getDate() - 7);

        datasParaProcessar = datasParaBuscar.filter(data => {
          const dataObj = new Date(data + 'T12:00:00');
          return dataObj >= dataLimite && dataObj <= hoje;
        }).slice(0, 5); // MÁXIMO 5 DATAS
      }
    } else {
      // Para dias específicos, MÁXIMO 8 datas
      const LIMITE_CRITICO = 8;
      datasParaProcessar = datasParaBuscar.slice(0, LIMITE_CRITICO);
    }

    // 🚀 OTIMIZAÇÃO CRÍTICA: Buscar apenas dados essenciais com timeout

    // Promise com timeout para cada query
    const queryWithTimeout = async (queryPromise: PromiseLike<any>, name: string) => {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timeout`)), 8000)
      );
      return Promise.race([Promise.resolve(queryPromise), timeout]);
    };

    let eventosData: any[] = [];
    let faturamentoDiaData: any[] = [];
    let dadosPeriodoData: any[] = [];

    try {
      // Buscar apenas dados de período (mais essencial)
      const periodoQuery = supabase
        .schema('silver')
        .from('cliente_visitas')
        .select('data_visita, valor_pagamentos')
        .in('data_visita', datasParaProcessar)
        .eq('bar_id', barIdNum)
        .limit(50);

      const periodoResult = await queryWithTimeout(periodoQuery, 'visitas');
      dadosPeriodoData = periodoResult.data || [];

      // Se há dados de período, buscar faturamento por hora
      if (dadosPeriodoData.length > 0) {
        const fatHoraQuery = supabase
          .from('faturamento_hora')
          .select('data_venda, hora, valor')
          .in('data_venda', datasParaProcessar)
          .eq('bar_id', barIdNum)
          .gte('hora', 17)
          .lte('hora', 26)
          .limit(200);

        const fatHoraResult = await queryWithTimeout(fatHoraQuery, 'faturamento_hora');
        faturamentoDiaData = fatHoraResult.data || [];
      }

      // Buscar eventos apenas se necessário (fallback)
      if (dadosPeriodoData.length === 0) {
        const eventosQuery = supabase
          .from('eventos_base')
          .select('data_evento, real_r, sympla_liquido, yuzer_liquido')
          .in('data_evento', datasParaProcessar)
          .eq('bar_id', barIdNum)
          .limit(20);

        const eventosResult = await queryWithTimeout(eventosQuery, 'eventos_base');
        eventosData = eventosResult.data || [];
      }

    } catch (error) {
      console.warn('⚠️ Timeout em alguma query, continuando com dados parciais:', error);
    }

    
    // Criar mapa de eventos por data para acesso rápido
    const eventosPorData = new Map<string, any>();
    eventosData.forEach(evento => {
      eventosPorData.set(evento.data_evento, evento);
    });

    // Criar mapas para acesso rápido
    const faturamentoPorData = new Map<string, any[]>();
    const periodosPorData = new Map<string, any[]>();

    (faturamentoDiaData || []).forEach(item => {
      const data = item.data_venda;
      if (!faturamentoPorData.has(data)) {
        faturamentoPorData.set(data, []);
      }
      faturamentoPorData.get(data)!.push(item);
    });

    (dadosPeriodoData || []).forEach(item => {
      const data = item.data_visita;
      if (!periodosPorData.has(data)) {
        periodosPorData.set(data, []);
      }
      periodosPorData.get(data)!.push(item);
    });

    for (const data of datasParaProcessar) {
      
      // 🔍 PRIMEIRO: Buscar dados do evento (já carregado em batch)
      const eventoData = eventosPorData.get(data);

      
      // Buscar dados já carregados em batch
      const faturamentoDia = faturamentoPorData.get(data)?.filter(item => item.hora >= 17 && item.hora <= 23) || [];
      const faturamentoMadrugada = faturamentoPorData.get(data)?.filter(item => item.hora >= 24 && item.hora <= 26) || [];
      const dadosPeriodo = periodosPorData.get(data) || [];

      // 🔧 ESTRUTURA CORRETA: valor_pagamentos = VALOR TOTAL DE FATURAMENTO DO DIA
      const totalPagamentos = dadosPeriodo?.reduce((sum, item) => sum + (parseFloat(item.valor_pagamentos) || 0), 0) || 0;
      const totalProdutosPeriodo = dadosPeriodo?.reduce((sum, item) => sum + (parseFloat(item.valor_produtos) || 0), 0) || 0;
      const totalCouvert = dadosPeriodo?.reduce((sum, item) => sum + (parseFloat(item.valor_couvert) || 0), 0) || 0;
      const totalRepique = dadosPeriodo?.reduce((sum, item) => sum + (parseFloat(item.valor_repique) || 0), 0) || 0;
      const totalDescontos = dadosPeriodo?.reduce((sum, item) => sum + (parseFloat(item.valor_desconto) || 0), 0) || 0;
      
      // ✅ USAR APENAS vr_pagamentos (que JÁ É O TOTAL)
      const faturamentoTotalDia = totalPagamentos;
      
            
      
      // 🔧 NOVA LÓGICA: Usar vr_pagamentos como total e distribuir proporcionalmente
      const faturamentoPorHora: { [hora: number]: number } = {};
      
      // Se há dados de produtos por hora, usar para distribuição proporcional
      const produtosPorHora: { [hora: number]: number } = {};
      
      // Processar horários normais (17-23h)
      (faturamentoDia || []).forEach(item => {
        const hora = item.hora;
        const valor = parseFloat(item.valor) || 0;
        produtosPorHora[hora] = valor;
      });

      // Processar madrugada (24h->0h, 25h->1h, 26h->2h)
      (faturamentoMadrugada || []).forEach(item => {
        const hora = item.hora - 24; // Normalizar: 24->0, 25->1, 26->2
        const valor = parseFloat(item.valor) || 0;
        produtosPorHora[hora] = valor;
      });

      const totalProdutosPorHora = Object.values(produtosPorHora).reduce((sum, val) => sum + val, 0);
      
      // 🎯 USAR vr_pagamentos como valor total real (sem duplicação)
      if (faturamentoTotalDia > 0) {
        if (totalProdutosPorHora > 0) {
          // Distribuir o valor total proporcionalmente aos produtos por hora
          Object.keys(produtosPorHora).forEach(horaStr => {
            const hora = parseInt(horaStr);
            const produtosHora = produtosPorHora[hora];
            const proporcao = produtosHora / totalProdutosPorHora;
            faturamentoPorHora[hora] = faturamentoTotalDia * proporcao;
          });
        } else {
          // Se não há dados por hora, distribuir igualmente pelos horários principais
          const horariosDistribuicao = [19, 20, 21, 22, 23];
          const valorPorHora = faturamentoTotalDia / horariosDistribuicao.length;
          
          horariosDistribuicao.forEach(hora => {
            faturamentoPorHora[hora] = valorPorHora;
          });
        }
      }

      // Verificar se há dados significativos
      let totalDia = Object.values(faturamentoPorHora).reduce((sum, val) => sum + val, 0);
                                    
      // 🔧 CORREÇÃO CRÍTICA: Se há dados do ContaHub mas totalDia está zero, usar faturamentoTotalDia
      if (totalDia === 0 && faturamentoTotalDia > 0) {
                
        // Distribuir pelos horários principais (19h-23h)
        const horariosDistribuicao = [19, 20, 21, 22, 23];
        const valorPorHora = faturamentoTotalDia / horariosDistribuicao.length;
        
        horariosDistribuicao.forEach(hora => {
          faturamentoPorHora[hora] = valorPorHora;
        });
        
        totalDia = faturamentoTotalDia;
              }
      
      // 🔧 CORREÇÃO: Verificar se há duplicação entre evento e ContaHub
      if (eventoData && parseFloat(eventoData.real_r) > 0) {
        const eventoValor = parseFloat(eventoData.real_r);
        
        // Se o valor do evento é muito próximo do ContaHub, pode haver duplicação
        const diferenca = Math.abs(eventoValor - totalDia);
        const percentualDiferenca = totalDia > 0 ? (diferenca / totalDia) * 100 : 100;
        
                
        // 🔧 CORREÇÃO: Detectar e corrigir duplicação sistemática
        // O real_r do evento pode já incluir produtos, causando duplicação
                
        // ✅ LÓGICA CORRIGIDA: Agora usando vr_pagamentos como total (sem duplicação)
              }
      
      // 🔄 INTEGRAÇÃO: Sempre somar dados do Yuzer/Sympla quando disponíveis (meses históricos)
      if (eventoData) {
        const faturamentoYuzer = parseFloat(eventoData.yuzer_liquido) || 0;
        const faturamenteSympla = parseFloat(eventoData.sympla_liquido) || 0;
        const faturamentoIngressos = faturamentoYuzer + faturamenteSympla;
        
        // Se há dados de ingressos, somar ao faturamento existente
        if (faturamentoIngressos > 0) {
                    
          // Se já há dados por hora, distribuir ingressos proporcionalmente
          if (totalDia > 0) {
            Object.keys(faturamentoPorHora).forEach(horaStr => {
              const hora = parseInt(horaStr);
              const faturamentoHora = faturamentoPorHora[hora];
              const proporcao = faturamentoHora / totalDia;
              const ingressosHora = faturamentoIngressos * proporcao;
              faturamentoPorHora[hora] = faturamentoHora + ingressosHora;
            });
            totalDia += faturamentoIngressos;
                      } else {
            // Se não há dados por hora, usar fallback completo
            const faturamentoBar = parseFloat(eventoData.real_r) || 0;
            const faturamentoTotalEvento = faturamentoBar + faturamentoIngressos;
            
            if (faturamentoTotalEvento > 0) {
                            
              // Distribuir pelos horários principais (19h-23h)
              const horariosDistribuicao = [19, 20, 21, 22, 23];
              const valorPorHora = faturamentoTotalEvento / horariosDistribuicao.length;
              
              horariosDistribuicao.forEach(hora => {
                faturamentoPorHora[hora] = valorPorHora;
              });
              
              totalDia = faturamentoTotalEvento;
                          }
          }
        } else if (totalDia === 0) {
          // Fallback apenas com dados do bar se não há dados de ingressos nem ContaHub
          const faturamentoBar = parseFloat(eventoData.real_r) || 0;
          
          if (faturamentoBar > 0) {
                        
            // Distribuir pelos horários principais (19h-23h)
            const horariosDistribuicao = [19, 20, 21, 22, 23];
            const valorPorHora = faturamentoBar / horariosDistribuicao.length;
            
            horariosDistribuicao.forEach(hora => {
              faturamentoPorHora[hora] = valorPorHora;
            });
            
            totalDia = faturamentoBar;
                      }
        }
      }
      
      if (totalDia > 0) {
        dadosPorSemana[data] = faturamentoPorHora;
        datasComDados.push(data);
              }
    }

        
    if (datasComDados.length === 0) {
            
      // Se é "todos os dias" e não encontrou dados, tentar com range maior
      if (diaSemana === 'todos') {
                
        // Buscar nos últimos 60 dias
        const hoje = new Date();
        const dataLimiteFallback = new Date();
        dataLimiteFallback.setDate(hoje.getDate() - 60);
        
        const datasParaProcessarFallback = datasParaBuscar.filter(data => {
          const dataObj = new Date(data + 'T12:00:00');
          return dataObj >= dataLimiteFallback;
        }).slice(0, 30);
        
                
        if (datasParaProcessarFallback.length > 0) {
          // Tentar novamente com range maior
          datasParaProcessar = datasParaProcessarFallback;
          
          // Reprocessar com dados ampliados (simplificado)
          for (const data of datasParaProcessar.slice(0, 5)) { // Apenas 5 datas para não dar timeout
            const { data: dadosPeriodoFallback } = await supabase
              .schema('silver')
              .from('cliente_visitas')
              .select('data_visita, valor_pagamentos')
              .eq('data_visita', data)
              .eq('bar_id', barIdNum);
            
            if (dadosPeriodoFallback && dadosPeriodoFallback.length > 0) {
              const totalPagamentos = dadosPeriodoFallback.reduce((sum, item) => sum + (parseFloat(item.valor_pagamentos) || 0), 0);
              
              if (totalPagamentos > 0) {
                                datasComDados.push(data);
                
                // Criar dados básicos para o horário
                const faturamentoPorHora: { [hora: number]: number } = {};
                const horariosDistribuicao = [19, 20, 21, 22, 23];
                const valorPorHora = totalPagamentos / horariosDistribuicao.length;
                
                horariosDistribuicao.forEach(hora => {
                  faturamentoPorHora[hora] = valorPorHora;
                });
                
                dadosPorSemana[data] = faturamentoPorHora;
                
                // Se encontrou pelo menos 1 data, pode continuar
                if (datasComDados.length >= 1) break;
              }
            }
          }
        }
      }
      
      // Se ainda não encontrou dados após fallback
      if (datasComDados.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Nenhum dado encontrado para o dia da semana selecionado'
        }, { status: 404 });
      }
    }

    // 🚀 OTIMIZAÇÃO: Buscar produtos apenas se há poucas datas (evitar timeout)
    let produtosPorData = new Map<string, any[]>();
    
    if (datasComDados.length <= 3) {
      try {
                
        // Excluir categorias de compras/estoque
        const produtosQuery = supabase
          .from('vendas_item')
          .select('data_venda, produto_desc, quantidade, valor, grupo_desc')
          .in('data_venda', datasComDados)
          .eq('bar_id', barIdNum)
          .not('grupo_desc', 'in', '("Mercadorias- Compras","Insumos","Uso Interno")')
          .order('valor', { ascending: false })
          .limit(100);

        const produtosResult = await queryWithTimeout(produtosQuery, 'vendas_item');
        const produtosData = produtosResult.data || [];

        // Criar mapa de produtos por data (mapear campos para compatibilidade)
        produtosData.forEach(produto => {
          const data = produto.data_venda;
          if (!produtosPorData.has(data)) {
            produtosPorData.set(data, []);
          }
          produtosPorData.get(data)!.push(produto);
        });
      } catch (error) {
        console.warn('⚠️ Timeout ao buscar produtos, continuando sem dados de produtos:', error);
      }
    }

    const resumoPorData: ResumoPorData[] = [];
    
    for (const data of datasComDados) {
            
      // Buscar produtos já carregados em batch
      const produtosDia = produtosPorData.get(data) || [];

      // Processar dados dos produtos
      const produtosAgregados = new Map<string, { qtd: number, valor: number }>();
      let totalProdutosVendidos = 0;
      let totalValorProdutos = 0;

      (produtosDia || []).forEach(item => {
        const produto = item.produto_desc || item.prd_desc;
        const qtd = parseFloat(item.quantidade || item.qtd) || 0;
        const valor = parseFloat(item.valor || item.valorfinal) || 0;
        
        totalProdutosVendidos += qtd;
        totalValorProdutos += valor;

        if (produtosAgregados.has(produto)) {
          const existing = produtosAgregados.get(produto)!;
          existing.qtd += qtd;
          existing.valor += valor;
        } else {
          produtosAgregados.set(produto, { qtd, valor });
        }
      });

      // Encontrar produto mais vendido (por valor)
      let produtoMaisVendido = 'N/A';
      let produtoMaisVendidoQtd = 0;
      let produtoMaisVendidoValor = 0;

      for (const [produto, dados] of produtosAgregados.entries()) {
        if (dados.valor > produtoMaisVendidoValor) {
          produtoMaisVendido = produto;
          produtoMaisVendidoQtd = dados.qtd;
          produtoMaisVendidoValor = dados.valor;
        }
      }

      // Encontrar horário de pico
      const faturamentoDia = dadosPorSemana[data];
      let horarioPico = 21; // Default
      let horarioPicoValor = 0;

      for (const [hora, valor] of Object.entries(faturamentoDia)) {
        if (valor > horarioPicoValor) {
          horarioPico = parseInt(hora);
          horarioPicoValor = valor;
        }
      }

      // Criar resumo da data
      const dataObj = new Date(data + 'T12:00:00');
      const resumo: ResumoPorData = {
        data,
        data_formatada: dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        dia_semana: NOMES_DIAS[dataObj.getDay()],
        total_faturamento: Object.values(faturamentoDia).reduce((sum, val) => sum + val, 0),
        horario_pico: horarioPico,
        horario_pico_valor: horarioPicoValor,
        produto_mais_vendido: produtoMaisVendido,
        produto_mais_vendido_qtd: produtoMaisVendidoQtd,
        produto_mais_vendido_valor: produtoMaisVendidoValor,
        total_produtos_vendidos: totalProdutosVendidos,
        produtos_unicos: produtosAgregados.size
      };

      resumoPorData.push(resumo);
    }

    // Ordenar datas (mais recente primeiro)
    datasComDados.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    
    // Criar estrutura de dados por hora (17h às 3h - igual ao resumo)
    const horariosParaAnalise = [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3];
    const dadosHorarios: HorarioSemanalData[] = [];

    if (modo === 'mes_x_mes' && mesesSelecionados.length >= 2) {
      // 🎯 CORREÇÃO: Modo Mês x Mês - Calcular MÉDIA por dia da semana (não soma)
      const dadosPorMes: { [mes: string]: { [hora: number]: number[] } } = {};
      
      // Agrupar dados por mês, separando por dia da semana
      datasComDados.forEach(data => {
        const mesData = data.substring(0, 7); // 2025-09
        const dataObj = new Date(data + 'T12:00:00');
        const diaSemanaData = dataObj.getDay();
        
        // 🎯 FILTRO: Só processar dados do dia da semana selecionado (ou todos se 'todos')
        // Se diaSemanaNum é null (todos os dias), não filtrar
        if (diaSemanaNum !== null && diaSemanaData !== diaSemanaNum) {
          return; // Pular se não for o dia da semana selecionado
        }
        
        if (!dadosPorMes[mesData]) {
          dadosPorMes[mesData] = {};
        }
        
        horariosParaAnalise.forEach(hora => {
          if (!dadosPorMes[mesData][hora]) {
            dadosPorMes[mesData][hora] = [];
          }
          const valor = dadosPorSemana[data]?.[hora] || 0;
          if (valor > 0) {
            dadosPorMes[mesData][hora].push(valor);
          }
        });
      });

      
      // 🎯 CORREÇÃO: Calcular MÉDIA por hora para cada mês (em vez de soma)
      horariosParaAnalise.forEach(hora => {
        const mediasDosMeses: number[] = [];
        const datasLabels: (string | undefined)[] = [];
        
        // Calcular média para cada mês selecionado
        mesesSelecionados.forEach((mes, index) => {
          const valores_mes = dadosPorMes[mes]?.[hora] || [];
          // 🎯 MÉDIA: Dividir pela quantidade de ocorrências do dia da semana no mês
          const media_mes = valores_mes.length > 0 ? valores_mes.reduce((sum, val) => sum + val, 0) / valores_mes.length : 0;
          mediasDosMeses.push(media_mes);
          
          const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const mesIndex = parseInt(mes.split('-')[1]) - 1;
          const nomeMes = nomesMeses[mesIndex];
          datasLabels.push(`Média ${nomeMes} (${valores_mes.length}x)`);
        });

        // Preencher com zeros se necessário (máximo 4 campos)
        while (mediasDosMeses.length < 4) {
          mediasDosMeses.push(0);
          datasLabels.push(undefined);
        }

        const media_geral = mediasDosMeses.filter(m => m > 0).reduce((sum, val) => sum + val, 0) / mediasDosMeses.filter(m => m > 0).length || 0;

        dadosHorarios.push({
          hora,
          hora_formatada: `${hora.toString().padStart(2, '0')}:00`,
          faturamento_atual: mediasDosMeses[0] || 0,
          faturamento_semana1: mediasDosMeses[1] || 0,
          faturamento_semana2: mediasDosMeses[2] || 0,
          faturamento_semana3: mediasDosMeses[3] || 0,
          media_4_semanas: media_geral,
          // Labels para o tooltip no modo mês x mês
          data_atual: datasLabels[0],
          data_semana1: datasLabels[1],
          data_semana2: datasLabels[2],
          data_semana3: datasLabels[3]
        });
      });
    } else {
      // Modo Individual: Usar TODAS as datas encontradas
      
      horariosParaAnalise.forEach(hora => {
        // Criar objeto com todas as datas e seus valores para esta hora
        const todasDatasHora: { [data: string]: number } = {};
        const valoresHora: number[] = [];
        
        datasComDados.forEach(data => {
          const valor = dadosPorSemana[data]?.[hora] || 0;
          todasDatasHora[data] = valor;
          if (valor > 0) {
            valoresHora.push(valor);
          }
        });

        // Calcular média de todas as datas válidas
        const media_geral = valoresHora.length > 0 ? valoresHora.reduce((sum, val) => sum + val, 0) / valoresHora.length : 0;

        // Manter compatibilidade com estrutura antiga (primeiras 4 datas)
        const datasParaUsar = datasComDados.slice(0, 4);
        while (datasParaUsar.length < 4) {
          datasParaUsar.push('');
        }

        const faturamento_atual = datasParaUsar[0] ? (dadosPorSemana[datasParaUsar[0]]?.[hora] || 0) : 0;
        const faturamento_semana1 = datasParaUsar[1] ? (dadosPorSemana[datasParaUsar[1]]?.[hora] || 0) : 0;
        const faturamento_semana2 = datasParaUsar[2] ? (dadosPorSemana[datasParaUsar[2]]?.[hora] || 0) : 0;
        const faturamento_semana3 = datasParaUsar[3] ? (dadosPorSemana[datasParaUsar[3]]?.[hora] || 0) : 0;

        // 🎯 CORREÇÃO: Criar campos dinâmicos por DIA DA SEMANA (não por data específica)
        const camposDinamicos: { [key: string]: number } = {};
        const valoresPorDiaSemana = new Map<string, number[]>();
        
        // Agrupar valores por dia da semana
        datasComDados.forEach(data => {
          const dataObj = new Date(data + 'T12:00:00');
          const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
          const diaAbrev = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1, 3); // Dom, Seg, Ter, etc.
          const valor = dadosPorSemana[data]?.[hora] || 0;
          
          if (!valoresPorDiaSemana.has(diaAbrev)) {
            valoresPorDiaSemana.set(diaAbrev, []);
          }
          if (valor > 0) {
            valoresPorDiaSemana.get(diaAbrev)!.push(valor);
          }
        });
        
        // Calcular média por dia da semana
        valoresPorDiaSemana.forEach((valores, diaAbrev) => {
          const campoNome = `dia_${diaAbrev.toLowerCase()}`;
          const media = valores.length > 0 ? valores.reduce((sum, val) => sum + val, 0) / valores.length : 0;
          camposDinamicos[campoNome] = media;
        });
        
        // Manter campos originais para compatibilidade
        datasComDados.forEach(data => {
          const campoNome = `data_${data.replace(/-/g, '_')}`;
          camposDinamicos[campoNome] = dadosPorSemana[data]?.[hora] || 0;
        });

        dadosHorarios.push({
          hora,
          hora_formatada: `${hora.toString().padStart(2, '0')}:00`,
          faturamento_atual,
          faturamento_semana1,
          faturamento_semana2,
          faturamento_semana3,
          media_4_semanas: media_geral,
          // Incluir as datas para o tooltip (compatibilidade)
          data_atual: datasParaUsar[0] || undefined,
          data_semana1: datasParaUsar[1] || undefined,
          data_semana2: datasParaUsar[2] || undefined,
          data_semana3: datasParaUsar[3] || undefined,
          // Novos campos com todas as datas
          todas_datas: todasDatasHora,
          datas_ordenadas: datasComDados,
          // Campos dinâmicos para o Recharts
          ...camposDinamicos
        });
      });
    }

    // Calcular estatísticas corrigidas
    let total_faturamento_atual = 0;
    let total_faturamento_semana1 = 0;
    let total_faturamento_semana2 = 0;
    let total_faturamento_semana3 = 0;
    let media_total_4_semanas = 0;

    // 🔧 CORREÇÃO: "Mais Recente" deve SEMPRE ser o último dia específico
    // Não deve somar médias mensais, mas sim mostrar o valor real do último dia
    
    // SEMPRE usar dados das últimas 4 datas específicas (independente do modo)
    const ultimasQuatroDatas = datasComDados.slice(0, 4);
    const totaisPorData = ultimasQuatroDatas.map(data => {
      if (!data) return 0;
      return Object.values(dadosPorSemana[data] || {}).reduce((sum, val) => sum + val, 0);
    });

    total_faturamento_atual = totaisPorData[0] || 0;  // ÚLTIMO DIA ESPECÍFICO
    total_faturamento_semana1 = totaisPorData[1] || 0;
    total_faturamento_semana2 = totaisPorData[2] || 0;
    total_faturamento_semana3 = totaisPorData[3] || 0;

    // Média das últimas 4 semanas (apenas valores válidos)
    const totaisValidos = totaisPorData.filter(t => t > 0);
    media_total_4_semanas = totaisValidos.length > 0 ? totaisValidos.reduce((sum, val) => sum + val, 0) / totaisValidos.length : 0;
    
    
    // 🔧 CORREÇÃO: Horário de pico SEMPRE baseado na data mais recente
    let horario_pico_atual = 20;  // Default mais realista
    let horario_pico_media = 20;

    if (datasComDados.length > 0) {
      // SEMPRE usar dados da data mais recente (independente do modo)
      const dataRecente = datasComDados[0];
      const dadosDataRecente = dadosPorSemana[dataRecente] || {};
      
      let maior_faturamento_atual = 0;
      for (const [hora, valor] of Object.entries(dadosDataRecente)) {
        if (valor > maior_faturamento_atual) {
          maior_faturamento_atual = valor;
          horario_pico_atual = parseInt(hora);
        }
      }

      // Calcular horário de pico médio das últimas 4 datas (modo mais inteligente)
      const ultimasQuatroDatas = datasComDados.slice(0, 4);
      const horariosPico: number[] = [];
      
      ultimasQuatroDatas.forEach(data => {
        if (!data) return;
        const dadosData = dadosPorSemana[data] || {};
        let horarioPicoData = 20;  // Default
        let maiorValorData = 0;
        
        for (const [hora, valor] of Object.entries(dadosData)) {
          if (valor > maiorValorData) {
            maiorValorData = valor;
            horarioPicoData = parseInt(hora);
          }
        }
        
        if (maiorValorData > 0) {
          horariosPico.push(horarioPicoData);
        }
      });

      // Usar moda (horário mais frequente) em vez de média aritmética
      if (horariosPico.length > 0) {
        const frequencias: { [hora: number]: number } = {};
        horariosPico.forEach(hora => {
          frequencias[hora] = (frequencias[hora] || 0) + 1;
        });
        
        // Encontrar o horário mais frequente
        let horarioMaisFrequente = 20;
        let maiorFrequencia = 0;
        for (const [hora, freq] of Object.entries(frequencias)) {
          if (freq > maiorFrequencia) {
            maiorFrequencia = freq;
            horarioMaisFrequente = parseInt(hora);
          }
        }
        
        horario_pico_media = horarioMaisFrequente;
      }
      
          }

    // Calcular crescimentos
    const crescimento_vs_semana_anterior = total_faturamento_semana1 > 0 
      ? ((total_faturamento_atual - total_faturamento_semana1) / total_faturamento_semana1) * 100 
      : 0;

    const crescimento_vs_media = media_total_4_semanas > 0 
      ? ((total_faturamento_atual - media_total_4_semanas) / media_total_4_semanas) * 100 
      : 0;

    const estatisticas: EstatisticasSemana = {
      total_faturamento_atual,
      total_faturamento_semana1,
      total_faturamento_semana2,
      total_faturamento_semana3,
      media_total_4_semanas,
      horario_pico_atual,
      horario_pico_media,
      crescimento_vs_semana_anterior,
      crescimento_vs_media,
      data_atual: datasComDados[0] || '',
      data_semana1: datasComDados[1] || '',
      data_semana2: datasComDados[2] || '',
      data_semana3: datasComDados[3] || ''
    };

    
    // Criar dados para gráfico de valor total por dia da semana (modo Mês x Mês)
    const dadosValorTotal: any[] = [];
    
        
    if (modo === 'mes_x_mes' && mesesSelecionados.length >= 2) {
      const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const diasSemanaLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const coresPorDiaSemana = ['#EF4444', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6']; // Cores por dia da semana
      
      if (diaSemana === 'todos') {
        // NOVO LAYOUT: Meses na esquerda, dias da semana em cores
        // Agrupar dados por mês e dia da semana
        const dadosPorMesEDia: { [mes: string]: { [diaSemana: number]: number } } = {};
        
                        
        datasComDados.forEach(data => {
          const [ano, mes, dia] = data.split('-');
          const mesCompleto = `${ano}-${mes}`;
          const dataObj = new Date(data + 'T12:00:00');
          const diaSemanaNum = dataObj.getDay();
          const totalData = Object.values(dadosPorSemana[data] || {}).reduce((sum, valor) => sum + valor, 0);
          
                    
          if (totalData > 0) {
            if (!dadosPorMesEDia[mesCompleto]) {
              dadosPorMesEDia[mesCompleto] = {};
            }
            if (!dadosPorMesEDia[mesCompleto][diaSemanaNum]) {
              dadosPorMesEDia[mesCompleto][diaSemanaNum] = 0;
            }
            dadosPorMesEDia[mesCompleto][diaSemanaNum] += totalData;
          }
        });
        
                
        // Criar estrutura para o gráfico (um ponto por mês, com dados de todos os dias da semana)
        mesesSelecionados.forEach((mesCompleto, index) => {
          const [ano, mes] = mesCompleto.split('-');
          const mesIndex = parseInt(mes) - 1;
          const nomeMes = nomesMeses[mesIndex];
          const dadosDoMes = dadosPorMesEDia[mesCompleto] || {};
          
          // Criar um objeto com todos os dias da semana
          const dadosMes: any = {
            mes: nomeMes,
            mes_completo: mesCompleto,
            data_formatada: nomeMes,
            cor_index: index
          };
          
          // Adicionar dados para cada dia da semana
          for (let diaSem = 0; diaSem < 7; diaSem++) {
            const labelDia = diasSemanaLabels[diaSem];
            const valorDia = dadosDoMes[diaSem] || 0;
            dadosMes[`dia_${diaSem}`] = valorDia;
            dadosMes[`${labelDia.toLowerCase()}`] = valorDia;
          }
          
          dadosValorTotal.push(dadosMes);
        });
        
              } else {
        // 🎯 CORREÇÃO: Calcular MÉDIA por dia da semana específico (não soma)
        const dadosPorMesEMedia: { [mes: string]: { valores: number[], count: number } } = {};
        
        datasComDados.forEach(data => {
          const [ano, mes, dia] = data.split('-');
          const mesCompleto = `${ano}-${mes}`;
          const totalData = Object.values(dadosPorSemana[data] || {}).reduce((sum, valor) => sum + valor, 0);
          
          if (!dadosPorMesEMedia[mesCompleto]) {
            dadosPorMesEMedia[mesCompleto] = { valores: [], count: 0 };
          }
          if (totalData > 0) {
            dadosPorMesEMedia[mesCompleto].valores.push(totalData);
            dadosPorMesEMedia[mesCompleto].count++;
          }
        });
        
        // Calcular médias por mês
        const totaisPorMes: { [mes: string]: number } = {};
        Object.keys(dadosPorMesEMedia).forEach(mes => {
          const dados = dadosPorMesEMedia[mes];
          totaisPorMes[mes] = dados.valores.length > 0 ? dados.valores.reduce((sum, val) => sum + val, 0) / dados.valores.length : 0;
        });
        
        // Criar estrutura para o gráfico mensal (um ponto por mês)
        mesesSelecionados.forEach((mesCompleto, index) => {
          const [ano, mes] = mesCompleto.split('-');
          const mesIndex = parseInt(mes) - 1;
          const nomeMes = nomesMeses[mesIndex];
          const totalMesValor = totaisPorMes[mesCompleto] || 0;
          
          // 🎯 CORREÇÃO: Coletar detalhes das datas do mês para o tooltip (com média)
          const dadosDoMesDetalhes = dadosPorMesEMedia[mesCompleto];
          const datasDoMes: { data: string, valor: number }[] = [];
          
          if (dadosDoMesDetalhes && dadosDoMesDetalhes.valores.length > 0) {
            // Mostrar detalhes das datas individuais
            let dataIndex = 0;
            datasComDados.forEach(data => {
              if (data.startsWith(mesCompleto)) {
                const totalData = Object.values(dadosPorSemana[data] || {}).reduce((sum, valor) => sum + valor, 0);
                if (totalData > 0) {
                  const [, , dia] = data.split('-');
                  datasDoMes.push({
                    data: `${dia}/${mes}`,
                    valor: totalData
                  });
                  dataIndex++;
                }
              }
            });
          }
          
          const countMes = dadosPorMesEMedia[mesCompleto]?.count || 0;
          
          if (totalMesValor > 0) {
            dadosValorTotal.push({
              mes: nomeMes,
              mes_completo: mesCompleto,
              dia_semana: diaSemana === 'todos' ? 'Todos os Dias' : NOMES_DIAS[diaSemanaNum!],
              data_completa: mesCompleto,
              data_formatada: `${nomeMes} (Média de ${countMes}x)`,
              valor_total: totalMesValor,
              cor_index: index,
              cor: '#3B82F6',
              sextas_detalhes: datasDoMes
            });
          }
        });
        
              }
    } else if (modo === 'individual' && datasComDados.length > 0) {
      // MODO INDIVIDUAL: Cada sexta-feira individual com cores por mês
      const diasSemanaLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const coresPorMes = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16', '#F97316'];
      
      datasComDados.forEach(data => {
        const [ano, mes, dia] = data.split('-');
        const mesIndex = parseInt(mes) - 1;
        const nomeMes = nomesMeses[mesIndex];
        const mesCompleto = `${ano}-${mes}`;
        const dataObj = new Date(data + 'T12:00:00');
        const diaSemanaLabel = diasSemanaLabels[dataObj.getDay()];
        const totalData = Object.values(dadosPorSemana[data] || {}).reduce((sum, valor) => sum + valor, 0);
        
        dadosValorTotal.push({
          mes: nomeMes,
          mes_completo: mesCompleto,
          dia_semana: diaSemanaLabel,
          data_completa: data,
          data_formatada: `${dia}/${mes}`,
          valor_total: totalData,
          cor_index: mesesSelecionados.indexOf(mesCompleto),
          cor: coresPorMes[mesesSelecionados.indexOf(mesCompleto)] || '#3B82F6'
        });
      });
      
      // Ordenar por data (mais antiga primeiro)
      dadosValorTotal.sort((a, b) => new Date(a.data_completa).getTime() - new Date(b.data_completa).getTime());
      
          }

    return NextResponse.json({
      success: true,
      data: {
        horarios: dadosHorarios,
        estatisticas,
        resumo_por_data: resumoPorData,
        valor_total_por_mes: dadosValorTotal, // Novo campo para o gráfico
        dia_semana: diaSemana === 'todos' ? 'Todos os Dias' : NOMES_DIAS[diaSemanaNum!],
        periodo: `${datasComDados[3] || 'N/A'} - ${datasComDados[0] || 'N/A'}`,
        ultimaAtualizacao: new Date().toISOString()
      }
    });
  }; // Fim da mainPromise

  try {
    // 🚀 TIMEOUT PROTECTION: Executar com timeout
    return await Promise.race([mainPromise(), timeoutPromise]);
  } catch (error) {
    console.error('❌ Erro ao calcular dados semanais por horário:', error);
    
    // Verificar se é timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: 'Timeout na consulta - tente novamente com menos dados',
        details: 'A consulta demorou mais de 25 segundos. Tente selecionar menos meses ou um dia específico.'
      }, { status: 408 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
