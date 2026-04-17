/**
 * CALC-CUSTOS - Calculator de Custos e Despesas
 * 
 * Calcula custos de atracao, couvert, comissao e cancelamentos.
 * Fontes: contaazul_lancamentos, visitas, bronze_contahub_vendas_cancelamentos, eventos_base
 * 
 * @version 2.0.0 - Migracao NIBO -> Conta Azul
 * @date 2026-03-24
 */

import { CalculatorInput, CalculatorResult, CustosResult } from './types.ts';

async function getCategoriasAtracao(
  supabase: any,
  barId: number
): Promise<string[]> {
  const { data, error } = await supabase
    .schema('operations')
    .from('bar_categorias_custo')
    .select('nome_categoria')
    .eq('bar_id', barId)
    .eq('tipo', 'atracao')
    .eq('ativo', true);

  if (error) {
    throw new Error('Erro ao buscar categorias atracao bar ' + barId + ': ' + error.message);
  }

  if (!data || data.length === 0) {
    throw new Error('Config ausente: bar_categorias_custo tipo=atracao para bar_id=' + barId + '. Inserir config antes de calcular.');
  }

  return data.map((row: any) => row.nome_categoria);
}

async function getCustoAtracao(
  supabase: any,
  barId: number,
  startDate: string,
  endDate: string,
  categoriasAtracao: string[]
): Promise<{ valor: number; count: number }> {
  const { data, error } = await supabase
    .schema('integrations')
    .from('contaazul_lancamentos')
    .select('valor_bruto')
    .eq('bar_id', barId)
    .eq('tipo', 'DESPESA')
    .in('categoria_nome', categoriasAtracao)
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate);

  if (error) {
    console.warn('[calc-custos] Erro ao buscar lancamentos:', error.message);
    return { valor: 0, count: 0 };
  }

  const items = data || [];
  const valor = items.reduce(
    (sum: number, item: any) => sum + (parseFloat(item.valor_bruto) || 0), 0
  );

  return { valor, count: items.length };
}

export async function calcCustos(
  input: CalculatorInput
): Promise<CalculatorResult<CustosResult>> {
  const startTime = Date.now();
  const { supabase, barId, startDate, endDate } = input;

  try {
    // 1. Buscar faturamento total para calcular % custo atracao
    const { data: eventosData, error: eventosError } = await supabase
      .schema('operations')
      .from('eventos_base')
      .select('real_r')
      .eq('bar_id', barId)
      .gte('data_evento', startDate)
      .lte('data_evento', endDate)
      .eq('ativo', true);

    if (eventosError) {
      return {
        success: false,
        error: 'Erro ao buscar eventos: ' + eventosError.message,
        duration_ms: Date.now() - startTime,
      };
    }

    const faturamentoTotal = (eventosData || []).reduce(
      (sum: number, item: any) => sum + (parseFloat(item.real_r) || 0), 0
    );

    // 2. Custo Atracao - via contaazul_lancamentos
    const categoriasAtracao = await getCategoriasAtracao(supabase, barId);

    let custoAtracao = 0;

    const result = await getCustoAtracao(supabase, barId, startDate, endDate, categoriasAtracao);
    custoAtracao = result.valor;
    console.log('[calc-custos] Custo atracao: R$' + custoAtracao.toFixed(2) + ' (' + result.count + ' registros)');

    const custoAtracaoFaturamento = faturamentoTotal > 0
      ? (custoAtracao / faturamentoTotal) * 100
      : 0;

    // Alerta quando custo de atração é muito baixo (< 3% do faturamento)
    if (custoAtracaoFaturamento < 3 && faturamentoTotal > 10000) {
      console.warn(`⚠️ Atração muito baixa: ${custoAtracaoFaturamento.toFixed(1)}% (R$ ${custoAtracao.toFixed(2)}) para faturamento de R$ ${faturamentoTotal.toFixed(2)}. Verificar lançamentos no Conta Azul.`);
    }

    // 3. Cancelamentos
    const { data: cancelRows, error: cancelError } = await supabase
      .schema('bronze')
      .from('bronze_contahub_avendas_cancelamentos')
      .select('custototal')
      .eq('bar_id', barId)
      .gte('data', startDate)
      .lte('data', endDate);

    if (cancelError) {
      return {
        success: false,
        error: 'Erro ao buscar cancelamentos: ' + cancelError.message,
        duration_ms: Date.now() - startTime,
      };
    }

    const cancelamentos = (cancelRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.custototal) || 0), 0
    );

    // 4. Couvert e Comissao (vr_repique) - FONTE CANÔNICA: bronze_contahub_avendas_vendasperiodo
    const { data: couvertComissaoRows, error: couvertError } = await supabase
      .schema('bronze')
      .from('bronze_contahub_avendas_vendasperiodo')
      .select('vr_couvert, vr_repique')
      .eq('bar_id', barId)
      .gte('dt_gerencial', startDate)
      .lte('dt_gerencial', endDate);

    if (couvertError) {
      return {
        success: false,
        error: 'Erro ao buscar couvert/comissao: ' + couvertError.message,
        duration_ms: Date.now() - startTime,
      };
    }

    const couvertAtracoes = (couvertComissaoRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.vr_couvert) || 0), 0
    );
    const comissaoCartao = (couvertComissaoRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.vr_repique) || 0), 0
    );
    console.log(`[DEBUG calc-custos] bar_id=${barId}, period=${startDate} to ${endDate}, rows=${couvertComissaoRows?.length || 0}, comissao=${comissaoCartao}, couvert=${couvertAtracoes}`);

    // 5. Atracoes/Eventos = custoAtracao (ja calculado)
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