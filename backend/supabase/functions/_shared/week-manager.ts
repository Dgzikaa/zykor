/**
 * 📊 WEEK MANAGER - Gerenciamento de Semanas de Desempenho
 * 
 * Lógica para garantir existência de registros semanais em gold.desempenho (granularidade='semanal').
 * Evita o "sumiço" de semanas novas antes do primeiro recálculo.
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

import { getISOWeek, getWeekDateRange, getISOYear } from './date-helpers.ts';

// Fallback temporário caso banco indisponível
const FALLBACK_BAR_IDS = [3, 4] as const;

// DEPRECATED: Usar getActiveBarIds() em vez disso
// Mantido para compatibilidade temporária
export const ACTIVE_BAR_IDS = FALLBACK_BAR_IDS;

/**
 * Busca IDs dos bares ativos do banco de dados.
 * Fallback para lista hardcoded se erro.
 */
export async function getActiveBarIds(supabase: any): Promise<readonly number[]> {
  try {
    const { data, error } = await supabase
      .schema('operations')
      .from('bares')
      .select('id')
      .eq('ativo', true)
      .order('id');
    
    if (error || !data || data.length === 0) {
      console.log('[WeekManager] Fallback ativado: usando lista hardcoded de bares');
      return FALLBACK_BAR_IDS;
    }
    
    return data.map((b: { id: number }) => b.id);
  } catch {
    console.log('[WeekManager] Erro ao buscar bares, usando fallback');
    return FALLBACK_BAR_IDS;
  }
}

export interface WeekRecord {
  id?: number;
  bar_id: number;
  ano: number;
  numero_semana: number;
  data_inicio: string;
  data_fim: string;
}

export interface EnsureWeekResult {
  bar_id: number;
  ano: number;
  numero_semana: number;
  created: boolean;
  existing_id?: number;
}

/**
 * Garante que existe um registro para a semana atual de um bar específico.
 * Se não existir, cria um novo registro vazio.
 * 
 * @param supabase - Cliente Supabase configurado
 * @param barId - ID do bar
 * @param date - Data de referência (default: hoje)
 * @returns Resultado da operação
 */
export async function ensureWeekExists(
  supabase: any,
  barId: number,
  date: Date = new Date()
): Promise<EnsureWeekResult> {
  const ano = getISOYear(date);
  const semana = getISOWeek(date);
  const { start, end } = getWeekDateRange(ano, semana);

  const { data: existing, error: selectError } = await supabase
    .schema('gold')
    .from('desempenho')
    .select('id')
    .eq('bar_id', barId)
    .eq('granularidade', 'semanal')
    .eq('ano', ano)
    .eq('numero_semana', semana)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Erro ao verificar semana existente: ${selectError.message}`);
  }

  if (existing) {
    return {
      bar_id: barId,
      ano,
      numero_semana: semana,
      created: false,
      existing_id: existing.id,
    };
  }

  // gold.desempenho tem apenas `calculado_em` (default no banco) — sem created_at/updated_at
  const { error: insertError } = await supabase
    .schema('gold')
    .from('desempenho')
    .insert({
      bar_id: barId,
      ano,
      numero_semana: semana,
      granularidade: 'semanal',
      data_inicio: start,
      data_fim: end,
    });

  if (insertError) {
    throw new Error(`Erro ao criar semana: ${insertError.message}`);
  }

  console.log(`📅 [WeekManager] Criada semana ${semana}/${ano} para bar ${barId}`);

  return {
    bar_id: barId,
    ano,
    numero_semana: semana,
    created: true,
  };
}

/**
 * Garante que existe um registro para a semana atual de TODOS os bares ativos.
 * 
 * @param supabase - Cliente Supabase configurado
 * @param date - Data de referência (default: hoje)
 * @returns Array com resultados por bar
 */
export async function ensureCurrentWeekForAllBars(
  supabase: any,
  date: Date = new Date()
): Promise<EnsureWeekResult[]> {
  const results: EnsureWeekResult[] = [];

  // Buscar bares ativos do banco
  const barIds = await getActiveBarIds(supabase);

  for (const barId of barIds) {
    const result = await ensureWeekExists(supabase, barId, date);
    results.push(result);
  }

  return results;
}

/**
 * Busca todas as semanas de um bar em um período.
 * 
 * @param supabase - Cliente Supabase configurado
 * @param barId - ID do bar
 * @param dataLimite - Data mínima (YYYY-MM-DD)
 * @param limite - Máximo de semanas a retornar
 * @returns Array de registros de semana
 */
export async function getWeeksForBar(
  supabase: any,
  barId: number,
  dataLimite: string,
  limite: number = 6
): Promise<WeekRecord[]> {
  const { data, error } = await supabase
    .schema('gold')
    .from('desempenho')
    .select('*')
    .eq('bar_id', barId)
    .eq('granularidade', 'semanal')
    .gte('data_fim', dataLimite)
    .order('data_fim', { ascending: false })
    .limit(limite);

  if (error) {
    throw new Error(`Erro ao buscar semanas: ${error.message}`);
  }

  return data || [];
}

/**
 * Busca semanas de todos os bares ativos em um período.
 * 
 * @param supabase - Cliente Supabase configurado
 * @param dataLimite - Data mínima (YYYY-MM-DD)
 * @param limitePorBar - Máximo de semanas por bar
 * @returns Array consolidado de registros de semana
 */
export async function getWeeksForAllBars(
  supabase: any,
  dataLimite: string,
  limitePorBar: number = 6
): Promise<WeekRecord[]> {
  const allWeeks: WeekRecord[] = [];

  // Buscar bares ativos do banco
  const barIds = await getActiveBarIds(supabase);

  for (const barId of barIds) {
    const weeks = await getWeeksForBar(supabase, barId, dataLimite, limitePorBar);
    allWeeks.push(...weeks);
  }

  return allWeeks;
}

/**
 * Retorna informações da semana atual para logging/debug.
 * 
 * @param date - Data de referência (default: hoje)
 * @returns Objeto com informações da semana
 */
export function getCurrentWeekInfo(date: Date = new Date()): {
  ano: number;
  semana: number;
  inicio: string;
  fim: string;
  dataReferencia: string;
} {
  const ano = getISOYear(date);
  const semana = getISOWeek(date);
  const { start, end } = getWeekDateRange(ano, semana);

  return {
    ano,
    semana,
    inicio: start,
    fim: end,
    dataReferencia: date.toISOString().split('T')[0],
  };
}
