/**
 * @camada gold
 * @jobName recalcular-desempenho-v2
 * @descricao Recalcula gold.desempenho (granularidade='semanal')
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * 🔮 RECALCULAR-DESEMPENHO-V2 - Recálculo Automático de Desempenho
 * 
 * Edge function que recalcula métricas de desempenho usando os calculators modulares.
 * Permite escrita tanto em semanas fechadas quanto na semana atual (dados parciais).
 * 
 * Modos:
 * - SHADOW (default): apenas compara resultados com banco, não escreve
 * - WRITE: escreve em gold.desempenho (requer ENABLE_V2_WRITE=true)
 * 
 * Feature Flag (Kill Switch):
 * - ENABLE_V2_WRITE=true → permite escrita quando mode='write'
 * - ENABLE_V2_WRITE=false/undefined → bloqueia qualquer escrita
 * 
 * Fluxo:
 * 1. Recebe bar_id, ano, numero_semana (ou usa semana atual)
 * 2. Verifica feature flag se mode='write'
 * 3. Executa os 6 calculators em paralelo
 * 4. Busca registro atual de gold.desempenho
 * 5. Compara valores calculados vs banco
 * 6. Se mode='write' e flag ativa, atualiza gold.desempenho
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

// Mapeamento calc_key -> db_column (gold.desempenho).
// Auditado em 2026-04-28 contra schema real. Comentarios marcam ajustes:
//  [DROP] = key existia no calc mas nao tem coluna correspondente em gold.desempenho
//  [TYPO_DB] = coluna no banco tem typo (ex: cmvivel sem o)
//  [RENAME] = code retornava com nome legado, mapear pra coluna real
const FIELD_MAPPING: Record<string, string> = {
  // Faturamento
  faturamento_total: "faturamento_total",
  faturamento_entrada: "faturamento_entrada",
  faturamento_bar: "faturamento_bar",
  clientes_atendidos: "clientes_atendidos",
  ticket_medio: "ticket_medio",
  tm_entrada: "tm_entrada",
  tm_bar: "tm_bar",
  // [DROP] meta_semanal — nao existe em gold.desempenho
  mesas_totais: "mesas_totais",
  mesas_presentes: "mesas_presentes",
  reservas_totais: "reservas_totais",
  reservas_presentes: "reservas_presentes",
  desconto_total: "desconto_total",
  desconto_percentual: "desconto_percentual",
  // Custos
  custo_atracao_faturamento: "custo_atracao_faturamento",
  couvert_atracoes: "couvert_atracoes",
  comissao: "comissao",
  atracoes_eventos: "atracoes_eventos",
  cancelamentos: "cancelamentos_total", // [RENAME] sum em R$ -> cancelamentos_total
  // Operacional — Stockout (so o _perc existe; counts ficam apenas no calc, nao persistem)
  // [DROP] stockout_bar (count)
  stockout_bar_perc: "stockout_bar_perc",
  // [DROP] stockout_drinks (count)
  stockout_drinks_perc: "stockout_drinks_perc",
  // [DROP] stockout_comidas (count)
  stockout_comidas_perc: "stockout_comidas_perc",
  perc_bebidas: "perc_bebidas",
  perc_drinks: "perc_drinks",
  perc_comida: "perc_comida",
  perc_happy_hour: "perc_happy_hour",
  // [RENAME] tempo_saida_bar -> tempo_bebidas; tempo_drinks separado nao vem do calc
  tempo_saida_bar: "tempo_bebidas",
  tempo_saida_cozinha: "tempo_cozinha", // [RENAME]
  // [DROP] qtde_itens_bar / qtde_itens_cozinha — usados apenas no calc dos %; gold guarda qtd_drinks_total e qtd_comida_total mas o calc atual nao retorna esses
  // Atrasinhos (singular no banco)
  atrasinhos_bar: "atrasinho_bar", // [RENAME] singular
  atrasinhos_bar_perc: "atrasinhos_bar_perc",
  atrasinhos_cozinha: "atrasinho_cozinha", // [RENAME] singular
  atrasinhos_cozinha_perc: "atrasinhos_cozinha_perc",
  // Atrasos: db usa ortografia "atrasao" (ao invez de "atraso") — preservar pra nao causar deriva
  atraso_bar: "atrasao_bar", // [RENAME]
  atraso_cozinha: "atrasao_cozinha", // [RENAME]
  // [DROP] atrasos_bar / atrasos_cozinha sem _perc — duplicidade com atraso_bar/cozinha
  atrasos_bar_perc: "atrasos_bar_perc",
  atrasos_cozinha_perc: "atrasos_comida_perc", // [RENAME] db usa "comida" no lugar de "cozinha"
  // Satisfacao
  avaliacoes_5_google_trip: "avaliacoes_5_google_trip",
  media_avaliacoes_google: "media_avaliacoes_google",
  nps_geral: "nps_geral",
  nps_reservas: "nps_reservas",
  nps_digital: "nps_digital",
  nps_salao: "nps_salao",
  nps_digital_respostas: "nps_digital_respostas",
  nps_salao_respostas: "nps_salao_respostas",
  nps_reservas_respostas: "nps_reservas_respostas",
  // Distribuicao
  perc_faturamento_ate_19h: "perc_faturamento_ate_19h",
  perc_faturamento_apos_22h: "perc_faturamento_apos_22h",
  qui_sab_dom: "qui_sab_dom",
  ter_qua_qui: "ter_qua_qui",
  sex_sab: "sex_sab",
  // Clientes
  clientes_ativos: "clientes_ativos",
  perc_clientes_novos: "perc_clientes_novos",
  // CMV (integrado de cmv_semanal)
  faturamento_cmovivel: "faturamento_cmvivel", // [TYPO_DB] db: cmvivel sem o
  cmv_rs: "cmv_rs",
  cmv: "cmv",
};

const TOLERANCE_PERCENT = 1; // 1% de tolerância para diffs significativos

// Feature Flag - Kill Switch para escrita
const ENABLE_V2_WRITE = Deno.env.get("ENABLE_V2_WRITE") === "true";

// 🔒 CAMPOS MANUAIS - Não devem ser sobrescritos pelo recálculo automático
// Estes campos são preenchidos manualmente pelo time de marketing e devem ser preservados
const MANUAL_FIELDS = [
  "nps_reservas",           // NPS de Reservas (preenchido manualmente)
  "nps_reservas_respostas", // Respostas NPS Reservas (manual)
  // Marketing Orgânico (todos manuais)
  "o_num_posts",
  "o_alcance",
  "o_interacao",
  "o_compartilhamento",
  "o_engajamento",
  "o_num_stories",
  "o_visu_stories",
  // Marketing Pago - Meta (todos manuais)
  "m_valor_investido",
  "m_alcance",
  "m_frequencia",
  "m_cpm",
  "m_cliques",
  "m_ctr",
  "m_custo_por_clique",
  "m_conversas_iniciadas",
  // Google Ads (todos manuais)
  "g_valor_investido",
  "g_impressoes",
  "g_cliques",
  "g_ctr",
  "g_solicitacoes_rotas",
  // GMN - Google Meu Negócio (todos manuais)
  "gmn_total_acoes",
  "gmn_total_visualizacoes",
  "gmn_solicitacoes_rotas",
] as const;

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

  // Buscar dados de CMV da tabela cmv_semanal (financial schema)
  const { data: cmvData, error: cmvError } = await supabase
    .schema("financial")
    .from("cmv_semanal")
    .select("faturamento_cmvivel, cmv_real, cmv_limpo_percentual")
    .eq("bar_id", barId)
    .eq("ano", ano)
    .eq("semana", numeroSemana)
    .maybeSingle();

  if (cmvError) {
    console.warn(`⚠️ Erro ao buscar CMV: ${cmvError.message}`);
  }

  // Integrar dados de CMV nos valores calculados
  if (cmvData) {
    calculatedValues["faturamento_cmovivel"] = cmvData.faturamento_cmvivel || 0;
    calculatedValues["cmv_rs"] = cmvData.cmv_real || 0;
    calculatedValues["cmv"] = cmvData.cmv_limpo_percentual || 0;
    console.log(`✅ CMV integrado: faturamento_cmovivel=${cmvData.faturamento_cmvivel}, cmv_rs=${cmvData.cmv_real}, cmv=${cmvData.cmv_limpo_percentual}`);
  } else {
    console.warn(`⚠️ Sem dados de CMV para semana ${numeroSemana}/${ano}`);
  }

  // Buscar registro atual em gold.desempenho (granularidade='semanal')
  const { data: registroAtual, error: fetchError } = await supabase
    .schema("gold")
    .from("desempenho")
    .select("*")
    .eq("bar_id", barId)
    .eq("granularidade", "semanal")
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
        // 🔒 PROTEÇÃO: Não sobrescrever campos manuais se já existirem no banco
        if (MANUAL_FIELDS.includes(dbKey as any)) {
          // Se o campo manual já existe no banco e não é null, preservar o valor
          if (registroAtual && registroAtual[dbKey] !== null && registroAtual[dbKey] !== undefined) {
            console.log(`[MANUAL FIELD PRESERVED] ${dbKey} = ${registroAtual[dbKey]} (não sobrescrito)`);
            continue; // Pular este campo, manter valor manual
          }
        }
        updatePayload[dbKey] = calculatedValues[calcKey];
      }
    }
    updatePayload["calculado_em"] = new Date().toISOString() as any;

    if (registroAtualEncontrado) {
      const { error: updateError } = await supabase
        .schema("gold")
        .from("desempenho")
        .update(updatePayload)
        .eq("bar_id", barId)
        .eq("granularidade", "semanal")
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
      // 🔒 PROTEÇÃO: Ao inserir novo registro, NUNCA incluir campos manuais
      // Eles devem ser preenchidos apenas pelo usuário via frontend
      const insertPayload: Record<string, any> = {
        bar_id: barId,
        ano,
        numero_semana: numeroSemana,
        granularidade: "semanal",
      };

      // Adicionar apenas campos calculados (não manuais)
      for (const [key, value] of Object.entries(updatePayload)) {
        if (key !== "calculado_em" && !MANUAL_FIELDS.includes(key as any)) {
          insertPayload[key] = value;
        }
      }
      insertPayload["calculado_em"] = updatePayload["calculado_em"];

      const { error: insertError } = await supabase
        .schema("gold")
        .from("desempenho")
        .insert(insertPayload);

      if (insertError) {
        writeError = `Erro ao inserir: ${insertError.message}`;
        console.error(writeError);
      } else {
        writeExecuted = true;
        console.log(`[V2 WRITE] Inserido bar ${barId}, semana ${numeroSemana}/${ano} (campos manuais preservados como NULL)`);
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
      console.log(`[V2] Modo WRITE ativo - escrita em gold.desempenho PERMITIDA (semana ${numeroSemana}/${ano} - ${tipoSemana})`);
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

  // Usar lock apenas no modo write para evitar recálculos simultâneos
  // TEMPORARIAMENTE DESABILITADO PARA DEBUG
  const useLock = false; // mode === 'write';

  for (const currentBarId of barIds) {
    // Heartbeat próprio para cada bar
    const { heartbeatId, startTime, lockAcquired } = await heartbeatStart(
      supabase,
      JOB_NAME,
      currentBarId,
      `${mode}-s${numeroSemana}`,
      "manual",
      useLock,
      30
    );

    // Se não conseguiu o lock, pular este bar
    if (useLock && !lockAcquired) {
      console.log(`⏭️ [V2] Pulando bar ${currentBarId}: já está sendo processado`);
      allResults.push({
        bar_id: currentBarId,
        ano,
        numero_semana: numeroSemana,
        mode,
        write_executed: false,
        calculators_executed: [],
        calculators_with_error: [],
        total_fields_calculated: 0,
        total_fields_divergent: 0,
        diff_summary: { significant_diffs: [], all_diffs: [] },
        validation_errors: ['Job já em execução - lock não adquirido'],
      });
      continue;
    }

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
        currentBarId,
        useLock
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
        currentBarId,
        useLock
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
      ? `V2 Write Mode - ${totalWritesExecuted} registros atualizados em gold.desempenho`
      : "V2 Shadow Mode - Nenhuma escrita em gold.desempenho",
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
