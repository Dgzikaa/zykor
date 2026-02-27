import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Interface para tipagem dos dados de tempo
interface TempoData {
  prd_desc: string;
  grp_desc: string;
  loc_desc: string;
  t0_t1: number | null;
  t0_t2: number | null;
  t0_t3: number | null;
  t1_t2: number | null;
  t1_t3: number | null;
  t2_t3: number | null;
  itm_qtd: string | number;
  dia: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const bar_id = searchParams.get('bar_id');

    if (!data_inicio || !data_fim || !bar_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetros obrigatórios: data_inicio, data_fim, bar_id',
        },
        { status: 400 }
      );
    }

    console.log('⏱️ API Tempos Médios - Parâmetros recebidos:', {
      data_inicio,
      data_fim,
      bar_id,
    });

    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.error('❌ Erro ao conectar com banco');
      return NextResponse.json(
        { success: false, error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    try {
      // Converter datas para formato YYYYMMDD para busca na tabela tempo
      const dataInicioInt = parseInt(data_inicio.replace(/-/g, ''));
      const dataFimInt = parseInt(data_fim.replace(/-/g, ''));

      console.log('📅 Buscando tempos no período:', {
        data_inicio_int: dataInicioInt,
        data_fim_int: dataFimInt,
      });

      // Buscar dados da tabela tempo
      const { data: temposData, error: temposError } = await supabase
        .from('tempo')
        .select(
          `
          prd_desc,
          grp_desc,
          loc_desc,
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
        .eq('bar_id', parseInt(bar_id))
        .gte('dia', dataInicioInt)
        .lte('dia', dataFimInt)
        .not('prd_desc', 'is', null);

      if (temposError) {
        console.error('❌ Erro ao buscar dados de tempo:', temposError);
        return NextResponse.json(
          {
            success: false,
            error: 'Erro ao buscar dados de tempo: ' + temposError.message,
          },
          { status: 500 }
        );
      }

      console.log(
        `📊 Registros de tempo encontrados: ${temposData?.length || 0}`
      );

      if (!temposData || temposData.length === 0) {
        return NextResponse.json({
          success: true,
          tempos: {
            tempo_medio_cozinha: 0,
            tempo_medio_bar: 0,
            tempo_medio_geral: 0,
            total_pedidos: 0,
            pedidos_cozinha: 0,
            pedidos_bar: 0,
          },
          meta: {
            periodo: `${data_inicio} a ${data_fim}`,
            bar_id: parseInt(bar_id),
            registros_encontrados: 0,
            observacao: 'Nenhum dado encontrado para o período',
          },
        });
      }

      // Função para classificar produtos como cozinha ou bar
      const isComida = (produto: string, grupo: string): boolean => {
        const produtoLower = produto.toLowerCase();
        const grupoLower = grupo?.toLowerCase() || '';

        const palavrasComida = [
          'pizza',
          'hambur',
          'sanduich',
          'batata',
          'frango',
          'carne',
          'peixe',
          'salada',
          'prato',
          'entrada',
          'petisco',
          'lanche',
          'comida',
          'porção',
          'caldinho',
          'caldo',
          'sopa',
          'risoto',
          'massa',
          'lasanha',
          'nhoque',
        ];

        const gruposComida = [
          'pratos',
          'lanches',
          'entradas',
          'petiscos',
          'pizzas',
          'hamburgers',
          'sanduiches',
          'saladas',
          'massas',
          'risotos',
          'carnes',
          'peixes',
          'frango',
          'porções',
          'comidas',
        ];

        return (
          palavrasComida.some(palavra => produtoLower.includes(palavra)) ||
          gruposComida.some(grupo => grupoLower.includes(grupo))
        );
      };

      const isBebida = (produto: string, grupo: string): boolean => {
        const produtoLower = produto.toLowerCase();
        const grupoLower = grupo?.toLowerCase() || '';

        const palavrasBebida = [
          'cerveja',
          'chopp',
          'vinho',
          'caipirinha',
          'drink',
          'coquetel',
          'refrigerante',
          'suco',
          'água',
          'café',
          'whisky',
          'vodka',
          'gin',
          'cachaça',
          'rum',
          'tequila',
          'licor',
          'espumante',
          'champagne',
        ];

        const gruposBebida = [
          'bebidas',
          'cervejas',
          'vinhos',
          'drinks',
          'coquetéis',
          'refrigerantes',
          'sucos',
          'águas',
          'cafés',
          'destilados',
          'licores',
          'espumantes',
        ];

        return (
          palavrasBebida.some(palavra => produtoLower.includes(palavra)) ||
          gruposBebida.some(grupo => grupoLower.includes(grupo))
        );
      };

      // Processar dados e calcular tempos médios
      const temposCozinha: number[] = [];
      const temposBar: number[] = [];
      let pedidosCozinha = 0;
      let pedidosBar = 0;

      temposData.forEach((item: any) => {
        const produto = item.prd_desc || '';
        const grupo = item.grp_desc || '';
        const quantidade = parseInt(String(item.itm_qtd) || '1');

        let tempo = 0;
        let isValidTempo = false;

        // Deboche (bar_id 4): usar t0_t2 para tudo
        const isDeboche = parseInt(bar_id) === 4;

        if (isDeboche) {
          // Deboche: usar t0_t2 (lançamento até fim produção) para tudo
          if (item.t0_t2 && item.t0_t2 > 0 && item.t0_t2 <= 2700) {
            tempo = item.t0_t2;
            isValidTempo = true;
            if (isComida(produto, grupo)) {
              pedidosCozinha += quantidade;
            } else if (isBebida(produto, grupo)) {
              pedidosBar += quantidade;
            } else {
              pedidosCozinha += quantidade;
            }
          }
        } else {
          // Ordinário: lógica original
          if (isComida(produto, grupo)) {
            // Para comidas: usar t1_t2 (início produção até fim produção)
            if (item.t1_t2 && item.t1_t2 > 0 && item.t1_t2 <= 2700) {
              tempo = item.t1_t2;
              isValidTempo = true;
              pedidosCozinha += quantidade;
            }
          } else if (isBebida(produto, grupo)) {
            // Para bebidas: usar t0_t3 (lançamento até entrega)
            if (item.t0_t3 && item.t0_t3 > 0 && item.t0_t3 <= 1200) {
              tempo = item.t0_t3;
              isValidTempo = true;
              pedidosBar += quantidade;
            }
          } else {
            // Para produtos indefinidos: tentar t1_t2 como fallback
            if (item.t1_t2 && item.t1_t2 > 0 && item.t1_t2 <= 3600) {
              tempo = item.t1_t2;
              isValidTempo = true;
              pedidosCozinha += quantidade;
            }
          }
        }

        // Adicionar tempo válido aos arrays correspondentes
        if (isValidTempo && tempo > 0) {
          if (isComida(produto, grupo) || !isBebida(produto, grupo)) {
            temposCozinha.push(tempo);
          } else {
            temposBar.push(tempo);
          }
        }
      });

      // Calcular médias
      const tempoMedioCozinha =
        temposCozinha.length > 0
          ? Math.round(
              temposCozinha.reduce((a, b) => a + b, 0) / temposCozinha.length
            )
          : 0;

      const tempoMedioBar =
        temposBar.length > 0
          ? Math.round(temposBar.reduce((a, b) => a + b, 0) / temposBar.length)
          : 0;

      const todosTempos = [...temposCozinha, ...temposBar];
      const tempoMedioGeral =
        todosTempos.length > 0
          ? Math.round(
              todosTempos.reduce((a, b) => a + b, 0) / todosTempos.length
            )
          : 0;

      const tempos = {
        tempo_medio_cozinha: tempoMedioCozinha,
        tempo_medio_bar: tempoMedioBar,
        tempo_medio_geral: tempoMedioGeral,
        total_pedidos: pedidosCozinha + pedidosBar,
        pedidos_cozinha: pedidosCozinha,
        pedidos_bar: pedidosBar,
      };

      console.log('⏱️ Tempos calculados:', tempos);

      return NextResponse.json({
        success: true,
        tempos,
        meta: {
          periodo: `${data_inicio} a ${data_fim}`,
          bar_id: parseInt(bar_id),
          registros_processados: temposData.length,
          tempos_validos_cozinha: temposCozinha.length,
          tempos_validos_bar: temposBar.length,
          criterios: {
            comidas: 't1_t2 (início até fim produção), max 45min',
            bebidas: 't0_t3 (lançamento até entrega), max 20min',
            indefinidos: 't1_t2 como fallback, max 60min',
          },
        },
      });
    } catch (dbError) {
      console.error('❌ Erro ao buscar tempos do banco:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao buscar tempos: ' + (dbError as Error).message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Erro na API Tempos Médios:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor: ' + (error as Error).message,
      },
      { status: 500 }
    );
  }
}
