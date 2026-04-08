/**
 * ⚙️ CALC-OPERACIONAL DEBUG - Versão para debug
 */

import { CalculatorInput, CalculatorResult, OperacionalResult } from './types.ts';

export async function calcOperacional(
  input: CalculatorInput
): Promise<CalculatorResult<OperacionalResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate } = input;

  try {
    // 1. Stockout semanal via RPC
    const { data: stockoutResult, error: stockoutError } = await supabase
      .rpc('calcular_stockout_semanal', {
        p_bar_id: barId,
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

    if (stockoutError) {
      return {
        success: false,
        error: `Erro ao calcular stockout: ${stockoutError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const stockoutBar = (stockoutResult || []).find((s: any) => s.categoria === 'Bebidas');
    const stockoutComidas = (stockoutResult || []).find((s: any) => s.categoria === 'Comidas');
    const stockoutDrinks = (stockoutResult || []).find((s: any) => s.categoria === 'Drinks');

    const stockoutBebidasCount = stockoutBar?.produtos_stockout || 0;
    const stockoutBebidasPerc = stockoutBar?.percentual_stockout || 0;
    const stockoutDrinksCount = stockoutDrinks?.produtos_stockout || 0;
    const stockoutDrinksPerc = stockoutDrinks?.percentual_stockout || 0;
    const stockoutComidasCount = stockoutComidas?.produtos_stockout || 0;
    const stockoutComidasPerc = stockoutComidas?.percentual_stockout || 0;

    // 2. Mix semanal - calcular diretamente dos eventos_base
    const { data: eventosParaMix, error: eventosError } = await supabase
      .from('eventos_base')
      .select('real_r, faturamento_bar, percent_b, percent_d, percent_c, percent_happy_hour')
      .eq('bar_id', barId)
      .gte('data_evento', startDate)
      .lte('data_evento', endDate)
      .eq('ativo', true)
      .gt('real_r', 0);

    if (eventosError) {
      return {
        success: false,
        error: `Erro ao buscar eventos para mix: ${eventosError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    let percBebidasPonderado = 0;
    let percDrinksPonderado = 0;
    let percComidaPonderado = 0;
    let percHappyHourPonderado = 0;

    if (eventosParaMix && eventosParaMix.length > 0) {
      const faturamentoTotal = eventosParaMix.reduce((acc: number, e: any) => {
        return acc + (parseFloat(String(e.faturamento_bar)) || 0);
      }, 0);

      if (faturamentoTotal > 0) {
        const somaBebidasPonderado = eventosParaMix.reduce((acc: number, e: any) => {
          const fat = parseFloat(String(e.faturamento_bar)) || 0;
          const perc = parseFloat(String(e.percent_b)) || 0;
          return acc + (perc * fat);
        }, 0);

        const somaDrinksPonderado = eventosParaMix.reduce((acc: number, e: any) => {
          const fat = parseFloat(String(e.faturamento_bar)) || 0;
          const perc = parseFloat(String(e.percent_d)) || 0;
          return acc + (perc * fat);
        }, 0);

        const somaComidaPonderado = eventosParaMix.reduce((acc: number, e: any) => {
          const fat = parseFloat(String(e.faturamento_bar)) || 0;
          const perc = parseFloat(String(e.percent_c)) || 0;
          return acc + (perc * fat);
        }, 0);

        const somaHappyHourPonderado = eventosParaMix.reduce((acc: number, e: any) => {
          const fat = parseFloat(String(e.faturamento_bar)) || 0;
          const perc = parseFloat(String(e.percent_happy_hour)) || 0;
          return acc + (perc * fat);
        }, 0);

        percBebidasPonderado = somaBebidasPonderado / faturamentoTotal;
        percDrinksPonderado = somaDrinksPonderado / faturamentoTotal;
        percComidaPonderado = somaComidaPonderado / faturamentoTotal;
        percHappyHourPonderado = somaHappyHourPonderado / faturamentoTotal;
      }
    }

    // 3. Tempos de saída via RPC
    const { data: tempoSaidaResult, error: tempoError } = await supabase
      .rpc('calcular_tempo_saida', {
        p_bar_id: barId,
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

    if (tempoError) {
      return {
        success: false,
        error: `Erro ao calcular tempo saída: ${tempoError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const tempoSaidaBar = (tempoSaidaResult && tempoSaidaResult[0] && tempoSaidaResult[0].tempo_bar_minutos) || 0;
    const tempoSaidaCozinha = (tempoSaidaResult && tempoSaidaResult[0] && tempoSaidaResult[0].tempo_cozinha_minutos) || 0;

    // 4. Atrasinhos direto de contahub_tempo (filtrar outliers > 60 min)
    const { data: atrasinhosData, error: atrasinhosError } = await supabase
      .from('contahub_tempo')
      .select('categoria, tempo_final')
      .eq('bar_id', barId)
      .gte('data', startDate)
      .lte('data', endDate)
      .gt('tempo_final', 0)
      .lte('tempo_final', 60);

    if (atrasinhosError) {
      return {
        success: false,
        error: `Erro ao buscar atrasinhos: ${atrasinhosError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    // Atrasinhos: 5-10 min para bar, 15-20 min para cozinha
    const atrasinhosBar = (atrasinhosData || []).filter((item: any) => 
      (item.categoria === 'bebida' || item.categoria === 'drink') && 
      item.tempo_final > 5 && item.tempo_final <= 10
    ).length;
    
    const atrasinhosCozinha = (atrasinhosData || []).filter((item: any) => 
      item.categoria === 'comida' && 
      item.tempo_final > 15 && item.tempo_final <= 20
    ).length;
    
    // Atraso (não usado no cálculo de atrasos_bar/cozinha, apenas para referência)
    const atrasoBar = 0;
    const atrasoCozinha = 0;

    // 5. Atrasos via RPC
    const { data: atrasosResult, error: atrasosError } = await supabase
      .rpc('calcular_atrasos_tempo', {
        p_bar_id: barId,
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

    if (atrasosError) {
      return {
        success: false,
        error: `Erro ao calcular atrasos: ${atrasosError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    let atrasosBarCount = 0;
    let atrasosCozinhaCount = 0;
    let qtdeItensBar = 0;
    let qtdeItensCozinha = 0;

    if (atrasosResult && atrasosResult.length > 0) {
      const atrasos = atrasosResult[0];
      qtdeItensBar = atrasos.qtde_itens_bar || 0;
      qtdeItensCozinha = atrasos.qtde_itens_cozinha || 0;
      atrasosBarCount = atrasos.atrasos_bar || 0;
      atrasosCozinhaCount = atrasos.atrasos_cozinha || 0;
    }

    const atrasosBarPerc = qtdeItensBar > 0 ? (atrasosBarCount / qtdeItensBar) * 100 : 0;
    const atrasosCozinhaPerc = qtdeItensCozinha > 0 ? (atrasosCozinhaCount / qtdeItensCozinha) * 100 : 0;
    const atrasinhosBarPerc = qtdeItensBar > 0 ? (atrasinhosBar / qtdeItensBar) * 100 : 0;
    const atrasinhosCozinhaPerc = qtdeItensCozinha > 0 ? (atrasinhosCozinha / qtdeItensCozinha) * 100 : 0;

    return {
      success: true,
      data: {
        stockout_bar: stockoutBebidasCount,
        stockout_bar_perc: stockoutBebidasPerc,
        stockout_drinks: stockoutDrinksCount,
        stockout_drinks_perc: stockoutDrinksPerc,
        stockout_comidas: stockoutComidasCount,
        stockout_comidas_perc: stockoutComidasPerc,
        perc_bebidas: percBebidasPonderado,
        perc_drinks: percDrinksPonderado,
        perc_comida: percComidaPonderado,
        perc_happy_hour: percHappyHourPonderado,
        tempo_saida_bar: tempoSaidaBar,
        tempo_saida_cozinha: tempoSaidaCozinha,
        qtde_itens_bar: qtdeItensBar,
        qtde_itens_cozinha: qtdeItensCozinha,
        atrasinhos_bar: atrasinhosBar,
        atrasinhos_bar_perc: atrasinhosBarPerc,
        atrasinhos_cozinha: atrasinhosCozinha,
        atrasinhos_cozinha_perc: atrasinhosCozinhaPerc,
        atraso_bar: atrasoBar,
        atraso_cozinha: atrasoCozinha,
        atrasos_bar: atrasosBarCount,
        atrasos_cozinha: atrasosCozinhaCount,
        atrasos_bar_perc: atrasosBarPerc,
        atrasos_cozinha_perc: atrasosCozinhaPerc,
      },
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - startTime,
    };
  }
}
