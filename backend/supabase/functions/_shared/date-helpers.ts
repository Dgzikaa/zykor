/**
 * 📅 DATE HELPERS - Utilitários de Data ISO Week
 * 
 * Funções puras para manipulação de datas no padrão ISO 8601.
 * Usadas para cálculos de semana ISO, ranges de datas, etc.
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

/**
 * Retorna o número da semana ISO 8601 para uma data.
 * 
 * ISO 8601: Semana começa na segunda-feira.
 * A primeira semana do ano é aquela que contém o primeiro quinta-feira.
 * 
 * @param date - Data para calcular a semana
 * @returns Número da semana (1-53)
 * 
 * @example
 * getISOWeek(new Date('2026-01-05')) // 2
 * getISOWeek(new Date('2026-03-19')) // 12
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Retorna o ano ISO 8601 para uma data.
 * 
 * O ano ISO pode diferir do ano calendário em datas próximas à virada do ano.
 * Ex: 2025-12-31 pode pertencer à semana 1 de 2026.
 * 
 * @param date - Data para calcular o ano ISO
 * @returns Ano ISO (pode ser diferente do ano calendário)
 */
export function getISOYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Retorna as datas de início (segunda) e fim (domingo) de uma semana ISO.
 * 
 * @param year - Ano ISO
 * @param week - Número da semana ISO (1-53)
 * @returns Objeto com datas de início e fim no formato YYYY-MM-DD
 * 
 * @example
 * getWeekDateRange(2026, 12) // { start: '2026-03-16', end: '2026-03-22' }
 */
export function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

/**
 * Formata uma data para o padrão YYYY-MM-DD.
 * 
 * @param date - Data a formatar
 * @returns String no formato YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Retorna a data de hoje no timezone UTC.
 * 
 * @returns Nova instância de Date representando hoje em UTC
 */
export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Calcula uma data X dias atrás a partir de uma data de referência.
 * 
 * @param days - Número de dias para subtrair
 * @param from - Data de referência (default: hoje)
 * @returns Nova data X dias antes
 */
export function daysAgo(days: number, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Verifica se uma data está dentro de um range.
 * 
 * @param date - Data a verificar
 * @param start - Início do range (YYYY-MM-DD)
 * @param end - Fim do range (YYYY-MM-DD)
 * @returns true se a data está dentro do range (inclusive)
 */
export function isDateInRange(date: Date, start: string, end: string): boolean {
  const dateStr = formatDateISO(date);
  return dateStr >= start && dateStr <= end;
}

/**
 * Retorna informações completas da semana ISO para uma data.
 * 
 * @param date - Data de referência
 * @returns Objeto com ano, semana e range de datas
 */
export function getWeekInfo(date: Date): {
  year: number;
  week: number;
  start: string;
  end: string;
} {
  const year = getISOYear(date);
  const week = getISOWeek(date);
  const { start, end } = getWeekDateRange(year, week);
  return { year, week, start, end };
}
