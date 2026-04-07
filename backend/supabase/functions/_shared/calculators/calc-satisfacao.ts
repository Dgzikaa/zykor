/**
 * ⭐ CALC-SATISFACAO - Calculator de Satisfação do Cliente
 * 
 * Calcula métricas de satisfação: Google Reviews e NPS.
 * Fontes: RPCs (get_google_reviews_stars_by_date, calcular_nps_semanal_por_pesquisa),
 *         nps_agregado_semanal
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

import { CalculatorInput, CalculatorResult, SatisfacaoResult } from './types.ts';

export async function calcSatisfacao(
  input: CalculatorInput
): Promise<CalculatorResult<SatisfacaoResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate, semana } = input;

  try {
    // 1. Google Reviews semanal via RPC
    const { data: googleRows, error: googleError } = await supabase
      .rpc('get_google_reviews_stars_by_date', {
        p_bar_id: barId,
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

    if (googleError) {
      return {
        success: false,
        error: `Erro ao buscar Google Reviews: ${googleError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const avaliacoes5 = (googleRows || []).filter((g: any) => Number(g.stars) === 5).length;
    const mediaGoogle = (googleRows && googleRows.length > 0)
      ? googleRows.reduce((sum: number, g: any) => sum + (Number(g.stars) || 0), 0) / googleRows.length
      : 0;

    // 2. NPS semanal da tabela nps_agregado_semanal
    const ano = semana?.ano || new Date(startDate).getFullYear();
    const numeroSemana = semana?.numero_semana;

    let npsGeral: number | null = null;
    // 🔒 nps_reservas é MANUAL - não calculamos aqui, retornamos null para não sobrescrever
    let npsReservas: number | null = null;

    if (numeroSemana) {
      const { data: npsAgregado, error: npsError } = await supabase
        .from('nps_agregado_semanal')
        .select('nps_geral')
        .eq('bar_id', barId)
        .eq('ano', String(ano))
        .eq('numero_semana', numeroSemana)
        .maybeSingle();

      if (npsError) {
        return {
          success: false,
          error: `Erro ao buscar NPS agregado: ${npsError.message}`,
          duration_ms: Date.now() - startTime,
        };
      }

      npsGeral = npsAgregado?.nps_geral ?? null;
      // nps_reservas permanece null - campo manual preenchido pelo time de marketing
    }

    // 3. NPS por pesquisa via RPC (Falaê: NPS Digital, Salão)
    const { data: npsPorPesquisa, error: npsPorPesquisaError } = await supabase
      .rpc('calcular_nps_semanal_por_pesquisa', {
        p_bar_id: barId,
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

    if (npsPorPesquisaError) {
      console.warn('Aviso ao buscar NPS por pesquisa:', npsPorPesquisaError.message);
    }

    const npsDigitalData = (npsPorPesquisa || []).find((p: any) => p.search_name === 'NPS Digital');
    const npsSalaoData = (npsPorPesquisa || []).find((p: any) => p.search_name === 'Salão');

    const npsDigital = npsDigitalData?.nps_score ?? null;
    const npsSalao = npsSalaoData?.nps_score ?? null;
    const npsDigitalRespostas = npsDigitalData?.total_respostas ?? 0;
    const npsSalaoRespostas = npsSalaoData?.total_respostas ?? 0;
    // 🔒 nps_reservas_respostas é MANUAL - retornamos null para não sobrescrever
    const npsReservasRespostas = null;

    return {
      success: true,
      data: {
        avaliacoes_5_google_trip: avaliacoes5,
        media_avaliacoes_google: mediaGoogle,
        nps_geral: npsGeral,
        nps_reservas: npsReservas, // null - campo manual
        nps_digital: npsDigital,
        nps_salao: npsSalao,
        nps_digital_respostas: npsDigitalRespostas,
        nps_salao_respostas: npsSalaoRespostas,
        nps_reservas_respostas: npsReservasRespostas, // null - campo manual
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
