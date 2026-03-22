/**
 * 🛡️ SHEETS VALIDATION - Proteção para Ingestão de Google Sheets
 * 
 * Validações estruturais ANTES de escrita no banco:
 * - Headers esperados
 * - Quantidade mínima de linhas
 * - Detecção de schema drift
 * 
 * @version 1.0.0
 * @date 2026-03-19
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============ TIPOS ============

export interface SyncMetadata {
  id: string
  bar_id: number | null
  sync_type: string
  spreadsheet_id: string | null
  sheet_name: string | null
  expected_headers: string[]
  min_rows: number
  min_columns: number
  last_sync_at: string | null
  last_row_count: number | null
  last_column_count: number | null
  last_headers: string[] | null
  is_active: boolean
  allow_fewer_rows: boolean
  row_decrease_threshold: number
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
  metadata: {
    actual_rows: number
    actual_columns: number
    actual_headers: string[]
    expected_rows: number
    expected_columns: number
    expected_headers: string[]
  }
}

export interface ValidationError {
  code: string
  message: string
  severity: 'critical' | 'error' | 'warning'
  details?: Record<string, any>
}

// ============ CÓDIGOS DE ERRO ============

export const VALIDATION_ERRORS = {
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  HEADER_MISSING: 'HEADER_MISSING',
  HEADER_ORDER_CHANGED: 'HEADER_ORDER_CHANGED',
  ROW_COUNT_BELOW_MINIMUM: 'ROW_COUNT_BELOW_MINIMUM',
  ROW_COUNT_DECREASED: 'ROW_COUNT_DECREASED',
  COLUMN_COUNT_BELOW_MINIMUM: 'COLUMN_COUNT_BELOW_MINIMUM',
  EMPTY_SHEET: 'EMPTY_SHEET',
  NO_BASELINE: 'NO_BASELINE',
} as const

// ============ FUNÇÕES DE VALIDAÇÃO ============

/**
 * Busca metadados de baseline para um sync específico
 */
export async function getSyncBaseline(
  supabase: SupabaseClient,
  syncType: string,
  barId?: number,
  sheetName?: string
): Promise<SyncMetadata | null> {
  let query = supabase
    .from('sync_metadata')
    .select('*')
    .eq('sync_type', syncType)
    .eq('is_active', true)

  if (barId) {
    query = query.eq('bar_id', barId)
  }
  
  if (sheetName) {
    query = query.eq('sheet_name', sheetName)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.warn(`⚠️ Erro ao buscar baseline: ${error.message}`)
    return null
  }

  return data
}

/**
 * Valida estrutura de dados ANTES de escrita
 */
export function validateSheetStructure(
  data: any[][],
  baseline: SyncMetadata | null,
  options: {
    headerRowIndex?: number
    strictHeaderOrder?: boolean
    allowEmptyBaseline?: boolean
  } = {}
): ValidationResult {
  const {
    headerRowIndex = 0,
    strictHeaderOrder = false,
    allowEmptyBaseline = false,
  } = options

  const errors: ValidationError[] = []
  const warnings: string[] = []

  // Dados básicos
  const actualRows = data.length - (headerRowIndex + 1) // Exclui header
  const actualHeaders = (data[headerRowIndex] || []).map(h => String(h || '').trim())
  const actualColumns = actualHeaders.length

  // Se não tem baseline e não é permitido, retorna erro
  if (!baseline && !allowEmptyBaseline) {
    return {
      valid: false,
      errors: [{
        code: VALIDATION_ERRORS.NO_BASELINE,
        message: 'Nenhum baseline encontrado para validação',
        severity: 'warning',
      }],
      warnings: ['Sync executará sem validação de baseline'],
      metadata: {
        actual_rows: actualRows,
        actual_columns: actualColumns,
        actual_headers: actualHeaders,
        expected_rows: 0,
        expected_columns: 0,
        expected_headers: [],
      }
    }
  }

  // Se não tem baseline mas é permitido, retorna válido com warning
  if (!baseline) {
    return {
      valid: true,
      errors: [],
      warnings: ['Sem baseline - primeira execução ou baseline não configurado'],
      metadata: {
        actual_rows: actualRows,
        actual_columns: actualColumns,
        actual_headers: actualHeaders,
        expected_rows: 0,
        expected_columns: 0,
        expected_headers: [],
      }
    }
  }

  const expectedHeaders = baseline.expected_headers || []
  const expectedRows = baseline.min_rows
  const expectedColumns = baseline.min_columns

  // 1. Validar dados vazios
  if (actualRows <= 0) {
    errors.push({
      code: VALIDATION_ERRORS.EMPTY_SHEET,
      message: 'Planilha está vazia ou sem dados após header',
      severity: 'critical',
      details: { actualRows }
    })
  }

  // 2. Validar quantidade mínima de colunas
  if (actualColumns < expectedColumns) {
    errors.push({
      code: VALIDATION_ERRORS.COLUMN_COUNT_BELOW_MINIMUM,
      message: `Colunas insuficientes: ${actualColumns} < ${expectedColumns} esperadas`,
      severity: 'critical',
      details: { actualColumns, expectedColumns }
    })
  }

  // 3. Validar quantidade mínima de linhas
  if (!baseline.allow_fewer_rows && actualRows < expectedRows) {
    errors.push({
      code: VALIDATION_ERRORS.ROW_COUNT_BELOW_MINIMUM,
      message: `Linhas insuficientes: ${actualRows} < ${expectedRows} mínimo`,
      severity: 'critical',
      details: { actualRows, expectedRows }
    })
  }

  // 4. Validar redução de linhas vs último sync
  if (baseline.last_row_count && baseline.row_decrease_threshold) {
    const threshold = baseline.row_decrease_threshold
    const minAllowed = Math.floor(baseline.last_row_count * (1 - threshold))
    
    if (actualRows < minAllowed) {
      errors.push({
        code: VALIDATION_ERRORS.ROW_COUNT_DECREASED,
        message: `Redução suspeita de linhas: ${actualRows} vs ${baseline.last_row_count} anterior (queda > ${threshold * 100}%)`,
        severity: 'error',
        details: { 
          actualRows, 
          lastRows: baseline.last_row_count, 
          threshold,
          minAllowed 
        }
      })
    }
  }

  // 5. Validar headers esperados
  if (expectedHeaders.length > 0) {
    const missingHeaders: string[] = []
    const orderChanged: Array<{header: string, expected: number, actual: number}> = []

    for (let i = 0; i < expectedHeaders.length; i++) {
      const expected = expectedHeaders[i]
      if (!expected || expected === '') continue // Ignora headers vazios no baseline

      const actualIndex = actualHeaders.findIndex(
        h => normalizeHeader(h) === normalizeHeader(expected)
      )

      if (actualIndex === -1) {
        missingHeaders.push(expected)
      } else if (strictHeaderOrder && actualIndex !== i) {
        orderChanged.push({ header: expected, expected: i, actual: actualIndex })
      }
    }

    if (missingHeaders.length > 0) {
      errors.push({
        code: VALIDATION_ERRORS.HEADER_MISSING,
        message: `Headers ausentes: ${missingHeaders.join(', ')}`,
        severity: 'critical',
        details: { missingHeaders, actualHeaders, expectedHeaders }
      })
    }

    if (orderChanged.length > 0) {
      warnings.push(`Ordem de headers alterada: ${orderChanged.map(h => h.header).join(', ')}`)
    }
  }

  // Resultado final
  const hasCritical = errors.some(e => e.severity === 'critical')
  const hasError = errors.some(e => e.severity === 'error')

  return {
    valid: !hasCritical && !hasError,
    errors,
    warnings,
    metadata: {
      actual_rows: actualRows,
      actual_columns: actualColumns,
      actual_headers: actualHeaders,
      expected_rows: expectedRows,
      expected_columns: expectedColumns,
      expected_headers: expectedHeaders,
    }
  }
}

/**
 * Atualiza baseline após sync bem-sucedido
 */
export async function updateSyncBaseline(
  supabase: SupabaseClient,
  syncType: string,
  barId: number | null,
  sheetName: string | null,
  metadata: {
    row_count: number
    column_count: number
    headers: string[]
  }
): Promise<void> {
  const { error } = await supabase
    .from('sync_metadata')
    .update({
      last_sync_at: new Date().toISOString(),
      last_row_count: metadata.row_count,
      last_column_count: metadata.column_count,
      last_headers: metadata.headers,
      updated_at: new Date().toISOString()
    })
    .eq('sync_type', syncType)
    .eq('bar_id', barId)
    .eq('is_active', true)

  if (error) {
    console.warn(`⚠️ Erro ao atualizar baseline: ${error.message}`)
  }
}

/**
 * Cria ou atualiza baseline inicial
 */
export async function upsertSyncBaseline(
  supabase: SupabaseClient,
  config: {
    bar_id: number | null
    sync_type: string
    spreadsheet_id?: string
    sheet_name?: string
    expected_headers: string[]
    min_rows: number
    min_columns: number
    row_decrease_threshold?: number
  }
): Promise<void> {
  const { error } = await supabase
    .from('sync_metadata')
    .upsert({
      bar_id: config.bar_id,
      sync_type: config.sync_type,
      spreadsheet_id: config.spreadsheet_id || null,
      sheet_name: config.sheet_name || null,
      expected_headers: config.expected_headers,
      min_rows: config.min_rows,
      min_columns: config.min_columns,
      row_decrease_threshold: config.row_decrease_threshold || 0.20,
      is_active: true,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'bar_id,sync_type,spreadsheet_id,sheet_name'
    })

  if (error) {
    console.warn(`⚠️ Erro ao upsert baseline: ${error.message}`)
  }
}

// ============ HELPERS ============

/**
 * Normaliza header para comparação
 */
function normalizeHeader(header: string): string {
  return String(header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Gera erro estruturado para abortar sync
 */
export function createValidationError(result: ValidationResult): Error {
  const criticalErrors = result.errors.filter(e => e.severity === 'critical' || e.severity === 'error')
  
  const errorObj = new Error(
    `[VALIDATION_FAILED] ${criticalErrors.map(e => e.message).join('; ')}`
  )
  
  // Adiciona detalhes para logging estruturado
  ;(errorObj as any).validation = {
    errors: result.errors,
    warnings: result.warnings,
    metadata: result.metadata
  }
  
  return errorObj
}

/**
 * Verifica se o erro é de validação (para tratamento específico)
 */
export function isValidationError(error: any): boolean {
  return error?.message?.startsWith('[VALIDATION_FAILED]') || error?.validation !== undefined
}

/**
 * Log formatado de resultado de validação
 */
export function logValidationResult(
  syncType: string,
  barId: number | undefined,
  result: ValidationResult
): void {
  const prefix = barId ? `[${syncType}][Bar ${barId}]` : `[${syncType}]`
  
  if (result.valid) {
    console.log(`✅ ${prefix} Validação OK - ${result.metadata.actual_rows} linhas, ${result.metadata.actual_columns} colunas`)
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.log(`  ⚠️ ${w}`))
    }
  } else {
    console.error(`❌ ${prefix} Validação FALHOU`)
    result.errors.forEach(e => {
      const icon = e.severity === 'critical' ? '🚫' : e.severity === 'error' ? '❌' : '⚠️'
      console.error(`  ${icon} [${e.code}] ${e.message}`)
    })
  }
}
