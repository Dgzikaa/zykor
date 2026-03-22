/**
 * 💰 CALC-FATURAMENTO - Calculator de Faturamento e Métricas Base
 * 
 * Calcula métricas de faturamento a partir de eventos_base.
 * Fonte canônica: eventos_base (real_r, faturamento_entrada, faturamento_bar)
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

import { CalculatorInput, CalculatorResult, FaturamentoResult } from './types.ts';

export async function calcFaturamento(
  input: CalculatorInput
): Promise<CalculatorResult<FaturamentoResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate } = input;

  try {
    const { data: eventosData, error } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r, cl_real, m1_r, res_tot, res_p, num_mesas_tot, num_mesas_presentes, faturamento_entrada, faturamento_bar')
      .eq('bar_id', barId)
      .gte('data_evento', startDate)
      .lte('data_evento', endDate)
      .eq('ativo', true);

    if (error) {
      return {
        success: false,
        error: `Erro ao buscar eventos: ${error.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const eventos = eventosData || [];

    const faturamentoTotal = eventos.reduce((sum: number, item: any) => sum + (parseFloat(item.real_r) || 0), 0);
    const faturamentoEntrada = eventos.reduce((sum: number, item: any) => sum + (parseFloat(item.faturamento_entrada) || 0), 0);
    const faturamentoBar = eventos.reduce((sum: number, item: any) => sum + (parseFloat(item.faturamento_bar) || 0), 0);
    const clientesAtendidos = eventos.reduce((sum: number, item: any) => sum + (parseInt(item.cl_real) || 0), 0);
    const ticketMedio = clientesAtendidos > 0 ? faturamentoTotal / clientesAtendidos : 0;
    const tmEntrada = clientesAtendidos > 0 ? faturamentoEntrada / clientesAtendidos : 0;
    const tmBar = clientesAtendidos > 0 ? faturamentoBar / clientesAtendidos : 0;
    const metaSemanal = eventos.reduce((sum: number, item: any) => sum + (parseFloat(item.m1_r) || 0), 0);
    const reservasTotais = eventos.reduce((sum: number, item: any) => sum + (parseInt(item.res_tot) || 0), 0);
    const reservasPresentes = eventos.reduce((sum: number, item: any) => sum + (parseInt(item.res_p) || 0), 0);
    const mesasTotais = eventos.reduce((sum: number, item: any) => sum + (parseInt(item.num_mesas_tot) || 0), 0);
    const mesasPresentes = eventos.reduce((sum: number, item: any) => sum + (parseInt(item.num_mesas_presentes) || 0), 0);

    return {
      success: true,
      data: {
        faturamento_total: faturamentoTotal,
        faturamento_entrada: faturamentoEntrada,
        faturamento_bar: faturamentoBar,
        clientes_atendidos: clientesAtendidos,
        ticket_medio: ticketMedio,
        tm_entrada: tmEntrada,
        tm_bar: tmBar,
        meta_semanal: metaSemanal,
        mesas_totais: mesasTotais,
        mesas_presentes: mesasPresentes,
        reservas_totais: reservasTotais,
        reservas_presentes: reservasPresentes,
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
