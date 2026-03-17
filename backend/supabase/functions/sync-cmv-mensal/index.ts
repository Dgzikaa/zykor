/**
 * 📊 SYNC CMV MENSAL - Sincroniza dados da aba "CMV Mensal" da planilha
 * 
 * Lê os dados mensais diretamente da planilha do Google Sheets
 * e insere/atualiza na tabela cmv_mensal.
 * 
 * @version 1.0.0
 * @date 2026-03-17
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  bar_id?: number
  ano?: number
  debug?: boolean
}

// Mapeamento de linhas da aba CMV Mensal (0-indexed) - DEBOCHE
const ROW_MAP_DEBOCHE = {
  header_meses: 0,      // Linha 1: Nome do bar + datas dos meses
  data_inicio: 1,       // Linha 2: "de" + datas início
  data_fim: 2,          // Linha 3: "a" + datas fim
  estoque_inicial: 3,   // Linha 4: Estoque Inicial
  compras: 4,           // Linha 5: Compras
  estoque_final: 5,     // Linha 6: Estoque Final
  consumo_socios: 6,    // Linha 7: Consumo Sócios
  consumo_beneficios: 7,// Linha 8: Consumo Benefícios
  consumo_rh_op: 8,     // Linha 9: Consumo RH Operação
  consumo_rh_esc: 9,    // Linha 10: Consumo RH Escritório
  consumo_artista: 10,  // Linha 11: Consumo Artista
  outros_ajustes: 11,   // Linha 12: Outros Ajustes
  ajuste_bonif: 12,     // Linha 13: Ajuste Bonificações
  cmv_real: 13,         // Linha 14: CMV Real (R$)
  fat_cmvivel: 14,      // Linha 15: Faturamento CMVível
  cmv_limpo_pct: 15,    // Linha 16: CMV Limpo (%)
  cmv_teorico_pct: 16,  // Linha 17: CMV Teórico (%)
  gap: 17,              // Linha 18: GAP
  fat_total: 18,        // Linha 19: Fat Total
  cmv_real_pct: 19,     // Linha 20: CMV Real %
  ano_linha: 21,        // Linha 22: Anos
}

// Mapeamento de linhas da aba CMV Mensal (0-indexed) - ORDINÁRIO
// Estrutura diferente: começa direto com datas na linha 1
const ROW_MAP_ORDINARIO = {
  header_meses: 0,      // Linha 1: Datas dos meses
  data_inicio: 0,       // Usa a mesma linha 1 para datas
  data_fim: -1,         // Não tem linha separada
  estoque_inicial: 1,   // Linha 2: Estoque Inicial
  compras: 2,           // Linha 3: Compras
  estoque_final: 3,     // Linha 4: Estoque Final
  consumo_socios: 4,    // Linha 5: Consumo Sócios
  consumo_beneficios: 5,// Linha 6: Consumo Benefícios
  consumo_artista: 6,   // Linha 7: Consumo Artista (ordem diferente!)
  consumo_rh_op: 7,     // Linha 8: Consumo RH Operação
  consumo_rh_esc: 8,    // Linha 9: Consumo RH Escritório
  outros_ajustes: -1,   // Não tem
  ajuste_bonif: 9,      // Linha 10: Ajuste Bonificações
  cmv_real: 10,         // Linha 11: CMV Real (R$)
  fat_cmvivel: 11,      // Linha 12: Faturamento CMVível
  cmv_limpo_pct: 12,    // Linha 13: CMV Limpo (%)
  cmv_teorico_pct: 13,  // Linha 14: CMV Teórico (%)
  gap: 14,              // Linha 15: GAP
  fat_total: 15,        // Linha 16: Fat Total
  cmv_real_pct: 16,     // Linha 17: CMV Real %
  ano_linha: -1,        // Não tem linha de anos (calcula da data)
}

function getRowMap(barId: number) {
  return barId === 3 ? ROW_MAP_ORDINARIO : ROW_MAP_DEBOCHE
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
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SyncRequest = await req.json().catch(() => ({}))
    const { bar_id, ano, debug = false } = body

    console.log('📊 Sync CMV Mensal - Iniciando', { bar_id, ano })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

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
        cmv_spreadsheet_id: (c.configuracoes as any)?.cmv_spreadsheet_id || null
      }))
      .filter(b => b.cmv_spreadsheet_id) || []

    if (baresConfig.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum bar com cmv_spreadsheet_id configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🏪 Processando ${baresConfig.length} bar(es)`)

    const accessToken = await getGoogleAccessToken()
    const resultadosPorBar: any[] = []

    for (const barConfig of baresConfig) {
      console.log(`\n🍺 Processando: ${barConfig.nome} (bar_id=${barConfig.bar_id})`)

      try {
        // Buscar dados da aba CMV Mensal
        const range = `'CMV Mensal'!A1:Z25`
        const rows = await getSheetData(barConfig.cmv_spreadsheet_id!, range, accessToken)
        
        console.log(`📊 ${rows.length} linhas carregadas da aba CMV Mensal`)

        // Obter mapeamento de linhas para este bar
        const ROW_MAP = getRowMap(barConfig.bar_id)
        
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

        for (const [col, info] of colunasMeses) {
          // Filtrar por ano se especificado
          if (ano && info.ano !== ano) continue

          const updateData: any = {
            bar_id: barConfig.bar_id,
            ano: info.ano,
            mes: info.mes,
            data_inicio: info.dataInicio,
            data_fim: info.dataFim,
            updated_at: new Date().toISOString()
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
          updateData.ajuste_bonificacoes = parseMonetario(getVal(ROW_MAP.ajuste_bonif, col))
          updateData.cmv_real = parseMonetario(getVal(ROW_MAP.cmv_real, col))
          updateData.faturamento_cmvivel = parseMonetario(getVal(ROW_MAP.fat_cmvivel, col))
          updateData.cmv_limpo_percentual = parsePercentual(getVal(ROW_MAP.cmv_limpo_pct, col))
          updateData.cmv_teorico_percentual = parsePercentual(getVal(ROW_MAP.cmv_teorico_pct, col))
          updateData.gap = parsePercentual(getVal(ROW_MAP.gap, col))
          updateData.faturamento_total = parseMonetario(getVal(ROW_MAP.fat_total, col))
          updateData.cmv_real_percentual = parsePercentual(getVal(ROW_MAP.cmv_real_pct, col))

          // Verificar se tem dados válidos
          if (updateData.estoque_inicial === 0 && updateData.compras === 0 && updateData.cmv_real === 0) {
            if (debug) console.log(`⏭️ ${info.ano}/${info.mes}: sem dados válidos`)
            continue
          }

          if (debug) {
            console.log(`📝 ${info.ano}/${info.mes}:`, JSON.stringify({
              est_ini: updateData.estoque_inicial,
              compras: updateData.compras,
              est_fim: updateData.estoque_final,
              cmv_real: updateData.cmv_real
            }))
          }

          // Upsert no banco
          const { error: upsertError } = await supabase
            .from('cmv_mensal')
            .upsert(updateData, {
              onConflict: 'bar_id,ano,mes'
            })

          if (upsertError) {
            console.error(`❌ Erro ${info.ano}/${info.mes}:`, upsertError.message)
            mesesErro++
          } else {
            mesesAtualizados++
          }
        }

        console.log(`✅ ${barConfig.nome}: ${mesesAtualizados} meses atualizados, ${mesesErro} erros`)

        resultadosPorBar.push({
          bar_id: barConfig.bar_id,
          bar_nome: barConfig.nome,
          success: true,
          meses_atualizados: mesesAtualizados,
          meses_erro: mesesErro
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV Mensal sincronizado: ${totalAtualizados} meses atualizados`,
        resultados_por_bar: resultadosPorBar,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
