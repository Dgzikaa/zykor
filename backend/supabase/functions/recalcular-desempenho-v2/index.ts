/**
 * 🔮 RECALCULAR-DESEMPENHO-V2 - Recálculo Automático de Desempenho
 * 
 * Edge function que recalcula métricas de desempenho usando os calculators modulares.
 * Permite escrita tanto em semanas fechadas quanto na semana atual (dados parciais).
 * 
 * Modos:
 * - SHADOW (default): apenas compara resultados com banco, não escreve
 * - WRITE: escreve em desempenho_semanal (requer ENABLE_V2_WRITE=true)
 * 
 * Feature Flag (Kill Switch):
 * - ENABLE_V2_WRITE=true → permite escrita quando mode='write'
 * - ENABLE_V2_WRITE=false/undefined → bloqueia qualquer escrita
 * 
 * Fluxo:
 * 1. Recebe bar_id, ano, numero_semana (ou usa semana atual)
 * 2. Verifica feature flag se mode='write'
 * 3. Executa os 6 calculators em paralelo
 * 4. Busca registro atual de desempenho_semanal
 * 5. Compara valores calculados vs banco
 * 6. Se mode='write' e flag ativa, atualiza desempenho_semanal
 * 7. Registra diff no heartbeat response_summary
 * 8. Retorna resultado estruturado
 * 
 * @version 2.2.0 - Permite escrita na semana atual
 * @date 2026-03-24
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

import { heartbeatStart, heartbeatEnd, heartbeatError } from "../_shared/heartbeat.ts";
import { getWeekDateRange, getISOWeek, getISOYear } from "../_shared/date-helpers.ts";
import { ACTIVE_BAR_IDS } from "../_shared/week-manager.ts";

import {
  calcFaturamento,
  calcCustos,
  calcOperacional,
  calcSatisfacao,
  calcDistribuicao,
  calcClientes,
  CalculatorInput,
  CalculatorResult,
  FaturamentoResult,
  CustosResult,
  OperacionalResult,
  SatisfacaoResult,
  DistribuicaoResult,
  ClientesResult,
} from "../_shared/calculators/index.ts";

const JOB_NAME = "recalcular-desempenho-v2";

type V2Mode = "shadow" | "write";

interface V2Request {
  bar_id?: number;
  ano?: number;
  numero_semana?: number;
  all_bars?: boolean;
  mode?: V2Mode;
}

interface CalculatorExecution {
  name: string;
  success: boolean;
  duration_ms: number;
  error?: string;
  fields_calculated: number;
}

interface FieldDiff {
  field: string;
  banco: number | null;
  calculado: number | null;
  diferenca: number | null;
  percentual: number | null;
}

interface V2Result {
  success: boolean;
  mode: V2Mode;
  write_executed: boolean;
  bar_id: number;
  ano: number;
  numero_semana: number;
  data_inicio: string;
  data_fim: string;
  calculators_executed: CalculatorExecution[];
  calculators_with_error: string[];
  total_fields_calculated: number;
  total_fields_divergent: number;
  diff_summary: {
    significant_diffs: FieldDiff[];
    all_diffs_count: number;
    tolerance_used: number;
  };
  registro_atual_encontrado: boolean;
  duration_ms: number;
  timestamp: string;
}

// Mapeamento dos campos dos calculators para colunas de desempenho_semanal
const FIELD_MAPPING: Record<string, string> = {
  // Faturamento
  faturamento_total: "faturamento_total",
  faturamento_entrada: "faturamento_entrada",
  faturamento_bar: "faturamento_bar",
  clientes_atendidos: "clientes_atendidos",
  ticket_medio: "ticket_medio",
  tm_entrada: "tm_entrada",
  tm_bar: "tm_bar",
  meta_semanal: "meta_semanal",
  mesas_totais: "mesas_totais",
  mesas_presentes: "mesas_presentes",
  reservas_totais: "reservas_totais",
  reservas_presentes: "reservas_presentes",
  // Custos
  custo_atracao_faturamento: "custo_atracao_faturamento",
  couvert_atracoes: "couvert_atracoes",
  comissao: "comissao",
  atracoes_eventos: "atracoes_eventos",
  cancelamentos: "cancelamentos",
  // Operacional
  stockout_bar: "stockout_bar",
  stockout_bar_perc: "stockout_bar_perc",
  stockout_drinks: "stockout_drinks",
  stockout_drinks_perc: "stockout_drinks_perc",
  stockout_comidas: "stockout_comidas",
  stockout_comidas_perc: "stockout_comidas_perc",
  perc_bebidas: "perc_bebidas",
  perc_drinks: "perc_drinks",
  perc_comida: "perc_comida",
  perc_happy_hour: "perc_happy_hour",
  tempo_saida_bar: "tempo_saida_bar",
  tempo_saida_cozinha: "tempo_saida_cozinha",
  qtde_itens_bar: "qtde_itens_bar",
  qtde_itens_cozinha: "qtde_itens_cozinha",
  atrasinhos_bar: "atrasinhos_bar",
  atrasinhos_cozinha: "atrasinhos_cozinha",
  atraso_bar: "atraso_bar",
  atraso_cozinha: "atraso_cozinha",
  atrasos_bar: "atrasos_bar",
  atrasos_cozinha: "atrasos_cozinha",
  atrasos_bar_perc: "atrasos_bar_perc",
  atrasos_cozinha_perc: "atrasos_cozinha_perc",
  // Satisfacao
  avaliacoes_5_google_trip: "avaliacoes_5_google_trip",
  media_avaliacoes_google: "media_avaliacoes_google",
  nps_geral: "nps_geral",
  nps_reservas: "nps_reservas",
  // Distribuicao
  perc_faturamento_ate_19h: "perc_faturamento_ate_19h",
  perc_faturamento_apos_22h: "perc_faturamento_apos_22h",
  qui_sab_dom: "qui_sab_dom",
  ter_qua_qui: "ter_qua_qui",
  sex_sab: "sex_sab",
  // Clientes
  clientes_ativos: "clientes_ativos",
  perc_clientes_novos: "perc_clientes_novos",
};

const TOLERANCE_PERCENT = 1; // 1% de tolerância para diffs significativos

// Feature Flag - Kill Switch para escrita
const ENABLE_V2_WRITE = Deno.env.get("ENABLE_V2_WRITE") === "true";

function validateWriteMode(mode: V2Mode): void {
  if (mode === "write" && !ENABLE_V2_WRITE) {
    throw new Error("V2 WRITE desabilitado via env. Defina ENABLE_V2_WRITE=true para habilitar.");
  }
}

function compareValues(
  calculado: number | null | undefined,
  banco: number | null | undefined
): { diferenca: number | null; percentual: number | null; isSignificant: boolean } {
  if (calculado === null || calculado === undefined) {
    return { diferenca: null, percentual: null, isSignificant: false };
  }
  if (banco === null || banco === undefined) {
    return { diferenca: calculado, percentual: 100, isSignificant: calculado !== 0 };
  }

  const diff = calculado - banco;
  const percent = banco !== 0 ? Math.abs(diff / banco) * 100 : (calculado !== 0 ? 100 : 0);
  const isSignificant = percent > TOLERANCE_PERCENT && Math.abs(diff) > 0.01;

  return { diferenca: diff, percentual: percent, isSignificant };
}

async function processBarWeek(
  supabase: any,
  barId: number,
  ano: number,
  numeroSemana: number,
  mode: V2Mode = "shadow"
): Promise<V2Result> {
  const startTime = Date.now();
  const { start: dataInicio, end: dataFim } = getWeekDateRange(ano, numeroSemana);

  const calculatorInput: CalculatorInput = {
    supabase,
    barId,
    startDate: dataInicio,
    endDate: dataFim,
    semana: { ano, numero_semana: numeroSemana },
  };

  // Executar calculators em paralelo
  const [
    faturamentoResult,
    custosResult,
    operacionalResult,
    satisfacaoResult,
    distribuicaoResult,
    clientesResult,
  ] = await Promise.all([
    calcFaturamento(calculatorInput),
    calcCustos(calculatorInput),
    calcOperacional(calculatorInput),
    calcSatisfacao(calculatorInput),
    calcDistribuicao(calculatorInput),
    calcClientes(calculatorInput),
  ]);

  // Registrar execução de cada calculator
  const calculatorsExecuted: CalculatorExecution[] = [
    {
      name: "faturamento",
      success: faturamentoResult.success,
      duration_ms: faturamentoResult.duration_ms || 0,
      error: faturamentoResult.error,
      fields_calculated: faturamentoResult.success ? Object.keys(faturamentoResult.data || {}).length : 0,
    },
    {
      name: "custos",
      success: custosResult.success,
      duration_ms: custosResult.duration_ms || 0,
      error: custosResult.error,
      fields_calculated: custosResult.success ? Object.keys(custosResult.data || {}).length : 0,
    },
    {
      name: "operacional",
      success: operacionalResult.success,
      duration_ms: operacionalResult.duration_ms || 0,
      error: operacionalResult.error,
      fields_calculated: operacionalResult.success ? Object.keys(operacionalResult.data || {}).length : 0,
    },
    {
      name: "satisfacao",
      success: satisfacaoResult.success,
      duration_ms: satisfacaoResult.duration_ms || 0,
      error: satisfacaoResult.error,
      fields_calculated: satisfacaoResult.success ? Object.keys(satisfacaoResult.data || {}).length : 0,
    },
    {
      name: "distribuicao",
      success: distribuicaoResult.success,
      duration_ms: distribuicaoResult.duration_ms || 0,
      error: distribuicaoResult.error,
      fields_calculated: distribuicaoResult.success ? Object.keys(distribuicaoResult.data || {}).length : 0,
    },
    {
      name: "clientes",
      success: clientesResult.success,
      duration_ms: clientesResult.duration_ms || 0,
      error: clientesResult.error,
      fields_calculated: clientesResult.success ? Object.keys(clientesResult.data || {}).length : 0,
    },
  ];

  const calculatorsWithError = calculatorsExecuted
    .filter((c) => !c.success)
    .map((c) => c.name);

  // Merge dos resultados bem-sucedidos
  const calculatedValues: Record<string, number | null> = {};

  if (faturamentoResult.success && faturamentoResult.data) {
    Object.entries(faturamentoResult.data).forEach(([key, value]) => {
      calculatedValues[key] = value as number;
    });
  }
  if (custosResult.success && custosResult.data) {
    Object.entries(custosResult.data).forEach(([key, value]) => {
      calculatedValues[key] = value as number;
    });
  }
  if (operacionalResult.success && operacionalResult.data) {
    Object.entries(operacionalResult.data).forEach(([key, value]) => {
      calculatedValues[key] = value as number;
    });
  }
  if (satisfacaoResult.success && satisfacaoResult.data) {
    Object.entries(satisfacaoResult.data).forEach(([key, value]) => {
      calculatedValues[key] = value as number | null;
    });
  }
  if (distribuicaoResult.success && distribuicaoResult.data) {
    Object.entries(distribuicaoResult.data).forEach(([key, value]) => {
      calculatedValues[key] = value as number | null;
    });
  }
  if (clientesResult.success && clientesResult.data) {
    Object.entries(clientesResult.data).forEach(([key, value]) => {
      calculatedValues[key] = value as number | null;
    });
  }

  const totalFieldsCalculated = Object.keys(calculatedValues).length;

  // Buscar registro atual de desempenho_semanal
  const { data: registroAtual, error: fetchError } = await supabase
    .from("desempenho_semanal")
    .select("*")
    .eq("bar_id", barId)
    .eq("ano", ano)
    .eq("numero_semana", numeroSemana)
    .maybeSingle();

  if (fetchError) {
    console.warn(`Erro ao buscar registro atual: ${fetchError.message}`);
  }

  const registroAtualEncontrado = !!registroAtual;

  // Comparar valores
  const allDiffs: FieldDiff[] = [];
  const significantDiffs: FieldDiff[] = [];

  for (const [calcKey, dbKey] of Object.entries(FIELD_MAPPING)) {
    if (!(calcKey in calculatedValues)) continue;

    const valorCalculado = calculatedValues[calcKey];
    const valorBanco = registroAtual ? registroAtual[dbKey] : null;

    const { diferenca, percentual, isSignificant } = compareValues(valorCalculado, valorBanco);

    const diff: FieldDiff = {
      field: dbKey,
      banco: valorBanco !== null && valorBanco !== undefined ? Number(valorBanco) : null,
      calculado: valorCalculado,
      diferenca,
      percentual: percentual !== null ? parseFloat(percentual.toFixed(2)) : null,
    };

    allDiffs.push(diff);

    if (isSignificant) {
      significantDiffs.push(diff);
    }
  }

  const totalFieldsDivergent = significantDiffs.length;

  // Executar escrita se mode='write' e flag habilitada
  let writeExecuted = false;
  let writeError: string | undefined;

  if (mode === "write") {
    validateWriteMode(mode);

    const updatePayload: Record<string, number | null> = {};
    for (const [calcKey, dbKey] of Object.entries(FIELD_MAPPING)) {
      if (calcKey in calculatedValues) {
        updatePayload[dbKey] = calculatedValues[calcKey];
      }
    }
    updatePayload["atualizado_em"] = new Date().toISOString() as any;

    if (registroAtualEncontrado) {
      const { error: updateError } = await supabase
        .from("desempenho_semanal")
        .update(updatePayload)
        .eq("bar_id", barId)
        .eq("ano", ano)
        .eq("numero_semana", numeroSemana);

      if (updateError) {
        writeError = `Erro ao atualizar: ${updateError.message}`;
        console.error(writeError);
      } else {
        writeExecuted = true;
        console.log(`[V2 WRITE] Atualizado bar ${barId}, semana ${numeroSemana}/${ano}`);
      }
    } else {
      const insertPayload = {
        bar_id: barId,
        ano,
        numero_semana: numeroSemana,
        ...updatePayload,
        criado_em: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("desempenho_semanal")
        .insert(insertPayload);

      if (insertError) {
        writeError = `Erro ao inserir: ${insertError.message}`;
        console.error(writeError);
      } else {
        writeExecuted = true;
        console.log(`[V2 WRITE] Inserido bar ${barId}, semana ${numeroSemana}/${ano}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: calculatorsWithError.length === 0 && !writeError,
    mode,
    write_executed: writeExecuted,
    bar_id: barId,
    ano,
    numero_semana: numeroSemana,
    data_inicio: dataInicio,
    data_fim: dataFim,
    calculators_executed: calculatorsExecuted,
    calculators_with_error: calculatorsWithError,
    total_fields_calculated: totalFieldsCalculated,
    total_fields_divergent: totalFieldsDivergent,
    diff_summary: {
      significant_diffs: significantDiffs.slice(0, 20),
      all_diffs_count: allDiffs.length,
      tolerance_used: TOLERANCE_PERCENT,
    },
    registro_atual_encontrado: registroAtualEncontrado,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  };
}

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Log do status da feature flag
  console.log(`[V2] Feature Flag ENABLE_V2_WRITE: ${ENABLE_V2_WRITE ? "HABILITADO" : "DESABILITADO"}`);

  let requestBody: V2Request = {};

  if (req.method === "POST") {
    try {
      requestBody = await req.json();
    } catch {
      // Body vazio ou inválido, usar defaults
    }
  }

  // Usar URL params como fallback
  const url = new URL(req.url);
  const barIdParam = url.searchParams.get("bar_id");
  const anoParam = url.searchParams.get("ano");
  const semanaParam = url.searchParams.get("semana");
  const allBarsParam = url.searchParams.get("all_bars");
  const modeParam = url.searchParams.get("mode");

  // Determinar semana atual se não especificada
  const hoje = new Date();
  const defaultAno = getISOYear(hoje);
  const defaultSemana = getISOWeek(hoje);

  const ano = requestBody.ano || (anoParam ? parseInt(anoParam) : defaultAno);
  const numeroSemana = requestBody.numero_semana || (semanaParam ? parseInt(semanaParam) : defaultSemana);
  const allBars = requestBody.all_bars || allBarsParam === "true";
  const barId = requestBody.bar_id || (barIdParam ? parseInt(barIdParam) : null);
  const mode: V2Mode = requestBody.mode || (modeParam as V2Mode) || "shadow";

  // Validar modo de escrita antes de processar
  if (mode === "write") {
    // Validar feature flag (kill switch)
    try {
      validateWriteMode(mode);
      const tipoSemana = numeroSemana === defaultSemana && ano === defaultAno ? "atual (parcial)" : "fechada";
      console.log(`[V2] Modo WRITE ativo - escrita em desempenho_semanal PERMITIDA (semana ${numeroSemana}/${ano} - ${tipoSemana})`);
    } catch (err) {
      console.error(`[V2] Modo WRITE bloqueado:`, err);
      return new Response(
        JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : String(err),
          mode,
          write_enabled: ENABLE_V2_WRITE,
          message: "Defina ENABLE_V2_WRITE=true nas variáveis de ambiente para habilitar escrita.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    console.log(`[V2] Modo SHADOW ativo - nenhuma escrita será realizada`);
  }

  // Determinar quais bares processar
  let barIds: number[];
  if (allBars) {
    barIds = [...ACTIVE_BAR_IDS];
  } else if (barId) {
    barIds = [barId];
  } else {
    barIds = [...ACTIVE_BAR_IDS]; // Default: todos os bares ativos
  }

  const allResults: V2Result[] = [];
  const overallStartTime = Date.now();

  for (const currentBarId of barIds) {
    // Heartbeat próprio para cada bar
    const { heartbeatId, startTime } = await heartbeatStart(
      supabase,
      JOB_NAME,
      currentBarId,
      `${mode}-s${numeroSemana}`,
      "manual"
    );

    try {
      const result = await processBarWeek(supabase, currentBarId, ano, numeroSemana, mode);
      allResults.push(result);

      // Registrar no heartbeat
      const status = result.calculators_with_error.length === 0 ? "success" : "partial";
      await heartbeatEnd(
        supabase,
        heartbeatId,
        status,
        startTime,
        result.total_fields_calculated,
        {
          mode,
          write_executed: result.write_executed,
          bar_id: currentBarId,
          ano,
          numero_semana: numeroSemana,
          calculators_success: result.calculators_executed.filter((c) => c.success).length,
          calculators_error: result.calculators_with_error.length,
          fields_divergent: result.total_fields_divergent,
          significant_diffs: result.diff_summary.significant_diffs.slice(0, 5).map((d) => ({
            field: d.field,
            diff: d.diferenca?.toFixed(2),
            pct: d.percentual?.toFixed(1) + "%",
          })),
        },
        result.calculators_with_error.length > 0
          ? `Calculators com erro: ${result.calculators_with_error.join(", ")}`
          : undefined,
        JOB_NAME,
        currentBarId
      );
    } catch (err) {
      console.error(`Erro ao processar bar ${currentBarId}:`, err);
      await heartbeatError(
        supabase,
        heartbeatId,
        startTime,
        err instanceof Error ? err : new Error(String(err)),
        { bar_id: currentBarId, ano, numero_semana: numeroSemana },
        JOB_NAME,
        currentBarId
      );

      allResults.push({
        success: false,
        mode,
        write_executed: false,
        bar_id: currentBarId,
        ano,
        numero_semana: numeroSemana,
        data_inicio: "",
        data_fim: "",
        calculators_executed: [],
        calculators_with_error: ["all"],
        total_fields_calculated: 0,
        total_fields_divergent: 0,
        diff_summary: {
          significant_diffs: [],
          all_diffs_count: 0,
          tolerance_used: TOLERANCE_PERCENT,
        },
        registro_atual_encontrado: false,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const overallDuration = Date.now() - overallStartTime;

  const totalWritesExecuted = allResults.filter((r) => r.write_executed).length;

  const response = {
    success: allResults.every((r) => r.success),
    mode,
    write_enabled: ENABLE_V2_WRITE,
    writes_executed: totalWritesExecuted,
    message: mode === "write" 
      ? `V2 Write Mode - ${totalWritesExecuted} registros atualizados em desempenho_semanal`
      : "V2 Shadow Mode - Nenhuma escrita em desempenho_semanal",
    results: allResults,
    summary: {
      total_bars: allResults.length,
      bars_success: allResults.filter((r) => r.success).length,
      bars_with_errors: allResults.filter((r) => !r.success).length,
      total_diffs_found: allResults.reduce((sum, r) => sum + r.total_fields_divergent, 0),
    },
    duration_ms: overallDuration,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
