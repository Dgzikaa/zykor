/**
 * 📊 Google Sheets Config - Configuração de Planilhas
 * 
 * Módulo compartilhado para buscar configurações de planilhas Google Sheets
 * do banco de dados por bar_id e sistema.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SheetsConfig {
  spreadsheet_id: string;
  api_key?: string;
  sistema: string;
  bar_id: number;
  nome_planilha?: string;
  descricao?: string;
}

/**
 * Buscar configuração do Google Sheets por sistema e bar_id
 */
export async function buscarConfigSheets(
  supabase: SupabaseClient,
  sistema: string,
  barId: number
): Promise<SheetsConfig | null> {
  try {
    const { data, error } = await supabase
      .from('api_credentials')
      .select('spreadsheet_id, api_key, sistema, bar_id')
      .eq('sistema', sistema)
      .eq('bar_id', barId)
      .eq('ativo', true)
      .single();
    
    if (error) {
      console.error(`❌ Erro ao buscar config Sheets (${sistema}):`, error);
      return null;
    }
    
    return data as SheetsConfig;
  } catch (error) {
    console.error('❌ Erro ao buscar configuração do Sheets:', error);
    return null;
  }
}

/**
 * Buscar spreadsheet_id por sistema
 */
export async function buscarSpreadsheetId(
  supabase: SupabaseClient,
  sistema: string,
  barId: number
): Promise<string | null> {
  const config = await buscarConfigSheets(supabase, sistema, barId);
  return config?.spreadsheet_id || null;
}

/**
 * Buscar API key do Google Sheets
 */
export function getGoogleSheetsApiKey(): string {
  const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
  
  if (!apiKey) {
    throw new Error('GOOGLE_SHEETS_API_KEY não configurada');
  }
  
  return apiKey;
}

/**
 * Construir URL da API do Google Sheets
 */
export function buildSheetsApiUrl(
  spreadsheetId: string,
  range: string,
  apiKey?: string
): string {
  const key = apiKey || getGoogleSheetsApiKey();
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${key}`;
}

/**
 * Buscar dados de uma planilha
 */
export async function fetchSheetData(
  spreadsheetId: string,
  range: string,
  apiKey?: string
): Promise<any[][]> {
  try {
    const url = buildSheetsApiUrl(spreadsheetId, range, apiKey);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar dados do Sheets: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.values || [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados do Google Sheets:', error);
    throw new Error(`Falha ao buscar Sheets: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Buscar múltiplas ranges de uma vez
 */
export async function fetchMultipleRanges(
  spreadsheetId: string,
  ranges: string[],
  apiKey?: string
): Promise<Record<string, any[][]>> {
  try {
    const key = apiKey || getGoogleSheetsApiKey();
    const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}&key=${key}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar múltiplas ranges: ${response.status}`);
    }
    
    const data = await response.json();
    
    const resultado: Record<string, any[][]> = {};
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const valueRange = data.valueRanges[i];
      resultado[range] = valueRange?.values || [];
    }
    
    return resultado;
  } catch (error) {
    console.error('❌ Erro ao buscar múltiplas ranges:', error);
    throw new Error(`Falha ao buscar ranges: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Validar se spreadsheet_id é válido
 */
export function validarSpreadsheetId(spreadsheetId: string): boolean {
  return /^[a-zA-Z0-9-_]{20,}$/.test(spreadsheetId);
}

/**
 * Extrair spreadsheet_id de uma URL do Google Sheets
 */
export function extrairSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Sistemas de planilhas disponíveis
 */
export const SISTEMAS_SHEETS = {
  INSUMOS: 'google_sheets_insumos',
  CONTAGEM: 'google_sheets_contagem',
  FICHAS_TECNICAS: 'google_sheets_fichas_tecnicas',
  ORCAMENTACAO: 'google_sheets_orcamentacao',
  CMV: 'google_sheets_cmv',
  NPS: 'google_sheets_nps',
  VOZ_CLIENTE: 'google_sheets_voz_cliente',
} as const;
