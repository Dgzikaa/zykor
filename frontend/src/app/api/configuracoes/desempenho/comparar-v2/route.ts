/**
 * 🔍 COMPARAR-V2 - Validação Paralela v1 vs v2
 * 
 * Rota para comparar resultados entre:
 * - recalcular-desempenho-auto (v1 - produção)
 * - recalcular-desempenho-v2 (shadow)
 * 
 * Modos:
 * - Semana específica: { bar_id, ano, semana }
 * - Múltiplas semanas: { bar_id, ano, semanas: [10, 11, 12] }
 * - Intervalo: { bar_id, ano, semana_inicio, semana_fim }
 * - Batch (últimas 6 semanas, todos os bares): { mode: "batch" }
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const V2_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/recalcular-desempenho-v2`;

// SEM FALLBACK: Se banco não retornar, retornar erro
async function getBaresAtivos(supabase: any): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('bares')
    .select('id')
    .eq('ativo', true)
    .order('id');
  
  if (error || !data || data.length === 0) {
    console.error(`❌ [ERRO CONFIG] Nenhum bar ativo encontrado na tabela bares.`);
    return null;
  }
  
  return (data as { id: number }[]).map(b => b.id);
}

interface CompareRequest {
  bar_id?: number;
  ano?: number;
  semana?: number;
  semanas?: number[];
  semana_inicio?: number;
  semana_fim?: number;
  mode?: 'single' | 'batch';
}

interface V2Result {
  success: boolean;
  bar_id: number;
  ano: number;
  numero_semana: number;
  calculators_executed: Array<{
    name: string;
    success: boolean;
    duration_ms: number;
    error?: string;
    fields_calculated: number;
  }>;
  calculators_with_error: string[];
  total_fields_calculated: number;
  total_fields_divergent: number;
  diff_summary: {
    significant_diffs: Array<{
      field: string;
      banco: number | null;
      calculado: number | null;
      diferenca: number | null;
      percentual: number | null;
    }>;
    all_diffs_count: number;
    tolerance_used: number;
  };
  registro_atual_encontrado: boolean;
  duration_ms: number;
}

interface WeekComparison {
  bar_id: number;
  ano: number;
  semana: number;
  status: 'ok' | 'divergente' | 'sem_registro' | 'erro';
  v2_success: boolean;
  calculators_ok: number;
  calculators_error: string[];
  campos_comparados: number;
  campos_divergentes: number;
  divergencias: Array<{
    campo: string;
    v1: number | null;
    v2: number | null;
    diff: number | null;
    percentual: number | null;
  }>;
  duration_ms: number;
  erro?: string;
}

interface CompareReport {
  success: boolean;
  mode: string;
  timestamp: string;
  parametros: {
    bares: number[];
    ano: number;
    semanas: number[];
  };
  resumo: {
    total_comparacoes: number;
    comparacoes_ok: number;
    comparacoes_divergentes: number;
    semanas_sem_registro: number;
    comparacoes_com_erro: number;
    total_campos_comparados: number;
    total_campos_divergentes: number;
  };
  divergencias_por_campo: Record<string, {
    ocorrencias: number;
    exemplos: Array<{
      bar_id: number;
      semana: number;
      v1: number | null;
      v2: number | null;
      diff: number | null;
    }>;
  }>;
  calculators_com_erro: Record<string, number>;
  comparacoes: WeekComparison[];
  duration_ms: number;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

function getLastNWeeks(n: number): Array<{ ano: number; semana: number }> {
  const weeks: Array<{ ano: number; semana: number }> = [];
  const hoje = new Date();
  
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (i * 7));
    weeks.push({
      ano: getISOYear(d),
      semana: getISOWeek(d),
    });
  }
  
  return weeks.reverse();
}

async function callV2Shadow(
  barId: number,
  ano: number,
  semana: number
): Promise<V2Result | null> {
  try {
    const response = await fetch(V2_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        bar_id: barId,
        ano,
        numero_semana: semana,
      }),
    });

    if (!response.ok) {
      console.error(`V2 retornou ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0] as V2Result;
    }
    
    return null;
  } catch (err) {
    console.error('Erro ao chamar V2:', err);
    return null;
  }
}

async function compareWeek(
  barId: number,
  ano: number,
  semana: number
): Promise<WeekComparison> {
  const startTime = Date.now();
  
  const v2Result = await callV2Shadow(barId, ano, semana);
  
  if (!v2Result) {
    return {
      bar_id: barId,
      ano,
      semana,
      status: 'erro',
      v2_success: false,
      calculators_ok: 0,
      calculators_error: ['all'],
      campos_comparados: 0,
      campos_divergentes: 0,
      divergencias: [],
      duration_ms: Date.now() - startTime,
      erro: 'Falha ao chamar V2 shadow',
    };
  }
  
  if (!v2Result.registro_atual_encontrado) {
    return {
      bar_id: barId,
      ano,
      semana,
      status: 'sem_registro',
      v2_success: v2Result.success,
      calculators_ok: v2Result.calculators_executed.filter(c => c.success).length,
      calculators_error: v2Result.calculators_with_error,
      campos_comparados: 0,
      campos_divergentes: 0,
      divergencias: [],
      duration_ms: Date.now() - startTime,
    };
  }
  
  const divergencias = v2Result.diff_summary.significant_diffs.map(d => ({
    campo: d.field,
    v1: d.banco,
    v2: d.calculado,
    diff: d.diferenca,
    percentual: d.percentual,
  }));
  
  const status = v2Result.total_fields_divergent === 0 ? 'ok' : 'divergente';
  
  return {
    bar_id: barId,
    ano,
    semana,
    status,
    v2_success: v2Result.success,
    calculators_ok: v2Result.calculators_executed.filter(c => c.success).length,
    calculators_error: v2Result.calculators_with_error,
    campos_comparados: v2Result.diff_summary.all_diffs_count,
    campos_divergentes: v2Result.total_fields_divergent,
    divergencias,
    duration_ms: Date.now() - startTime,
  };
}

function buildReport(
  comparacoes: WeekComparison[],
  bares: number[],
  ano: number,
  semanas: number[],
  startTime: number
): CompareReport {
  const divergenciasPorCampo: Record<string, {
    ocorrencias: number;
    exemplos: Array<{
      bar_id: number;
      semana: number;
      v1: number | null;
      v2: number | null;
      diff: number | null;
    }>;
  }> = {};
  
  const calculatorsComErro: Record<string, number> = {};
  
  let totalCamposComparados = 0;
  let totalCamposDivergentes = 0;
  
  for (const comp of comparacoes) {
    totalCamposComparados += comp.campos_comparados;
    totalCamposDivergentes += comp.campos_divergentes;
    
    for (const div of comp.divergencias) {
      if (!divergenciasPorCampo[div.campo]) {
        divergenciasPorCampo[div.campo] = { ocorrencias: 0, exemplos: [] };
      }
      divergenciasPorCampo[div.campo].ocorrencias++;
      if (divergenciasPorCampo[div.campo].exemplos.length < 3) {
        divergenciasPorCampo[div.campo].exemplos.push({
          bar_id: comp.bar_id,
          semana: comp.semana,
          v1: div.v1,
          v2: div.v2,
          diff: div.diff,
        });
      }
    }
    
    for (const calc of comp.calculators_error) {
      calculatorsComErro[calc] = (calculatorsComErro[calc] || 0) + 1;
    }
  }
  
  const sortedDivergencias: Record<string, typeof divergenciasPorCampo[string]> = {};
  Object.entries(divergenciasPorCampo)
    .sort((a, b) => b[1].ocorrencias - a[1].ocorrencias)
    .forEach(([k, v]) => { sortedDivergencias[k] = v; });
  
  return {
    success: true,
    mode: bares.length > 1 ? 'batch' : 'single',
    timestamp: new Date().toISOString(),
    parametros: {
      bares,
      ano,
      semanas,
    },
    resumo: {
      total_comparacoes: comparacoes.length,
      comparacoes_ok: comparacoes.filter(c => c.status === 'ok').length,
      comparacoes_divergentes: comparacoes.filter(c => c.status === 'divergente').length,
      semanas_sem_registro: comparacoes.filter(c => c.status === 'sem_registro').length,
      comparacoes_com_erro: comparacoes.filter(c => c.status === 'erro').length,
      total_campos_comparados: totalCamposComparados,
      total_campos_divergentes: totalCamposDivergentes,
    },
    divergencias_por_campo: sortedDivergencias,
    calculators_com_erro: calculatorsComErro,
    comparacoes,
    duration_ms: Date.now() - startTime,
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  let body: CompareRequest;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  
  const hoje = new Date();
  const defaultAno = getISOYear(hoje);
  
  // Buscar bares ativos do banco - erro se não configurado
  const activeBarIds = await getBaresAtivos(supabase);
  if (!activeBarIds) {
    return NextResponse.json(
      { error: 'Configuração ausente: nenhum bar ativo encontrado na tabela bares.' },
      { status: 500 }
    );
  }
  
  let bares: number[];
  let ano: number;
  let semanas: number[];
  
  if (body.mode === 'batch') {
    bares = activeBarIds;
    const lastWeeks = getLastNWeeks(6);
    ano = lastWeeks[0].ano;
    semanas = lastWeeks.map(w => w.semana);
  } else if (body.semanas && body.semanas.length > 0) {
    bares = body.bar_id ? [body.bar_id] : activeBarIds;
    ano = body.ano || defaultAno;
    semanas = body.semanas;
  } else if (body.semana_inicio && body.semana_fim) {
    bares = body.bar_id ? [body.bar_id] : activeBarIds;
    ano = body.ano || defaultAno;
    semanas = [];
    for (let s = body.semana_inicio; s <= body.semana_fim; s++) {
      semanas.push(s);
    }
  } else if (body.semana) {
    bares = body.bar_id ? [body.bar_id] : activeBarIds;
    ano = body.ano || defaultAno;
    semanas = [body.semana];
  } else {
    bares = activeBarIds;
    const lastWeeks = getLastNWeeks(6);
    ano = lastWeeks[0].ano;
    semanas = lastWeeks.map(w => w.semana);
  }
  
  const comparacoes: WeekComparison[] = [];
  
  for (const barId of bares) {
    for (const semana of semanas) {
      const comp = await compareWeek(barId, ano, semana);
      comparacoes.push(comp);
    }
  }
  
  const report = buildReport(comparacoes, bares, ano, semanas, startTime);
  
  return NextResponse.json(report, { status: 200 });
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { searchParams } = new URL(req.url);
  
  const mode = searchParams.get('mode');
  const barIdParam = searchParams.get('bar_id');
  const anoParam = searchParams.get('ano');
  const semanaParam = searchParams.get('semana');
  const semanasParam = searchParams.get('semanas');
  
  const hoje = new Date();
  const defaultAno = getISOYear(hoje);
  
  // Buscar bares ativos do banco - erro se não configurado
  const activeBarIds = await getBaresAtivos(supabase);
  if (!activeBarIds) {
    return NextResponse.json(
      { error: 'Configuração ausente: nenhum bar ativo encontrado na tabela bares.' },
      { status: 500 }
    );
  }
  
  let bares: number[];
  let ano: number;
  let semanas: number[];
  
  if (mode === 'batch') {
    bares = activeBarIds;
    const lastWeeks = getLastNWeeks(6);
    ano = lastWeeks[0].ano;
    semanas = lastWeeks.map(w => w.semana);
  } else if (semanasParam) {
    bares = barIdParam ? [parseInt(barIdParam)] : activeBarIds;
    ano = anoParam ? parseInt(anoParam) : defaultAno;
    semanas = semanasParam.split(',').map(s => parseInt(s.trim()));
  } else if (semanaParam) {
    bares = barIdParam ? [parseInt(barIdParam)] : activeBarIds;
    ano = anoParam ? parseInt(anoParam) : defaultAno;
    semanas = [parseInt(semanaParam)];
  } else {
    bares = activeBarIds;
    const lastWeeks = getLastNWeeks(6);
    ano = lastWeeks[0].ano;
    semanas = lastWeeks.map(w => w.semana);
  }
  
  const comparacoes: WeekComparison[] = [];
  
  for (const barId of bares) {
    for (const semana of semanas) {
      const comp = await compareWeek(barId, ano, semana);
      comparacoes.push(comp);
    }
  }
  
  const report = buildReport(comparacoes, bares, ano, semanas, startTime);
  
  return NextResponse.json(report, { status: 200 });
}
