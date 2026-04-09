/**
 * 📊 SYNC CMV SHEETS - Versão 7.0
 * 
 * Edge Function para sincronizar dados do CMV Semanal usando Google Sheets API.
 * 
 * v7.0: BLOCO 3A - Agora lê row_map_cmv_semanal de api_credentials.configuracoes
 *       Fallback para mapeamento hardcoded se não encontrar no banco.
 * 
 * v6.0: Lê CMV Real diretamente da planilha (linha 15) ao invés de calcular.
 *       A fórmula do Sheets é: =(BF4+BF5-BF6)-SOMA(BF7;BF8;BF9;BF10;BF11;BF12)+BF14+BF13
 *       Também lê consumos das linhas 7-11 (já com fator 35% aplicado).
 * 
 * @version 7.0.0
 * @date 2026-03-19
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  getSyncBaseline, 
  validateSheetStructure, 
  updateSyncBaseline,
  createValidationError,
  logValidationResult,
  isValidationError
} from '../_shared/sheets-validation.ts'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'

import { getCorsHeaders } from '../_shared/cors.ts'

interface SyncRequest {
  bar_id?: number
  ano?: number
  semana?: number
  todas_semanas?: boolean
  debug?: boolean
}

// ====== FALLBACK ROW MAP (usado se banco não tiver configuração) ======
// IMPORTANTE: Índices são 0-based (linha 4 do Excel = índice 3)
// Este fallback usa valores do Ordinário (bar 3) como padrão seguro
// ATENÇÃO: O Deboche tem o bloco CMA 2 linhas acima - use row_map específico no banco!
const FALLBACK_ROW_MAP = {
  estoque_inicial: 3,
  compras: 4,
  estoque_final: 5,
  consumo_socios: 6,
  consumo_beneficios: 7,
  consumo_rh_operacao: 8,
  consumo_rh_escritorio: 9,
  consumo_artista: 10,
  outros_ajustes: 11,
  bonificacao_contrato: 12,
  outras_bonificacoes: 12,
  cmv_real_planilha: 14,        // Corrigido: linha 15 = índice 14
  cmv_teorico_pct: 17,           // Corrigido: linha 18 = índice 17
  estoque_inicial_cozinha: 22,
  estoque_inicial_bebidas: 23,
  estoque_inicial_drinks: 24,
  estoque_final_cozinha: 28,
  estoque_final_bebidas: 29,
  estoque_final_drinks: 30,
  total_consumo_socios: 54,
  mesa_beneficios_cliente: 55,
  mesa_banda_dj: 56,
  mesa_rh_operacao: 58,
  mesa_rh_escritorio: 59,
  estoque_inicial_funcionarios: 67,  // Ordinário: linha 68
  compras_alimentacao: 68,            // Ordinário: linha 69
  estoque_final_funcionarios: 69,    // Ordinário: linha 70
}

interface RowMapType {
  estoque_inicial: number
  compras: number
  estoque_final: number
  consumo_socios: number
  consumo_beneficios: number
  consumo_rh_operacao: number
  consumo_rh_escritorio: number
  consumo_artista: number
  outros_ajustes: number
  bonificacao_contrato: number
  outras_bonificacoes: number
  cmv_real_planilha: number
  cmv_teorico_pct: number
  estoque_inicial_cozinha: number
  estoque_inicial_bebidas: number
  estoque_inicial_drinks: number
  estoque_final_cozinha: number
  estoque_final_bebidas: number
  estoque_final_drinks: number
  total_consumo_socios: number
  mesa_beneficios_cliente: number
  mesa_banda_dj: number
  mesa_rh_operacao: number
  mesa_rh_escritorio: number
  estoque_inicial_funcionarios: number
  compras_alimentacao: number
  estoque_final_funcionarios: number
}

// ====== AUTENTICAÇÃO GOOGLE ======

function getCredentials(): { client_email: string; private_key: string } {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada')
  }
  const credentials = JSON.parse(serviceAccountKey)
  return {
    client_email: credentials.client_email,
    private_key: credentials.private_key
  }
}

async function getGoogleAccessToken(): Promise<string> {
  const CREDENTIALS = getCredentials()
  const encoder = new TextEncoder()
  const now = Math.floor(Date.now() / 1000)
  const scopes = 'https://www.googleapis.com/auth/spreadsheets.readonly'
  
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: CREDENTIALS.client_email,
    sub: CREDENTIALS.client_email,
    scope: scopes,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }

  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = CREDENTIALS.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signatureInput = `${headerB64}.${payloadB64}`
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  )
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  
  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(`Google Auth Error: ${data.error_description || data.error}`)
  }
  
  return data.access_token
}

// ====== GOOGLE SHEETS API ======

async function getSheetData(spreadsheetId: string, range: string, accessToken: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erro ao buscar planilha: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.values || []
}

async function listSheets(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Erro ao listar abas: ${response.status}`)
  }

  const data = await response.json()
  return data.sheets?.map((s: any) => s.properties?.title).filter(Boolean) || []
}

// ====== HELPERS DE PARSING ======

function parseMonetario(val: any): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0
  if (typeof val === 'number') return val
  
  const str = String(val).trim()
  let cleaned = str.replace(/R\$\s*/gi, '').replace(/\s/g, '')
  
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  }
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parsePercentual(val: any): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0
  if (typeof val === 'number') return val < 1 ? val * 100 : val
  
  const str = String(val).trim().replace('%', '').replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

function extrairNumeroSemana(header: string): number | null {
  if (!header) return null
  const match = String(header).match(/semana\s*(\d+)/i)
  return match ? parseInt(match[1]) : null
}

function extrairAnoDeData(dataStr: string | number): number | null {
  if (dataStr === null || dataStr === undefined || dataStr === '') return null
  
  // Se for número (serial date do Excel), converter
  if (typeof dataStr === 'number') {
    // Excel serial date: dias desde 1900-01-01 (com bug do leap year 1900)
    const excelEpoch = new Date(1899, 11, 30) // 30/12/1899
    const date = new Date(excelEpoch.getTime() + dataStr * 24 * 60 * 60 * 1000)
    return date.getFullYear()
  }
  
  // Formato DD/MM/YYYY
  const match = String(dataStr).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) {
    return parseInt(match[3])
  }
  return null
}

// ====== LÓGICA PRINCIPAL ======

serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  let heartbeatId: number | null = null
  let startTime: number = Date.now()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const body: SyncRequest = await req.json().catch(() => ({}))
    const { bar_id, ano, semana, todas_semanas = true, debug = false } = body

    console.log('📊 Sync CMV Sheets v7.0 - Iniciando', { bar_id, ano, semana, todas_semanas })

    const hbResult = await heartbeatStart(supabase, 'sync-cmv-sheets', bar_id || null, null, 'pgcron')
    heartbeatId = hbResult.heartbeatId
    startTime = hbResult.startTime

    const baresQuery = supabase
      .from('api_credentials')
      .select('bar_id, configuracoes')
      .eq('sistema', 'google_sheets')
      .eq('ativo', true)

    if (bar_id) {
      baresQuery.eq('bar_id', bar_id)
    }

    const { data: credenciais, error: errCred } = await baresQuery

    if (errCred) {
      throw new Error(`Erro ao buscar credenciais: ${errCred.message}`)
    }

    const { data: bares } = await supabase
      .from('bares')
      .select('id, nome')
      .in('id', credenciais?.map(c => c.bar_id) || [])

    const baresMap = new Map(bares?.map(b => [b.id, b.nome]) || [])

    const baresConfig = credenciais
      ?.map(c => ({
        bar_id: c.bar_id,
        nome: baresMap.get(c.bar_id) || `Bar ${c.bar_id}`,
        cmv_spreadsheet_id: (c.configuracoes as any)?.cmv_spreadsheet_id || null,
        configuracoes: c.configuracoes as any
      }))
      .filter(b => b.cmv_spreadsheet_id) || []

    if (baresConfig.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum bar com cmv_spreadsheet_id configurado' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🏪 Processando ${baresConfig.length} bar(es)`)

    const accessToken = await getGoogleAccessToken()
    const resultadosPorBar: any[] = []

    for (const barConfig of baresConfig) {
      console.log(`\n🍺 Processando: ${barConfig.nome} (bar_id=${barConfig.bar_id})`)
      
      // BLOCO 3A: Lê row_map do banco, fallback para hardcoded
      let rowMapFromDb = barConfig.configuracoes?.row_map_cmv_semanal as RowMapType | undefined
      
      // BLOCO 3B: Se for Deboche e não tiver row_map, criar automaticamente
      if (barConfig.bar_id === 4 && !rowMapFromDb) {
        console.log(`🔧 [ROW_MAP] Deboche sem configuração - criando row_map específico...`)
        
        const DEBOCHE_ROW_MAP = {
          estoque_inicial: 3,
          compras: 4,
          estoque_final: 5,
          consumo_socios: 6,
          consumo_beneficios: 7,
          consumo_rh_operacao: 8,
          consumo_rh_escritorio: 9,
          consumo_artista: 10,
          outros_ajustes: 11,
          bonificacao_contrato: 12,
          outras_bonificacoes: 12,
          cmv_real_planilha: 14,
          cmv_teorico_pct: 17,
          estoque_inicial_cozinha: 22,
          estoque_inicial_bebidas: 23,
          estoque_inicial_drinks: 24,
          estoque_final_cozinha: 28,
          estoque_final_bebidas: 29,
          estoque_final_drinks: 30,
          total_consumo_socios: 54,
          mesa_beneficios_cliente: 55,
          mesa_banda_dj: 56,
          mesa_rh_operacao: 58,
          mesa_rh_escritorio: 59,
          estoque_inicial_funcionarios: 65,  // Deboche: linha 66
          compras_alimentacao: 66,            // Deboche: linha 67
          estoque_final_funcionarios: 67,    // Deboche: linha 68
        }
        
        // Atualizar no banco
        const configNova = {
          ...barConfig.configuracoes,
          row_map_cmv_semanal: DEBOCHE_ROW_MAP
        }
        
        await supabase
          .from('api_credentials')
          .update({ configuracoes: configNova })
          .eq('bar_id', 4)
          .eq('sistema', 'google_sheets')
        
        rowMapFromDb = DEBOCHE_ROW_MAP as RowMapType
        console.log(`✅ [ROW_MAP] Row map do Deboche criado e salvo no banco`)
      }
      
      const ROW_MAP: RowMapType = rowMapFromDb || FALLBACK_ROW_MAP
      
      if (rowMapFromDb) {
        console.log(`📋 [ROW_MAP] Bar ${barConfig.bar_id}: usando configuração do banco`)
      } else {
        console.log(`⚠️ [ROW_MAP] Bar ${barConfig.bar_id}: usando fallback hardcoded`)
      }

      try {
        const sheets = await listSheets(barConfig.cmv_spreadsheet_id!, accessToken)
        console.log(`📑 Abas encontradas: ${sheets.join(', ')}`)
        
        let targetSheet = sheets.find((name: string) => 
          name.toLowerCase().includes('cmv') && name.toLowerCase().includes('semanal')
        )
        if (!targetSheet) {
          targetSheet = sheets.find((name: string) => 
            name.toLowerCase().includes('cmv') || name.toLowerCase().includes('semanal')
          )
        }
        if (!targetSheet) {
          targetSheet = sheets[0]
        }
        
        console.log(`📋 Usando aba: "${targetSheet}"`)
        
        // Range expandido para incluir mais colunas (até GZ = ~208 colunas)
        const range = `'${targetSheet}'!A1:GZ80`
        const rows = await getSheetData(barConfig.cmv_spreadsheet_id!, range, accessToken)
        
        console.log(`📊 ${rows.length} linhas carregadas`)
        
        // ========== VALIDAÇÃO ESTRUTURAL ==========
        const baseline = await getSyncBaseline(supabase, 'cmv', barConfig.bar_id)
        const validationResult = validateSheetStructure(rows, baseline, {
          headerRowIndex: 0,
          allowEmptyBaseline: true
        })
        
        logValidationResult('cmv', barConfig.bar_id, validationResult)
        
        // Validação flexível: só bloquear se for erro crítico de estrutura
        // Mudanças de colunas (ex: Semana 1 removida) são esperadas e não devem bloquear
        const errosCriticos = validationResult.errors?.filter(e => 
          e.code !== 'HEADER_MISSING' && e.code !== 'COLUMN_COUNT_CHANGED'
        ) || []
        
        if (!validationResult.valid && errosCriticos.length > 0) {
          throw createValidationError(validationResult)
        }
        // ========== FIM VALIDAÇÃO ==========
        
        let headerRowIndex = -1
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i] || []
          if (row.some((cell: any) => String(cell).toLowerCase().includes('semana'))) {
            headerRowIndex = i
            break
          }
        }

        if (headerRowIndex === -1) {
          console.warn(`⚠️ Header de semanas não encontrado`)
          resultadosPorBar.push({ bar_id: barConfig.bar_id, bar_nome: barConfig.nome, success: false, error: 'Header não encontrado' })
          continue
        }

        const headers = rows[headerRowIndex] || []
        const dateRow = rows[headerRowIndex + 1] || [] // Linha de datas (DD/MM/YYYY)
        
        // Mapeia coluna -> {semana, ano}
        const colunaSemanaAno: Map<number, {semana: number, ano: number}> = new Map()
        for (let col = 1; col < headers.length; col++) {
          const numSemana = extrairNumeroSemana(String(headers[col] || ''))
          // Tenta extrair o ano da célula de data; se falhar, usa o 'ano' do request como fallback
          let anoColuna = extrairAnoDeData(dateRow[col])
          if (anoColuna === null && ano) {
            anoColuna = ano
          }
          
          if (numSemana !== null && anoColuna !== null) {
            colunaSemanaAno.set(col, { semana: numSemana, ano: anoColuna })
          }
        }

        console.log(`📅 ${colunaSemanaAno.size} semanas identificadas com ano`)
        console.log(`📊 Total de colunas na planilha: ${headers.length}`)

        let semanasAtualizadas = 0
        let semanasErro = 0
        
        // Debug: mostrar algumas semanas identificadas
        const debugSemanas = Array.from(colunaSemanaAno.entries()).slice(0, 5)
        console.log(`🔍 Primeiras 5 semanas: ${JSON.stringify(debugSemanas)}`)

        for (const [col, info] of colunaSemanaAno) {
          const { semana: numSemana, ano: anoColuna } = info
          
          // Se um ano específico foi solicitado, filtrar
          if (ano && anoColuna !== ano) continue
          if (semana && !todas_semanas && numSemana !== semana) continue

          const updateData: any = { updated_at: new Date().toISOString() }
          let temDados = false

          // Estoques totais - IMPORTANTE: aceitar valores >= 0 (não só > 0)
          const estoqueInicialVal = rows[ROW_MAP.estoque_inicial]?.[col]
          const estoqueInicialNum = parseMonetario(estoqueInicialVal)
          
          // Debug para primeiras semanas
          if (debug && numSemana <= 3) {
            console.log(`🔍 S${numSemana}/${anoColuna} col=${col}: estoque_inicial raw=${estoqueInicialVal}, parsed=${estoqueInicialNum}`)
          }
          
          if (estoqueInicialVal !== undefined && estoqueInicialNum >= 0) {
            updateData.estoque_inicial = estoqueInicialNum
            temDados = true
          }
          
          // Estoque Final - aceitar valores >= 0
          const estoqueFinalVal = rows[ROW_MAP.estoque_final]?.[col]
          const estoqueFinalNum = parseMonetario(estoqueFinalVal)
          if (estoqueFinalVal !== undefined && estoqueFinalNum >= 0) {
            updateData.estoque_final = estoqueFinalNum
            temDados = true
          }
          
          // COMPRAS do período (linha 5) - FALTAVA!
          const comprasVal = rows[ROW_MAP.compras]?.[col]
          const comprasNum = parseMonetario(comprasVal)
          
          // Debug para primeiras semanas
          if (debug && numSemana <= 3) {
            console.log(`🔍 S${numSemana}/${anoColuna}: compras raw=${comprasVal}, parsed=${comprasNum}`)
          }
          
          // REMOVIDO: Compras devem vir SEMPRE do Conta Azul, não do Sheets
          // As compras são atualizadas pela função cmv-semanal-auto
          // if (comprasVal !== undefined && comprasNum >= 0) {
          //   updateData.compras_periodo = comprasNum
          //   temDados = true
          // }
          
          // CMV Teórico
          const cmvTeoricoVal = rows[ROW_MAP.cmv_teorico_pct]?.[col]
          if (cmvTeoricoVal !== undefined) {
            const v = parsePercentual(cmvTeoricoVal)
            if (v > 0) { updateData.cmv_teorico_percentual = v; temDados = true }
          }
          
          // Bonificações
          const bonifContratoVal = rows[ROW_MAP.bonificacao_contrato]?.[col]
          if (bonifContratoVal !== undefined) {
            const v = parseMonetario(bonifContratoVal)
            if (v > 0) { updateData.bonificacao_contrato_anual = v; temDados = true }
          }
          
          const outrasBonifVal = rows[ROW_MAP.outras_bonificacoes]?.[col]
          if (outrasBonifVal !== undefined) {
            const v = parseMonetario(outrasBonifVal)
            if (v > 0) { updateData.ajuste_bonificacoes = v; temDados = true }
          }
          
          const outrosAjustesVal = rows[ROW_MAP.outros_ajustes]?.[col]
          if (outrosAjustesVal !== undefined) {
            const v = parseMonetario(outrosAjustesVal)
            if (v > 0) { updateData.outros_ajustes = v; temDados = true }
          }
          
          // ESTOQUE INICIAL detalhado
          const estIniCozinhaVal = rows[ROW_MAP.estoque_inicial_cozinha]?.[col]
          if (estIniCozinhaVal !== undefined) {
            const v = parseMonetario(estIniCozinhaVal)
            if (v > 0) { updateData.estoque_inicial_cozinha = v; temDados = true }
          }
          
          const estIniBebidasVal = rows[ROW_MAP.estoque_inicial_bebidas]?.[col]
          if (estIniBebidasVal !== undefined) {
            const v = parseMonetario(estIniBebidasVal)
            if (v > 0) { updateData.estoque_inicial_bebidas = v; temDados = true }
          }
          
          const estIniDrinksVal = rows[ROW_MAP.estoque_inicial_drinks]?.[col]
          if (estIniDrinksVal !== undefined) {
            const v = parseMonetario(estIniDrinksVal)
            if (v > 0) { updateData.estoque_inicial_drinks = v; temDados = true }
          }
          
          // ESTOQUE FINAL detalhado
          const estFimCozinhaVal = rows[ROW_MAP.estoque_final_cozinha]?.[col]
          if (estFimCozinhaVal !== undefined) {
            const v = parseMonetario(estFimCozinhaVal)
            if (v > 0) { updateData.estoque_final_cozinha = v; temDados = true }
          }
          
          const estFimBebidasVal = rows[ROW_MAP.estoque_final_bebidas]?.[col]
          if (estFimBebidasVal !== undefined) {
            const v = parseMonetario(estFimBebidasVal)
            if (v > 0) { updateData.estoque_final_bebidas = v; temDados = true }
          }
          
          const estFimDrinksVal = rows[ROW_MAP.estoque_final_drinks]?.[col]
          if (estFimDrinksVal !== undefined) {
            const v = parseMonetario(estFimDrinksVal)
            if (v > 0) { updateData.estoque_final_drinks = v; temDados = true }
          }
          
          // CONSUMOS (linhas 7-11 - usados na fórmula CMV)
          // Esses valores já têm o fator 35% aplicado na planilha
          const consumoSociosVal = rows[ROW_MAP.consumo_socios]?.[col]
          if (consumoSociosVal !== undefined) {
            const v = parseMonetario(consumoSociosVal)
            updateData.consumo_socios = v
            temDados = true
          }
          
          const consumoBenefVal = rows[ROW_MAP.consumo_beneficios]?.[col]
          if (consumoBenefVal !== undefined) {
            const v = parseMonetario(consumoBenefVal)
            updateData.consumo_beneficios = v
            temDados = true
          }
          
          const consumoRhOpVal = rows[ROW_MAP.consumo_rh_operacao]?.[col]
          const consumoRhEscVal = rows[ROW_MAP.consumo_rh_escritorio]?.[col]
          const rhOp = parseMonetario(consumoRhOpVal)
          const rhEsc = parseMonetario(consumoRhEscVal)
          updateData.consumo_rh = rhOp + rhEsc
          temDados = true
          
          const consumoArtistaVal = rows[ROW_MAP.consumo_artista]?.[col]
          if (consumoArtistaVal !== undefined) {
            const v = parseMonetario(consumoArtistaVal)
            updateData.consumo_artista = v
            temDados = true
          }
          
          // CMV Real calculado pela planilha (linha 15) - aceita valores negativos
          // IMPORTANTE: A planilha pode ter ajustes manuais que não conseguimos replicar
          const cmvRealPlanilhaVal = rows[ROW_MAP.cmv_real_planilha]?.[col]
          if (cmvRealPlanilhaVal !== undefined) {
            const v = parseMonetario(cmvRealPlanilhaVal)
            updateData.cmv_real = v
            temDados = true
          }
          
          // CONTAS ESPECIAIS (linhas 55-60 - valores brutos para relatórios)
          const totalConsumoSociosVal = rows[ROW_MAP.total_consumo_socios]?.[col]
          if (totalConsumoSociosVal !== undefined) {
            const v = parseMonetario(totalConsumoSociosVal)
            if (v > 0) { updateData.total_consumo_socios = v; temDados = true }
          }
          
          const mesaBenefVal = rows[ROW_MAP.mesa_beneficios_cliente]?.[col]
          if (mesaBenefVal !== undefined) {
            const v = parseMonetario(mesaBenefVal)
            if (v > 0) { updateData.mesa_beneficios_cliente = v; temDados = true }
          }
          
          const mesaBandaVal = rows[ROW_MAP.mesa_banda_dj]?.[col]
          if (mesaBandaVal !== undefined) {
            const v = parseMonetario(mesaBandaVal)
            if (v > 0) { updateData.mesa_banda_dj = v; temDados = true }
          }
          
          // SAÍDA ALIMENTAÇÃO (funcionários) - aceitar valores >= 0
          const estIniFuncVal = rows[ROW_MAP.estoque_inicial_funcionarios]?.[col]
          if (estIniFuncVal !== undefined) {
            const v = parseMonetario(estIniFuncVal)
            if (v >= 0) {
              updateData.estoque_inicial_funcionarios = v
              temDados = true
            }
          }
          
          // Compras Alimentação (funcionários) - aceitar valores >= 0
          const comprasAlimVal = rows[ROW_MAP.compras_alimentacao]?.[col]
          if (comprasAlimVal !== undefined) {
            // REMOVIDO: Compras Alimentação também vem do Conta Azul
            // const v = parseMonetario(comprasAlimVal)
            // if (v >= 0) {
            //   updateData.compras_alimentacao = v
            //   temDados = true
            // }
          }

          const estFimFuncVal = rows[ROW_MAP.estoque_final_funcionarios]?.[col]
          if (estFimFuncVal !== undefined) {
            const v = parseMonetario(estFimFuncVal)
            if (v >= 0) {
              updateData.estoque_final_funcionarios = v
              temDados = true
            }
          }

          if (!temDados) continue

          const { data: existente } = await supabase
            .from('cmv_semanal')
            .select('id')
            .eq('bar_id', barConfig.bar_id)
            .eq('ano', anoColuna)
            .eq('semana', numSemana)
            .single()

          if (existente) {
            const { error: updateError } = await supabase
              .from('cmv_semanal')
              .update(updateData)
              .eq('id', existente.id)

            if (updateError) {
              console.error(`❌ Erro ${anoColuna}/S${numSemana}:`, updateError.message)
              semanasErro++
            } else {
              if (debug) {
                console.log(`✅ ${anoColuna}/S${numSemana}:`, JSON.stringify(updateData))
              }
              semanasAtualizadas++
            }
          } else {
            // Criar o registro se não existir
            const insertData = {
              bar_id: barConfig.bar_id,
              ano: anoColuna,
              semana: numSemana,
              ...updateData
            }
            const { error: insertError } = await supabase
              .from('cmv_semanal')
              .insert(insertData)
            
            if (insertError) {
              console.error(`❌ Erro criar ${anoColuna}/S${numSemana}:`, insertError.message)
              semanasErro++
            } else {
              if (debug) {
                console.log(`➕ Criado ${anoColuna}/S${numSemana}`)
              }
              semanasAtualizadas++
            }
          }
        }

        console.log(`✅ ${barConfig.nome}: ${semanasAtualizadas} semanas atualizadas, ${semanasErro} erros`)

        // ========== RECALCULAR CMV LIMPO % ==========
        // CMV Limpo % = CMV Real / Faturamento Líquido * 100
        console.log(`\n🧮 Recalculando CMV Limpo %...`)
        
        // Coletar os anos processados no loop (pode ser mais de um se a planilha tiver semanas de anos diferentes)
        const anosProcessados = new Set(Array.from(colunaSemanaAno.values()).map(v => v.ano))
        // Fallback: se nenhum ano foi processado (0 semanas), usa o 'ano' do request ou busca todos
        const queryAnos = anosProcessados.size > 0 ? anosProcessados : (ano ? new Set([ano]) : null)
        
        const recalcQuery = supabase
          .from('cmv_semanal')
          .select('id, cmv_real, vendas_liquidas')
          .eq('bar_id', barConfig.bar_id)
          .not('cmv_real', 'is', null)
        
        // Filtrar por ano somente se tivermos anos específicos
        if (queryAnos && queryAnos.size === 1) {
          recalcQuery.eq('ano', Array.from(queryAnos)[0])
        }
        
        const { data: semanasParaRecalcular } = await recalcQuery
        
        for (const sem of semanasParaRecalcular || []) {
          const cmvLimpoPercentual = sem.vendas_liquidas > 0 
            ? (sem.cmv_real / sem.vendas_liquidas) * 100 
            : 0
          
          await supabase
            .from('cmv_semanal')
            .update({ 
              cmv_limpo_percentual: cmvLimpoPercentual,
              updated_at: new Date().toISOString()
            })
            .eq('id', sem.id)
        }
        
        console.log(`✅ ${semanasParaRecalcular?.length || 0} semanas recalculadas`)

        // ========== PROPAGAÇÃO OBRIGATÓRIA DE ESTOQUE INICIAL ==========
        // REGRA CONTÁBIL: Estoque Inicial semana N = Estoque Final semana N-1
        // Esta propagação roda APÓS importar os dados da planilha para garantir consistência
        console.log(`\n🔄 Propagando estoque inicial (regra contábil)...`)
        
        // Buscar todas as semanas do bar ordenadas por ano/semana
        const { data: todasSemanas } = await supabase
          .from('cmv_semanal')
          .select('id, ano, semana, estoque_final, estoque_final_cozinha, estoque_final_bebidas, estoque_final_drinks, estoque_final_funcionarios')
          .eq('bar_id', barConfig.bar_id)
          .order('ano', { ascending: true })
          .order('semana', { ascending: true })

        if (todasSemanas && todasSemanas.length > 1) {
          let propagacoes = 0
          
          for (let i = 1; i < todasSemanas.length; i++) {
            const semanaAtual = todasSemanas[i]
            const semanaAnterior = todasSemanas[i - 1]
            
            // Verificar se é sequencial (mesma ano ou ano seguinte)
            const isSequencial = 
              (semanaAtual.ano === semanaAnterior.ano && semanaAtual.semana === semanaAnterior.semana + 1) ||
              (semanaAtual.ano === semanaAnterior.ano + 1 && semanaAtual.semana === 1 && semanaAnterior.semana >= 52)
            
            if (!isSequencial) continue
            
            // Só propagar se a semana anterior tiver estoque_final > 0
            // (zero = dado ausente/não calculado, não estoque vazio real)
            if (!semanaAnterior.estoque_final || semanaAnterior.estoque_final <= 0) continue
            
            // Propagar estoque final da semana anterior como inicial da atual
            const { error: propError } = await supabase
              .from('cmv_semanal')
              .update({
                estoque_inicial: semanaAnterior.estoque_final,
                estoque_inicial_cozinha: semanaAnterior.estoque_final_cozinha,
                estoque_inicial_bebidas: semanaAnterior.estoque_final_bebidas,
                estoque_inicial_drinks: semanaAnterior.estoque_final_drinks,
                estoque_inicial_funcionarios: semanaAnterior.estoque_final_funcionarios,
                updated_at: new Date().toISOString()
              })
              .eq('id', semanaAtual.id)
            
            if (!propError) {
              propagacoes++
              if (debug) {
                console.log(`  ✅ S${semanaAtual.semana}/${semanaAtual.ano}: inicial = final S${semanaAnterior.semana} (R$ ${semanaAnterior.estoque_final?.toFixed(2) || 0})`)
              }
            }
          }
          
          console.log(`✅ ${propagacoes} propagações de estoque inicial realizadas`)
        }
        // ========== FIM PROPAGAÇÃO ==========

        // Atualizar baseline após sync bem-sucedido
        await updateSyncBaseline(supabase, 'cmv', barConfig.bar_id, null, {
          row_count: rows.length,
          column_count: (rows[0] || []).length,
          headers: (headers || []).slice(0, 20).map((h: any) => String(h || ''))
        })

        resultadosPorBar.push({
          bar_id: barConfig.bar_id,
          bar_nome: barConfig.nome,
          success: true,
          semanas_atualizadas: semanasAtualizadas,
          semanas_erro: semanasErro
        })

      } catch (barError: any) {
        console.error(`❌ Erro ${barConfig.nome}:`, barError.message)
        
        const errorType = isValidationError(barError) ? 'VALIDATION_FAILED' : 'SYNC_ERROR'
        
        resultadosPorBar.push({ 
          bar_id: barConfig.bar_id, 
          bar_nome: barConfig.nome, 
          success: false, 
          error: barError.message,
          error_type: errorType,
          validation_details: barError.validation || null
        })
      }
    }

    const totalAtualizadas = resultadosPorBar.filter(r => r.success).reduce((acc, r) => acc + (r.semanas_atualizadas || 0), 0)

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, totalAtualizadas, { bares: resultadosPorBar.length })

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV Sheets v7.0 sincronizado: ${totalAtualizadas} semanas atualizadas`,
        resultados_por_bar: resultadosPorBar,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    await heartbeatError(supabase, heartbeatId, startTime, error)
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
