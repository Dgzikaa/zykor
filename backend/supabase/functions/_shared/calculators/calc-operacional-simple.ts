/**
 * ⚙️ CALC-OPERACIONAL SIMPLE - Versão simplificada para teste
 */

import { CalculatorInput, CalculatorResult, OperacionalResult } from './types.ts';

export async function calcOperacional(
  input: CalculatorInput
): Promise<CalculatorResult<OperacionalResult>> {
  const startTime = Date.now();

  try {
    // Retornar valores zerados por enquanto
    return {
      success: true,
      data: {
        stockout_bar: 0,
        stockout_bar_perc: 0,
        stockout_drinks: 0,
        stockout_drinks_perc: 0,
        stockout_comidas: 0,
        stockout_comidas_perc: 0,
        perc_bebidas: 0,
        perc_drinks: 0,
        perc_comida: 0,
        perc_happy_hour: 0,
        tempo_saida_bar: 0,
        tempo_saida_cozinha: 0,
        qtde_itens_bar: 0,
        qtde_itens_cozinha: 0,
        atrasinhos_bar: 0,
        atrasinhos_bar_perc: 0,
        atrasinhos_cozinha: 0,
        atrasinhos_cozinha_perc: 0,
        atraso_bar: 0,
        atraso_cozinha: 0,
        atrasos_bar: 0,
        atrasos_cozinha: 0,
        atrasos_bar_perc: 0,
        atrasos_cozinha_perc: 0,
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
