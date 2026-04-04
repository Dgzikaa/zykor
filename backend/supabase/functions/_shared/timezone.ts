// =====================================================
// 🇧🇷 TIMEZONE UTILS PARA EDGE FUNCTIONS - BRASÍLIA
// Padroniza timezone em todas as edge functions
// =====================================================

export const TIMEZONE = 'America/Sao_Paulo';
export const BRASIL_TIMEZONE = 'America/Sao_Paulo';
export const BRASIL_LOCALE = 'pt-BR';
export const UTC_OFFSET = -3;
export const UTC_OFFSET_STRING = '-03:00';
export const UTC_OFFSET_STRING_COMPACT = '-0300';

/**
 * Retorna data/hora atual no timezone do Brasil para Edge Functions
 */
export function agoraEdgeFunction(): Date {
  // Edge functions rodam em UTC, então convertemos manualmente
  const utcNow = new Date();
  return new Date(utcNow.getTime() + (UTC_OFFSET * 60 * 60 * 1000));
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (Brasil)
 */
export function todayBRT(): string {
  return agoraEdgeFunction().toISOString().split('T')[0];
}

/**
 * Converte data YYYY-MM-DD para formato ISO com timezone Brasil
 * Ex: 2024-10-15 -> 2024-10-15T00:00:00-03:00
 */
export function toBRTISO(dateString: string): string {
  return `${dateString}T00:00:00${UTC_OFFSET_STRING}`;
}

/**
 * Converte data YYYY-MM-DD para formato ISO compacto com timezone Brasil
 * Ex: 2024-10-15 -> 2024-10-15T00:00:00-0300
 */
export function toBRTISOCompact(dateString: string): string {
  return `${dateString}T00:00:00${UTC_OFFSET_STRING_COMPACT}`;
}

/**
 * Retorna Date convertido para timezone do Brasil
 */
export function toBRT(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Converte qualquer data para timezone do Brasil
 */
export function paraBrasiliaEdge(data: string | Date): Date {
  const dateObj = typeof data === 'string' ? new Date(data) : data;
  const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const brasilOffset = -3; // UTC-3
  return new Date(utcTime + (brasilOffset * 60 * 60 * 1000));
}

/**
 * Formata data no padrão brasileiro para Edge Functions
 */
export function formatarDataEdge(data: string | Date): string {
  if (!data) return 'N/A';
  
  try {
    const dateObj = paraBrasiliaEdge(data);
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    const dia = String(dateObj.getDate()).padStart(2, '0');
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const ano = dateObj.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Formata data e hora no padrão brasileiro para Edge Functions
 */
export function formatarDataHoraEdge(data: string | Date): string {
  if (!data) return 'N/A';
  
  try {
    const dateObj = paraBrasiliaEdge(data);
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    const dia = String(dateObj.getDate()).padStart(2, '0');
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const ano = dateObj.getFullYear();
    const hora = String(dateObj.getHours()).padStart(2, '0');
    const minuto = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  } catch {
    return 'N/A';
  }
}

/**
 * Retorna timestamp ISO no timezone do Brasil para Edge Functions
 */
export function timestampBrasiliaEdge(): string {
  return agoraEdgeFunction().toISOString();
}

/**
 * Log com timestamp do Brasil para Edge Functions
 */
export function logBrasiliaEdge(message: string, ...args: any[]): void {
  const timestamp = formatarDataHoraEdge(agoraEdgeFunction());
  console.log(`[${timestamp} BRT] ${message}`, ...args);
}

/**
 * Verifica se é horário comercial no Brasil (8h-18h)
 */
export function isHorarioComercialEdge(): boolean {
  const agoraBrasil = agoraEdgeFunction();
  const hora = agoraBrasil.getHours();
  return hora >= 8 && hora < 18;
}

/**
 * Retorna data de hoje no formato YYYY-MM-DD (Brasil) para Edge Functions
 */
export function dataHojeBrasilEdge(): string {
  const hoje = agoraEdgeFunction();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Debug de timezone para Edge Functions
 */
export function debugTimezoneEdge(): object {
  const utcNow = new Date();
  const brasilNow = agoraEdgeFunction();
  
  return {
    utc: utcNow.toISOString(),
    brasil: brasilNow.toISOString(),
    brasil_formatado: formatarDataHoraEdge(brasilNow),
    timezone: BRASIL_TIMEZONE,
    offset: '-03:00'
  };
} 