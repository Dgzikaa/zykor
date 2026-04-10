/**
 * 📊 CALC-DISTRIBUICAO - Calculator de Distribuição de Faturamento
 * 
 * Calcula distribuição de faturamento por horário e dia da semana.
 * Fontes: faturamento_hora, eventos_base
 * 
 * @version 1.1.0 - Migração para domain tables (faturamento_hora)
 * @date 2026-03-21
 */

import { CalculatorInput, CalculatorResult, DistribuicaoResult } from './types.ts';

export async function calcDistribuicao(
  input: CalculatorInput
): Promise<CalculatorResult<DistribuicaoResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate } = input;

  try {
    // 1. % Faturamento até 19h e após 22h - MIGRADO: faturamento_hora (domain table)
    const { data: fatHoraRows, error: fatHoraError } = await supabase
      .from('faturamento_hora')
      .select('hora, valor')
      .eq('bar_id', barId)
      .gte('data_venda', startDate)
      .lte('data_venda', endDate);

    if (fatHoraError) {
      return {
        success: false,
        error: `Erro ao buscar faturamento por hora: ${fatHoraError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    let fatAte19h = 0;
    let fatApos22h = 0;
    let fatTotalHora = 0;

    for (const row of fatHoraRows || []) {
      const hora = parseInt(row.hora) || 0;
      const valor = parseFloat(row.valor) || 0;
      fatTotalHora += valor;
      
      // Até 19h: APENAS 16h, 17h e 18h (igual ao Excel)
      if (hora === 16 || hora === 17 || hora === 18) fatAte19h += valor;
      
      // Após 22h: inclui 22h-23h + madrugada 0h-5h
      if (hora >= 22 || hora <= 5) fatApos22h += valor;
    }

    // Usar fatTotalHora (base do Excel) ao invés de eventos_base.real_r
    const percFatAte19h = fatTotalHora > 0 ? (fatAte19h / fatTotalHora) * 100 : null;
    const percFatApos22h = fatTotalHora > 0 ? (fatApos22h / fatTotalHora) * 100 : 0;

    // 2. Faturamento por dia da semana (usando eventos_base.real_r)
    const { data: eventosData, error: eventosError } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r')
      .eq('bar_id', barId)
      .gte('data_evento', startDate)
      .lte('data_evento', endDate)
      .eq('ativo', true);

    if (eventosError) {
      return {
        success: false,
        error: `Erro ao buscar eventos: ${eventosError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    // Ordinário: Qui+Sab+Dom | Deboche: Ter+Qua+Qui e Sex+Sab
    let quiSabDom = 0;
    let terQuaQui = 0;
    let sexSab = 0;

    for (const evento of eventosData || []) {
      const dataEvento = evento.data_evento;
      if (!dataEvento) continue;

      const d = new Date(dataEvento + 'T12:00:00Z');
      const dia = d.getUTCDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
      const valor = parseFloat(evento.real_r) || 0;

      // Ordinário: Qui(4), Sab(6), Dom(0) - NÃO inclui Sexta(5)
      if (dia === 4 || dia === 6 || dia === 0) {
        quiSabDom += valor;
      }
      // Deboche: Ter(2), Qua(3), Qui(4)
      if (dia === 2 || dia === 3 || dia === 4) {
        terQuaQui += valor;
      }
      // Deboche: Sex(5), Sab(6)
      if (dia === 5 || dia === 6) {
        sexSab += valor;
      }
    }

    return {
      success: true,
      data: {
        perc_faturamento_ate_19h: percFatAte19h,
        perc_faturamento_apos_22h: percFatApos22h,
        qui_sab_dom: quiSabDom,
        ter_qua_qui: terQuaQui,
        sex_sab: sexSab,
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