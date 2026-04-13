import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

// Interfaces para tipagem adequada
interface PagamentoData {
  liquido: string;
  total_liquido: string;
  valor_total: string;
  vr_couvert: string;
  vr_pagamentos: string;
  data_pagamento: string;
}

interface SymplaData {
  data_evento: string;
  total_liquido: string;
  qtd_checkins_realizados: string;
}

interface PeriodoData {
  dt_gerencial: string;
  pessoas: string;
  vr_pagamentos: string;
  vr_couvert: string;
  cli_cel?: string;
}

interface YuzerData {
  data_pedido: string;
  valor_total: string;
  pedido_id: string;
  produto_nome: string;
}

interface VisitaSymplaData {
  data_visita: string;
  pessoas_na_mesa: string;
}

interface DashboardDia {
  data: string;
  pagamentos: number;
  sympla: number;
  periodo: number;
  yuzer_bar: number;
  yuzer_ingressos: number;
  visitas_sympla: number;
  total_clientes: number;
  faturamento_pagamentos: number;
  faturamento_sympla: number;
  faturamento_periodo: number;
  faturamento_yuzer_bar: number;
  faturamento_yuzer_ingressos: number;
  couvert_total: number;
}

export const dynamic = 'force-dynamic';

// FUNÇÃO COMPLETAMENTE NOVA PARA FORÇAR RECOMPILAÇÃO
async function getDashboardSemanalCorrigido(request: NextRequest) {
  const VERSAO_DOMINGO_CORRIGIDA = 'V5_FINAL_' + Date.now();
  
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com o banco de dados' },
        { status: 500 }
      );
    }

    // Extrair parâmetros
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');

    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: bar_id, data_inicio, data_fim' },
        { status: 400 }
      );
    }

    
    // Gerar array de datas da semana
    const inicioSemana = new Date(data_inicio + 'T00:00:00');
    const diasSemana: Array<{
      data: string;
      dia: string;
      faturamento: number;
      clientes: number;
      ticketMedio: number;
    }> = [];
    const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i <= 6; i++) {
      const dia = new Date(inicioSemana);
      dia.setDate(inicioSemana.getDate() + i);
      const dataStr = dia.toISOString().split('T')[0];
      diasSemana.push({
        data: dataStr,
        dia: diasNomes[dia.getDay()],
        faturamento: 0,
        clientes: 0,
        ticketMedio: 0,
      });
    }

    // BUSCAR DADOS COM PAGINAÇÃO
    const buscarTodosPagamentos = async () => {
      let todosPagamentos: PagamentoData[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('pagamentos')
          .select('liquido, total_liquido, valor_total, vr_couvert, vr_pagamentos, data_pagamento')
          .eq('bar_id', parseInt(bar_id))
          .gte('data_pagamento', data_inicio)
          .lte('data_pagamento', data_fim)
          .not('liquido', 'is', null)
          .range(offset, offset + limit - 1);

        if (error) {
          console.error(
            `❌ Erro na paginação Pagamentos offset ${offset}:`,
            error
          );
          break;
        }

        if (data && data.length > 0) {
          todosPagamentos = [...todosPagamentos, ...(data as any)];
          if (data.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        } else {
          hasMore = false;
        }
      }

            return todosPagamentos;
    };

    // Buscar dados em paralelo
    const [pagamentos, symplaResult, periodoResult] = await Promise.all([
      buscarTodosPagamentos(),

      // 2. Sympla para clientes + faturamento
      supabase
        .from('sympla_bilheteria')
        .select('data_evento, total_liquido, qtd_checkins_realizados')
        .eq('bar_id', parseInt(bar_id))
        .gte('data_evento', data_inicio)
        .lte('data_evento', data_fim)
        .not('total_liquido', 'is', null)
        .then((result) => result.data || []),

      // 3. Período para clientes E faturamento adicional + SEM LIMITE
      supabase
        .from('periodo')
        .select('dt_gerencial, pessoas, vr_pagamentos, vr_couvert, cli_cel')
        .eq('bar_id', parseInt(bar_id))
        .gte('dt_gerencial', data_inicio)
        .lte('dt_gerencial', data_fim)
        .then((result) => result.data || []),
    ]);

    const sympla = symplaResult as any;
    const periodo = periodoResult as any;

    
    // BUSCAR DADOS YUZER (igual ao dashboard diário) + COM PAGINAÇÃO
    const buscarTodosYuzerBar = async () => {
      let todosYuzerBar: YuzerData[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('yuzer_analitico')
          .select('data_pedido, valor_total, pedido_id, produto_nome')
          .eq('bar_id', parseInt(bar_id))
          .gte('data_pedido', data_inicio)
          .lte('data_pedido', data_fim)
          .not('produto_nome', 'ilike', '%ingresso%')
          .range(offset, offset + limit - 1);

        if (error) {
          console.error(
            `❌ Erro na paginação Yuzer Bar offset ${offset}:`,
            error
          );
          break;
        }

        if (data && data.length > 0) {
          todosYuzerBar = [...todosYuzerBar, ...(data as any)];
          if (data.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        } else {
          hasMore = false;
        }
      }

            return todosYuzerBar;
    };

    const buscarTodosYuzerIngressos = async () => {
      let todosYuzerIngressos: YuzerData[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('yuzer_analitico')
          .select('data_pedido, valor_total, pedido_id, produto_nome')
          .eq('bar_id', parseInt(bar_id))
          .gte('data_pedido', data_inicio)
          .lte('data_pedido', data_fim)
          .ilike('produto_nome', '%ingresso%')
          .range(offset, offset + limit - 1);

        if (error) {
          console.error(
            `❌ Erro na paginação Yuzer Ingressos offset ${offset}:`,
            error
          );
          break;
        }

        if (data && data.length > 0) {
          todosYuzerIngressos = [...todosYuzerIngressos, ...(data as any)];
          if (data.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        } else {
          hasMore = false;
        }
      }

            return todosYuzerIngressos;
    };

    const [yuzerBar, yuzerIngresso] = await Promise.all([
      buscarTodosYuzerBar(),
      buscarTodosYuzerIngressos(),
    ]);

    
    // Processar faturamento de TODAS as fontes (igual ao diário)
    // 1. ContaHub (pagamentos filtrados)
    const faturamento_periodo_real = pagamentos.reduce(
      (sum: number, item: PagamentoData) => {
        return sum + (parseFloat(item.liquido) || 0);
      },
      0
    );

    // 2. Bilheteria Sympla
    const faturamento_bilheteria = sympla.reduce(
      (sum: number, item: SymplaData) => {
        return sum + (parseFloat(item.total_liquido) || 0);
      },
      0
    );

    // 3. Yuzer Bar (faturamento bar)
    const faturamento_yuzer_bar = yuzerBar.reduce(
      (sum: number, item: YuzerData) => {
        return sum + (parseFloat(item.valor_total) || 0);
      },
      0
    );

    // 4. Yuzer Ingressos (faturamento ingressos)
    const faturamento_yuzer_ingressos = yuzerIngresso.reduce(
      (sum: number, item: YuzerData) => {
        return sum + (parseFloat(item.valor_total) || 0);
      },
      0
    );

    // 5. Couvert real da tabela período
    const couvert_real_periodo = periodo.reduce(
      (sum: number, item: PeriodoData) => {
        return sum + (parseFloat(item.vr_couvert) || 0);
      },
      0
    );

    
    // TOTAIS CONSOLIDADOS (igual ao diário)
    const faturamento_bar_sem_couvert =
      faturamento_periodo_real -
      couvert_real_periodo +
      faturamento_bilheteria;
    const bar_total = faturamento_bar_sem_couvert + faturamento_yuzer_bar;
    const couvert_total = couvert_real_periodo + faturamento_yuzer_ingressos;
    const faturamento_total = bar_total + couvert_total;

    
    // **CORREÇÃO IGUAL AO DIÁRIO: Usar pessoas_diario_corrigido quando possível**
    
    let clientes_pessoas_diario_total = 0;
    const diasSemanaArray: string[] = [];
    for (
      let d = new Date(data_inicio + 'T00:00:00');
      d <= new Date(data_fim + 'T00:00:00');
      d.setDate(d.getDate() + 1)
    ) {
      diasSemanaArray.push(d.toISOString().split('T')[0]);
    }

    for (const dia of diasSemanaArray) {
      try {
        const { data: pessoasData } = await supabase
          .from('pessoas_diario_corrigido')
          .select('total_pessoas_bruto')
          .eq('dt_gerencial', dia)
          .maybeSingle();

        if (pessoasData) {
          clientes_pessoas_diario_total +=
            pessoasData.total_pessoas_bruto || 0;
                  } else {
                    console.warn('Dados de pessoas não encontrados para a data');
                  }
      } catch (error) {
                console.error('Erro ao buscar dados de pessoas:', error);
              }
    }

    // Calcular clientes do ContaHub (soma pessoas apenas com vr_pagamentos > 0)
    const periodo_com_pagamento = periodo.filter(
      (item: PeriodoData) => parseFloat(item.vr_pagamentos || '0') > 0
    );
    const clientes_periodo_total = periodo_com_pagamento.reduce(
      (sum: number, item: PeriodoData) => sum + (parseInt(item.pessoas) || 0), 0
    );

    // Clientes Yuzer (apenas ingressos)
    const pedidos_unicos_yuzer_ingresso = [
      ...new Set(yuzerIngresso.map((y: YuzerData) => y.pedido_id)),
    ];
    const clientes_yuzer = pedidos_unicos_yuzer_ingresso.length;

    // Buscar TODAS as visitas Sympla do período
    // NOTE: A view `cliente_visitas` foi removida em abril/2026 durante a
    // centralização dos dados de clientes na matview `visitas`.
    // A query antiga usava colunas (`tipo_visita`, `pessoas_na_mesa`, `data_visita`)
    // que não existem mais, portanto já estava retornando vazio.
    // Mantemos a integração como placeholder para futura reintrodução via
    // tabela de eventos/sympla dedicada.
    const buscarTodasVisitasSympa = async (): Promise<VisitaSymplaData[]> => {
      return [];
    };

    const todasVisitasSymplaData = await buscarTodasVisitasSympa();

    const clientes_visitas_sympla = todasVisitasSymplaData.reduce(
      (sum: number, item: VisitaSymplaData) => {
        return sum + (parseInt(item.pessoas_na_mesa) || 0);
      },
      0
    );

    // **LÓGICA FINAL IGUAL AO DIÁRIO: Usar pessoas_diario_corrigido como base**
    let clientes_periodo = clientes_periodo_total;
    let clientesSource = 'periodo_com_pagamento';

    if (clientes_pessoas_diario_total > 0) {
      clientes_periodo = clientes_pessoas_diario_total;
      clientesSource = 'pessoas_diario_corrigido + yuzer + sympla';
          } else {
      clientes_periodo = clientes_periodo_total;
      clientesSource = 'periodo_com_pagamento';
          }

    const clientes_total =
      clientes_periodo + clientes_yuzer + clientes_visitas_sympla;

    
    // Distribuir nos dias da semana
    for (const dia of diasSemana) {
      // Distribuir faturamento por dia
      const pagamentos_dia = pagamentos.filter(
        (p: PagamentoData) => p.data_pagamento === dia.data
      );
      const sympla_dia = sympla.filter(
        (s: SymplaData) => s.data_evento === dia.data
      );
      const yuzer_bar_dia = yuzerBar.filter(
        (y: YuzerData) => y.data_pedido === dia.data
      );
      const yuzer_ingresso_dia = yuzerIngresso.filter(
        (y: YuzerData) => y.data_pedido === dia.data
      );
      const periodo_dia = periodo.filter(
        (p: PeriodoData) => p.dt_gerencial === dia.data
      );
      const visitas_sympla_dia = todasVisitasSymplaData.filter(
        (v: VisitaSymplaData) => v.data_visita === dia.data
      );

      const faturamento_periodo_dia = pagamentos_dia.reduce(
        (sum: number, item: PagamentoData) => sum + (parseFloat(item.liquido) || 0),
        0
      );
      const faturamento_bilheteria_dia = sympla_dia.reduce(
        (sum: number, item: SymplaData) =>
          sum + (parseFloat(item.total_liquido) || 0),
        0
      );
      const faturamento_yuzer_bar_dia = yuzer_bar_dia.reduce(
        (sum: number, item: YuzerData) =>
          sum + (parseFloat(item.valor_total) || 0),
        0
      );
      const faturamento_yuzer_ingressos_dia = yuzer_ingresso_dia.reduce(
        (sum: number, item: YuzerData) =>
          sum + (parseFloat(item.valor_total) || 0),
        0
      );
      const couvert_periodo_dia = periodo_dia.reduce(
        (sum: number, item: PeriodoData) =>
          sum + (parseFloat(item.vr_couvert) || 0),
        0
      );

      const bar_total_dia =
        faturamento_periodo_dia -
        couvert_periodo_dia +
        faturamento_bilheteria_dia +
        faturamento_yuzer_bar_dia;
      const couvert_total_dia =
        couvert_periodo_dia + faturamento_yuzer_ingressos_dia;
      dia.faturamento = bar_total_dia + couvert_total_dia;

      // **Distribuir clientes por dia (EXATAMENTE IGUAL AO DIÁRIO)**
      let clientes_base_dia = 0;
      let clientes_pessoas_diario_dia = 0;
      let clientesSourceDia = 'periodo_com_pagamento';

      // **CORREÇÃO IGUAL AO DIÁRIO: Buscar pessoas_diario_corrigido primeiro**
                  try {
        const { data: pessoasDataDia } = await supabase
          .from('pessoas_diario_corrigido')
          .select('total_pessoas_bruto')
          .eq('dt_gerencial', dia.data)
          .maybeSingle();

        if (pessoasDataDia) {
          clientes_pessoas_diario_dia =
            pessoasDataDia.total_pessoas_bruto || 0;
          clientesSourceDia = 'pessoas_diario_corrigido';
                  } else {
                    console.warn('Dados de pessoas não encontrados para o dia');
                  }
      } catch (error) {
                console.error('Erro ao buscar dados de pessoas do dia:', error);
              }

      // **LÓGICA FINAL IGUAL AO DIÁRIO**
      const periodo_com_pagamento_dia = periodo_dia.filter(
        (item: PeriodoData) => parseFloat(item.vr_pagamentos || '0') > 0
      );
      const clientes_periodo_dia = periodo_com_pagamento_dia.reduce(
        (sum: number, item: PeriodoData) => sum + (parseInt(item.pessoas) || 0), 0
      );

      if (clientes_pessoas_diario_dia > 0) {
        // Se há dados consolidados, usar eles COMO BASE
        clientes_base_dia = clientes_pessoas_diario_dia;
        clientesSourceDia = 'pessoas_diario_corrigido + yuzer + sympla';
              } else {
        clientes_base_dia = clientes_periodo_dia;
        clientesSourceDia = 'periodo_com_pagamento';
              }

      // Yuzer ingressos do dia
      const pedidos_unicos_yuzer_ingresso_dia = [
        ...new Set(yuzer_ingresso_dia.map((y: YuzerData) => y.pedido_id)),
      ];
      const clientes_yuzer_dia = pedidos_unicos_yuzer_ingresso_dia.length;

      // Visitas Sympla do dia (já filtradas)
      const clientes_visitas_sympla_dia = visitas_sympla_dia.reduce(
        (sum: number, item: VisitaSymplaData) => {
          return sum + (parseInt(item.pessoas_na_mesa) || 0);
        },
        0
      );

      // **SOMAR TODAS AS FONTES por dia (IGUAL AO DIÁRIO)**
      dia.clientes =
        clientes_base_dia + clientes_yuzer_dia + clientes_visitas_sympla_dia;

      // Log detalhado para debug
                              
      // Calcular ticket médio
      dia.ticketMedio = dia.clientes > 0 ? dia.faturamento / dia.clientes : 0;
    }

    // Log dos resultados por dia
    diasSemana.forEach(dia => {
      if (dia.faturamento > 0 || dia.clientes > 0) {
                console.log(`Dia ${dia.data}: Faturamento ${dia.faturamento}, Clientes ${dia.clientes}`);
              }
    });

    const totalFaturamento = diasSemana.reduce(
      (sum, dia) => sum + dia.faturamento,
      0
    );
    const totalClientes = diasSemana.reduce(
      (sum, dia) => sum + dia.clientes,
      0
    );

    
    const response = NextResponse.json({
      success: true,
      dados: diasSemana,
      totais: {
        faturamento: totalFaturamento,
        clientes: totalClientes,
        ticketMedio: totalClientes > 0 ? totalFaturamento / totalClientes : 0,
      },
      meta: {
        periodo: `${data_inicio} a ${data_fim}`,
        bar_id: parseInt(bar_id),
        fonte_faturamento: 'pagamentos_filtrado_igual_diario',
        fonte_clientes: 'periodo_filtrado_igual_diario',
        versao_corrigida: 'DOMINGO_V5_FINAL_NOVA_FUNCAO',
        timestamp: new Date().toISOString(),
        force_recompile: VERSAO_DOMINGO_CORRIGIDA,
      },
      debug_clientes: {
        periodo_total_registros: periodo.length,
        periodo_com_pagamento_registros: periodo_com_pagamento.length,
        total_pessoas: clientes_periodo,
        yuzer_ingressos_pedidos_unicos: clientes_yuzer,
        visitas_sympla_soma_pessoas: clientes_visitas_sympla,
        total_calculado: clientes_total,
        amostra_periodo: periodo.slice(0, 3).map((p: PeriodoData) => ({
          dt_gerencial: p.dt_gerencial,
          pessoas: p.pessoas,
          vr_pagamentos: p.vr_pagamentos,
          tem_pagamento: parseFloat(p.vr_pagamentos || '0') > 0,
        })),
      },
    });

    // Desabilitar cache completamente
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (dbError) {
    console.error('❌ Erro ao buscar dados do banco:', dbError);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao buscar dados do banco: ' + (dbError as Error).message,
      },
      { status: 500 }
    );
  }
}

// Exportar como GET para Next.js
export async function GET(request: NextRequest) {
  return getDashboardSemanalCorrigido(request);
}
