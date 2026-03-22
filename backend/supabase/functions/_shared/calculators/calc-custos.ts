/**
 * 💵 CALC-CUSTOS - Calculator de Custos e Despesas
 * 
 * Calcula custos de atração, couvert, comissão e cancelamentos.
 * Fontes: nibo_agendamentos, visitas, contahub_cancelamentos, eventos_base
 * 
 * @version 1.2.0 - Migração para domain tables (visitas)
 * @date 2026-03-21
 */

import { CalculatorInput, CalculatorResult, CustosResult } from './types.ts';

async function getCategoriasAtracao(
  supabase: any,
  barId: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('bar_categorias_custo')
    .select('nome_categoria')
    .eq('bar_id', barId)
    .eq('tipo', 'atracao')
    .eq('ativo', true);

  if (error) {
    throw new Error(`Erro ao buscar categorias atração bar ${barId}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`Config ausente: bar_categorias_custo tipo=atracao para bar_id=${barId}. Inserir config antes de calcular.`);
  }

  return data.map((row: any) => row.nome_categoria);
}

export async function calcCustos(
  input: CalculatorInput
): Promise<CalculatorResult<CustosResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate } = input;

  try {
    // 1. Buscar faturamento total para calcular % custo atração
    const { data: eventosData, error: eventosError } = await supabase
      .from('eventos_base')
      .select('real_r')
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

    const faturamentoTotal = (eventosData || []).reduce(
      (sum: number, item: any) => sum + (parseFloat(item.real_r) || 0), 0
    );

    // 2. Custo Atração do NIBO
    const categoriasAtracao = await getCategoriasAtracao(supabase, barId);

    const { data: niboAtracaoData, error: niboError } = await supabase
      .from('nibo_agendamentos')
      .select('valor')
      .eq('bar_id', barId)
      .eq('tipo', 'despesa')
      .eq('deletado', false)
      .in('categoria_nome', categoriasAtracao)
      .gte('data_competencia', startDate)
      .lte('data_competencia', endDate);

    if (niboError) {
      return {
        success: false,
        error: `Erro ao buscar NIBO: ${niboError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const custoAtracao = (niboAtracaoData || []).reduce(
      (sum: number, item: any) => sum + (parseFloat(item.valor) || 0), 0
    );
    const custoAtracaoFaturamento = faturamentoTotal > 0
      ? (custoAtracao / faturamentoTotal) * 100
      : 0;

    // 3. Cancelamentos
    const { data: cancelRows, error: cancelError } = await supabase
      .from('contahub_cancelamentos')
      .select('custototal')
      .eq('bar_id', barId)
      .gte('data', startDate)
      .lte('data', endDate);

    if (cancelError) {
      return {
        success: false,
        error: `Erro ao buscar cancelamentos: ${cancelError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const cancelamentos = (cancelRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.custototal) || 0), 0
    );

    // 4. Couvert e Comissão (vr_repique) - MIGRADO: visitas (domain table)
    const { data: couvertComissaoRows, error: couvertError } = await supabase
      .from('visitas')
      .select('valor_couvert, valor_repique')
      .eq('bar_id', barId)
      .gte('data_visita', startDate)
      .lte('data_visita', endDate);

    if (couvertError) {
      return {
        success: false,
        error: `Erro ao buscar couvert/comissão: ${couvertError.message}`,
        duration_ms: Date.now() - startTime,
      };
    }

    const couvertAtracoes = (couvertComissaoRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.valor_couvert) || 0), 0
    );
    const comissaoCartao = (couvertComissaoRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.valor_repique) || 0), 0
    );

    // 5. Atrações/Eventos = custoAtracao (já calculado do NIBO)
    const atracoesEventos = custoAtracao;

    return {
      success: true,
      data: {
        custo_atracao_faturamento: custoAtracaoFaturamento,
        couvert_atracoes: couvertAtracoes,
        comissao: comissaoCartao,
        atracoes_eventos: atracoesEventos,
        cancelamentos: cancelamentos,
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