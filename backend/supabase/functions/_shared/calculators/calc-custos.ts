/**
 * CALC-CUSTOS - Calculator de Custos e Despesas
 * 
 * Calcula custos de atracao, couvert, comissao e cancelamentos.
 * Fontes: contaazul_lancamentos (primario), nibo_agendamentos (fallback), visitas, contahub_cancelamentos, eventos_base
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

async function getCustoAtracaoContaAzul(
  supabase: any,
  barId: number,
  startDate: string,
  endDate: string,
  categoriasAtracao: string[]
): Promise<{ valor: number; count: number }> {
  const { data, error } = await supabase
    .from('contaazul_lancamentos')
    .select('valor_bruto')
    .eq('bar_id', barId)
    .eq('tipo', 'DESPESA')
    .in('categoria_nome', categoriasAtracao)
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate);

  if (error) {
    console.warn('[calc-custos] Erro ao buscar Conta Azul:', error.message);
    return { valor: 0, count: 0 };
  }

  const items = data || [];
  const valor = items.reduce(
    (sum: number, item: any) => sum + (parseFloat(item.valor_bruto) || 0), 0
  );

  return { valor, count: items.length };
}

// TRANSICAO: remover fallback nibo_agendamentos apos cutover completo
async function getCustoAtracaoNiboFallback(
  supabase: any,
  barId: number,
  startDate: string,
  endDate: string,
  categoriasAtracao: string[]
): Promise<{ valor: number; count: number }> {
  const { data, error } = await supabase
    .from('nibo_agendamentos')
    .select('valor')
    .eq('bar_id', barId)
    .eq('tipo', 'despesa')
    .eq('deletado', false)
    .in('categoria_nome', categoriasAtracao)
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate);

  if (error) {
    console.warn('[calc-custos] Erro ao buscar NIBO fallback:', error.message);
    return { valor: 0, count: 0 };
  }

  const items = data || [];
  const valor = items.reduce(
    (sum: number, item: any) => sum + (parseFloat(item.valor) || 0), 0
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

    // 2. Custo Atracao - Tentar Conta Azul primeiro, fallback para NIBO
    const categoriasAtracao = await getCategoriasAtracao(supabase, barId);

    let custoAtracao = 0;
    let fonte = 'contaazul';

    // Tentar Conta Azul primeiro
    const caResult = await getCustoAtracaoContaAzul(supabase, barId, startDate, endDate, categoriasAtracao);
    
    if (caResult.count > 0) {
      custoAtracao = caResult.valor;
      console.log('[calc-custos] Custo atracao do Conta Azul: R$' + custoAtracao.toFixed(2) + ' (' + caResult.count + ' registros)');
    } else {
      // TRANSICAO: remover fallback nibo_agendamentos apos cutover completo
      console.log('[calc-custos] Conta Azul sem dados, tentando NIBO fallback...');
      const niboResult = await getCustoAtracaoNiboFallback(supabase, barId, startDate, endDate, categoriasAtracao);
      custoAtracao = niboResult.valor;
      fonte = 'nibo';
      console.log('[calc-custos] Custo atracao do NIBO fallback: R$' + custoAtracao.toFixed(2) + ' (' + niboResult.count + ' registros)');
    }

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
        error: 'Erro ao buscar cancelamentos: ' + cancelError.message,
        duration_ms: Date.now() - startTime,
      };
    }

    const cancelamentos = (cancelRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.custototal) || 0), 0
    );

    // 4. Couvert e Comissao (vr_repique) - MIGRADO: visitas (domain table)
    const { data: couvertComissaoRows, error: couvertError } = await supabase
      .from('visitas')
      .select('valor_couvert, valor_repique')
      .eq('bar_id', barId)
      .gte('data_visita', startDate)
      .lte('data_visita', endDate);

    if (couvertError) {
      return {
        success: false,
        error: 'Erro ao buscar couvert/comissao: ' + couvertError.message,
        duration_ms: Date.now() - startTime,
      };
    }

    const couvertAtracoes = (couvertComissaoRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.valor_couvert) || 0), 0
    );
    const comissaoCartao = (couvertComissaoRows || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.valor_repique) || 0), 0
    );

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