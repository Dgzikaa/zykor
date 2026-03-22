/**
 * 👥 CALC-CLIENTES - Calculator de Métricas de Clientes
 * 
 * Calcula clientes ativos (base ativa 90 dias) e % de clientes novos.
 * Fontes: RPCs (calcular_metricas_clientes, get_count_base_ativa)
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

import { CalculatorInput, CalculatorResult, ClientesResult } from './types.ts';

export async function calcClientes(
  input: CalculatorInput
): Promise<CalculatorResult<ClientesResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate } = input;

  try {
    // 1. Calcular datas para período anterior (semana anterior)
    const dataInicioAtual = new Date(startDate + 'T00:00:00');
    const dataFimAtual = new Date(endDate + 'T00:00:00');
    const dataInicioAnterior = new Date(dataInicioAtual);
    dataInicioAnterior.setDate(dataInicioAtual.getDate() - 7);
    const dataFimAnterior = new Date(dataFimAtual);
    dataFimAnterior.setDate(dataFimAtual.getDate() - 7);

    const inicioAnteriorStr = dataInicioAnterior.toISOString().split('T')[0];
    const fimAnteriorStr = dataFimAnterior.toISOString().split('T')[0];

    let percClientesNovos: number | null = null;
    let clientesAtivosCalculado: number | null = null;

    // 2. Chamar stored procedure para métricas de clientes (% novos)
    const { data: metricas, error: metricasError } = await supabase.rpc('calcular_metricas_clientes', {
      p_bar_id: barId,
      p_data_inicio_atual: startDate,
      p_data_fim_atual: endDate,
      p_data_inicio_anterior: inicioAnteriorStr,
      p_data_fim_anterior: fimAnteriorStr
    });

    if (metricasError) {
      console.warn('Aviso ao calcular métricas de clientes:', metricasError.message);
    } else if (metricas && metricas[0]) {
      const resultado = metricas[0];
      const totalClientes = Number(resultado.total_atual) || 0;
      const novosClientes = Number(resultado.novos_atual) || 0;

      percClientesNovos = totalClientes > 0 ? (novosClientes / totalClientes) * 100 : 0;
    }

    // 3. Calcular 90 dias antes do fim do período para base ativa
    const dataRef = new Date(endDate + 'T00:00:00');
    const data90DiasAtras = new Date(dataRef);
    data90DiasAtras.setDate(dataRef.getDate() - 90);
    const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0];

    // 4. Usar get_count_base_ativa
    const { data: resultBaseAtiva, error: errorBaseAtiva } = await supabase.rpc('get_count_base_ativa', {
      p_bar_id: barId,
      p_data_inicio: data90DiasAtrasStr,
      p_data_fim: endDate
    });

    if (errorBaseAtiva) {
      console.warn('Aviso ao calcular base ativa:', errorBaseAtiva.message);
    } else if (resultBaseAtiva !== null) {
      clientesAtivosCalculado = Number(resultBaseAtiva) || 0;
    }

    return {
      success: true,
      data: {
        clientes_ativos: clientesAtivosCalculado,
        perc_clientes_novos: percClientesNovos !== null ? parseFloat(percClientesNovos.toFixed(2)) : null,
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
