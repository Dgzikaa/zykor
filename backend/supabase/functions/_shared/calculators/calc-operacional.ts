/**
 * ⚙️ CALC-OPERACIONAL - Calculator de Métricas Operacionais
 * 
 * Calcula stockout, mix de vendas, tempos de saída e atrasos.
 * Fontes: RPCs (calcular_stockout_semanal, calcular_mix_vendas, 
 *         calcular_tempo_saida, calcular_atrasos_tempo), eventos_base
 * 
 * @version 1.0.0
 * @date 2026-03-19
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

    // Mapear resultados: Bar → stockout_bar, Comidas → stockout_comidas, Drinks/Salao → stockout_drinks
    const stockoutBar = (stockoutResult || []).find((s: any) => s.categoria === 'Bar');
    const stockoutComidas = (stockoutResult || []).find((s: any) => s.categoria === 'Comidas');
    const stockoutDrinks = (stockoutResult || []).find((s: any) => s.categoria === 'Drinks' || s.categoria === 'Salao');

    const stockoutBebidasCount = stockoutBar?.produtos_stockout || 0;
    const stockoutBebidasPerc = stockoutBar?.percentual_stockout || 0;
    const stockoutDrinksCount = stockoutDrinks?.produtos_stockout || 0;
    const stockoutDrinksPerc = stockoutDrinks?.percentual_stockout || 0;
    const stockoutComidasCount = stockoutComidas?.produtos_stockout || 0;
    const stockoutComidasPerc = stockoutComidas?.percentual_stockout || 0;

    // 2. Mix semanal via RPC
    const { data: mixResult, error: mixError } = await supabase
      .rpc('calcular_mix_vendas', {
        p_bar_id: barId,
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

    if (mixError) {
      return {
        success: false,
        error: `Erro ao calcular mix: ${mixError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    let percBebidasPonderado = 0;
    let percDrinksPonderado = 0;
    let percComidaPonderado = 0;
    let percHappyHourPonderado = 0;

    if (mixResult && mixResult.length > 0) {
      const mix = mixResult[0];
      percBebidasPonderado = parseFloat(mix.perc_bebidas) || 0;
      percDrinksPonderado = parseFloat(mix.perc_drinks) || 0;
      percComidaPonderado = parseFloat(mix.perc_comidas) || 0;
      percHappyHourPonderado = parseFloat(mix.perc_happy_hour) || 0;
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

    const tempoSaidaBar = tempoSaidaResult?.[0]?.tempo_bar_minutos || 0;
    const tempoSaidaCozinha = tempoSaidaResult?.[0]?.tempo_cozinha_minutos || 0;

    // 4. Atrasinhos do eventos_base (agregado por evento)
    const { data: eventosTempoData, error: eventosError } = await supabase
      .from('eventos_base')
      .select('atrasinho_cozinha, atrasinho_bar, atrasao_cozinha, atrasao_bar')
      .eq('bar_id', barId)
      .gte('data_evento', startDate)
      .lte('data_evento', endDate)
      .eq('ativo', true);

    if (eventosError) {
      return {
        success: false,
        error: `Erro ao buscar eventos tempo: ${eventosError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const atrasinhosBar = (eventosTempoData || []).reduce((sum: number, e: any) => sum + (parseInt(e.atrasinho_bar) || 0), 0);
    const atrasinhosCozinha = (eventosTempoData || []).reduce((sum: number, e: any) => sum + (parseInt(e.atrasinho_cozinha) || 0), 0);
    const atrasoBar = (eventosTempoData || []).reduce((sum: number, e: any) => sum + (parseInt(e.atrasao_bar) || 0), 0);
    const atrasoCozinha = (eventosTempoData || []).reduce((sum: number, e: any) => sum + (parseInt(e.atrasao_cozinha) || 0), 0);

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
