/**
 * 📊 SYNC CMV MENSAL - Sincroniza dados da aba "CMV Mensal" da planilha
 * 
 * Lê os dados mensais diretamente da planilha do Google Sheets
 * e insere/atualiza na tabela cmv_mensal.
 * 
 * v2.0: BLOCO 3A - Agora lê row_map_cmv_mensal de api_credentials.configuracoes
 *       Fallback para mapeamento hardcoded se não encontrar no banco.
 *       Campos com valor -1 representam "linha inexistente" na planilha.
 * 
 * @version 2.0.0
 * @date 2026-03-19
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'

import { getCorsHeaders } from '../_shared/cors.ts'

interface SyncRequest {
  bar_id?: number
  ano?: number
  debug?: boolean
  preview_only?: boolean // se true, lê do Sheets e retorna sem salvar no banco (útil pra debug)
}

// ====== FALLBACK ROW MAP MENSAL (usado se banco não tiver configuração) ======
// Valores de -1 significam "campo inexistente na planilha"
// Este fallback usa valores do Ordinário (bar 3) como padrão seguro
const FALLBACK_ROW_MAP_MENSAL = {
  header_meses: 0,
  data_inicio: 0,
  data_fim: -1,
  estoque_inicial: 1,
  compras: 2,
  estoque_final: 3,
  consumo_socios: 4,
  consumo_beneficios: 5,
  consumo_artista: 6,
  consumo_rh_op: 7,
  consumo_rh_esc: 8,
  outros_ajustes: -1,
  ajuste_bonif: 9,
  cmv_real: 10,
  fat_cmvivel: 11,
  cmv_limpo_pct: 12,
  cmv_teorico_pct: 13,
  gap: 14,
  fat_total: 15,
  cmv_real_pct: 16,
  ano_linha: -1,
}

interface RowMapMensalType {
  header_meses: number
  data_inicio: number
  data_fim: number
  estoque_inicial: number
  compras: number
  estoque_final: number
  consumo_socios: number
  consumo_beneficios: number
  consumo_artista: number
  consumo_rh_op: number
  consumo_rh_esc: number
  outros_ajustes: number
  ajuste_bonif: number
  cmv_real: number
  fat_cmvivel: number
  cmv_limpo_pct: number
  cmv_teorico_pct: number
  gap: number
  fat_total: number
  cmv_real_pct: number
  ano_linha: number
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

// ====== HELPERS ======

function parseMonetario(val: any): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0
  if (typeof val === 'string' && val.includes('REF!')) return 0
  if (typeof val === 'string' && val.includes('DIV/0')) return 0
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
  if (typeof val === 'string' && val.includes('REF!')) return 0
  if (typeof val === 'string' && val.includes('DIV/0')) return 0
  if (typeof val === 'number') {
    // Se for menor que 1, provavelmente é decimal (0.35 = 35%)
    return val < 1 && val > -1 ? val * 100 : val
  }
  
  const str = String(val).trim().replace('%', '').replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

function excelDateToJS(serial: number): Date {
  const excelEpoch = new Date(1899, 11, 30)
  return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
}

function getMesFromExcelDate(serial: number): { mes: number; ano: number } {
  const date = excelDateToJS(serial)
  return { mes: date.getMonth() + 1, ano: date.getFullYear() }
}

function formatDate(serial: number): string {
  const date = excelDateToJS(serial)
  return date.toISOString().split('T')[0]
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
    const { bar_id, ano, debug = false, preview_only = false } = body

    console.log('📊 Sync CMV Mensal v2.0 - Iniciando', { bar_id, ano })

    const hbResult = await heartbeatStart(supabase, 'sync-cmv-mensal', bar_id || null, null, 'pgcron')
    heartbeatId = hbResult.heartbeatId
    startTime = hbResult.startTime

    // Buscar configurações dos bares
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
      const rowMapFromDb = barConfig.configuracoes?.row_map_cmv_mensal as RowMapMensalType | undefined
      const ROW_MAP: RowMapMensalType = rowMapFromDb || FALLBACK_ROW_MAP_MENSAL
      
      if (rowMapFromDb) {
        console.log(`📋 [ROW_MAP] Bar ${barConfig.bar_id}: usando configuração do banco`)
      } else {
        console.log(`⚠️ [ROW_MAP] Bar ${barConfig.bar_id}: usando fallback hardcoded`)
      }

      try {
        // Buscar dados da aba CMV Mensal
        const range = `'CMV Mensal'!A1:Z25`
        const rows = await getSheetData(barConfig.cmv_spreadsheet_id!, range, accessToken)
        
        console.log(`📊 ${rows.length} linhas carregadas da aba CMV Mensal`)
        
        // Identificar colunas por mês/ano
        const anosRow = ROW_MAP.ano_linha >= 0 ? (rows[ROW_MAP.ano_linha] || []) : []
        const dataInicioRow = rows[ROW_MAP.data_inicio] || []
        const dataFimRow = ROW_MAP.data_fim >= 0 ? (rows[ROW_MAP.data_fim] || []) : []

        // Mapear colunas para meses
        const colunasMeses: Map<number, { mes: number; ano: number; dataInicio: string; dataFim: string }> = new Map()
        
        for (let col = 1; col < dataInicioRow.length; col++) {
          const dataInicioSerial = dataInicioRow[col]
          const dataFimSerial = dataFimRow[col]
          const anoColuna = anosRow[col]

          if (typeof dataInicioSerial === 'number' && dataInicioSerial > 40000) {
            const dataInicioJS = excelDateToJS(dataInicioSerial)
            // Aceita apenas colunas mensais genuínas: data_inicio = dia 1 do mês.
            // (Algumas planilhas têm colunas semanais misturadas na aba "CMV Mensal" — ex: Deb tem
            // col Q=01/04 mensal, mas R/S/T/U começam em 08/04, 15/04, 22/04, 29/04 (semanas).
            // Sem esse filtro, a última coluna semanal sobrescrevia o mensal correto.)
            if (dataInicioJS.getDate() !== 1) continue

            const { mes, ano: anoCalculado } = getMesFromExcelDate(dataInicioSerial)
            const anoFinal = typeof anoColuna === 'number' ? anoColuna : anoCalculado

            colunasMeses.set(col, {
              mes,
              ano: anoFinal,
              dataInicio: formatDate(dataInicioSerial),
              dataFim: typeof dataFimSerial === 'number' ? formatDate(dataFimSerial) : ''
            })
          }
        }

        console.log(`📅 ${colunasMeses.size} meses identificados`)

        let mesesAtualizados = 0
        let mesesErro = 0
        const previewMeses: any[] = []

        for (const [col, info] of colunasMeses) {
          // Filtrar por ano se especificado
          if (ano && info.ano !== ano) continue

          const updateData: any = {
            bar_id: barConfig.bar_id,
            ano: info.ano,
            mes: info.mes,
            data_inicio: info.dataInicio,
            updated_at: new Date().toISOString()
          }
          
          // Adicionar data_fim apenas se existir
          if (info.dataFim) {
            updateData.data_fim = info.dataFim
          }

          // Extrair valores (verificando se a linha existe)
          const getVal = (rowIdx: number, col: number) => rowIdx >= 0 && rows[rowIdx] ? rows[rowIdx][col] : undefined
          
          updateData.estoque_inicial = parseMonetario(getVal(ROW_MAP.estoque_inicial, col))
          updateData.compras = parseMonetario(getVal(ROW_MAP.compras, col))
          updateData.estoque_final = parseMonetario(getVal(ROW_MAP.estoque_final, col))
          updateData.consumo_socios = parseMonetario(getVal(ROW_MAP.consumo_socios, col))
          updateData.consumo_beneficios = parseMonetario(getVal(ROW_MAP.consumo_beneficios, col))
          updateData.consumo_rh_operacao = parseMonetario(getVal(ROW_MAP.consumo_rh_op, col))
          updateData.consumo_rh_escritorio = parseMonetario(getVal(ROW_MAP.consumo_rh_esc, col))
          updateData.consumo_artista = parseMonetario(getVal(ROW_MAP.consumo_artista, col))
          updateData.outros_ajustes = parseMonetario(getVal(ROW_MAP.outros_ajustes, col))
          // Bonificações são 100% manuais (UI cmv_mensal). NÃO ler da planilha.
          // updateData.ajuste_bonificacoes — preservado pelo upsert via DEFAULT
          updateData.cmv_real = parseMonetario(getVal(ROW_MAP.cmv_real, col))
          updateData.faturamento_cmvivel = parseMonetario(getVal(ROW_MAP.fat_cmvivel, col))
          updateData.cmv_limpo_percentual = parsePercentual(getVal(ROW_MAP.cmv_limpo_pct, col))
          updateData.cmv_teorico_percentual = parsePercentual(getVal(ROW_MAP.cmv_teorico_pct, col))
          updateData.gap = parsePercentual(getVal(ROW_MAP.gap, col))
          updateData.faturamento_total = parseMonetario(getVal(ROW_MAP.fat_total, col))
          updateData.cmv_real_percentual = parsePercentual(getVal(ROW_MAP.cmv_real_pct, col))
          
          // Campos CMA (Custo de Alimentação) - inicializar com 0 se não existirem na planilha
          updateData.estoque_inicial_funcionarios = 0
          updateData.compras_alimentacao = 0
          updateData.estoque_final_funcionarios = 0
          updateData.cma_total = 0
          
          // Fonte dos dados
          updateData.fonte = 'planilha'

          // Verificar se tem dados válidos (mais permissivo - aceita se tiver qualquer valor)
          const temDados = updateData.estoque_inicial !== 0 || 
                          updateData.compras !== 0 || 
                          updateData.estoque_final !== 0 ||
                          updateData.cmv_real !== 0 ||
                          updateData.faturamento_cmvivel !== 0
          
          // Preview mode: coleta o que LERIA do Sheets sem upsertar
          if (preview_only) {
            previewMeses.push({
              ano: info.ano,
              mes: info.mes,
              data_inicio: info.dataInicio,
              data_fim: info.dataFim,
              col_planilha: col,
              raw: {
                estoque_inicial_raw: getVal(ROW_MAP.estoque_inicial, col),
                compras_raw: getVal(ROW_MAP.compras, col),
                estoque_final_raw: getVal(ROW_MAP.estoque_final, col),
                cmv_real_raw: getVal(ROW_MAP.cmv_real, col),
                fat_cmvivel_raw: getVal(ROW_MAP.fat_cmvivel, col),
              },
              parsed: {
                estoque_inicial: updateData.estoque_inicial,
                compras: updateData.compras,
                estoque_final: updateData.estoque_final,
                cmv_real: updateData.cmv_real,
                fat_cmvivel: updateData.faturamento_cmvivel,
                tem_dados: temDados,
              }
            })
            continue
          }

          if (!temDados) {
            if (debug) console.log(`⏭️ ${info.ano}/${info.mes}: sem dados válidos`)
            continue
          }

          console.log(`📝 ${info.ano}/${info.mes}:`, JSON.stringify({
            est_ini: updateData.estoque_inicial,
            compras: updateData.compras,
            est_fim: updateData.estoque_final,
            cmv_real: updateData.cmv_real,
            fat_cmvivel: updateData.faturamento_cmvivel
          }))

          // Upsert no banco
          const { error: upsertError } = await supabase
            .schema('financial')
            .from('cmv_mensal')
            .upsert(updateData, {
              onConflict: 'bar_id,ano,mes'
            })

          if (upsertError) {
            console.error(`❌ Erro ${info.ano}/${info.mes}:`, upsertError.message)
            console.error(`   Detalhes:`, JSON.stringify(upsertError))
            console.error(`   Dados:`, JSON.stringify(updateData))
            mesesErro++
          } else {
            console.log(`✅ ${info.ano}/${info.mes}: sucesso`)
            mesesAtualizados++
          }
        }

        console.log(`✅ ${barConfig.nome}: ${mesesAtualizados} meses atualizados, ${mesesErro} erros`)

        resultadosPorBar.push({
          bar_id: barConfig.bar_id,
          bar_nome: barConfig.nome,
          success: true,
          meses_atualizados: mesesAtualizados,
          meses_erro: mesesErro,
          ...(preview_only ? { preview_meses: previewMeses } : {})
        })

      } catch (barError: any) {
        console.error(`❌ Erro ${barConfig.nome}:`, barError.message)
        resultadosPorBar.push({ 
          bar_id: barConfig.bar_id, 
          bar_nome: barConfig.nome, 
          success: false, 
          error: barError.message 
        })
      }
    }

    const totalAtualizados = resultadosPorBar.filter(r => r.success).reduce((acc, r) => acc + (r.meses_atualizados || 0), 0)

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, totalAtualizados, { bares: resultadosPorBar.length })

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV Mensal v2.0 sincronizado: ${totalAtualizados} meses atualizados`,
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
