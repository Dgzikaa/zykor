/**
 * 🔍 DEBUG CMV MENSAL SHEETS - Lê dados brutos da aba CMV Mensal
 * 
 * Ferramenta de debug para visualizar os dados brutos da planilha
 * e entender por que a sincronização não está funcionando.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface DebugRequest {
  bar_id?: number
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

// ====== LÓGICA PRINCIPAL ======

serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const body: DebugRequest = await req.json().catch(() => ({}))
    const { bar_id = 3 } = body

    console.log('🔍 Debug CMV Mensal Sheets - Iniciando', { bar_id })

    // Buscar configurações do bar
    const { data: credencial, error: errCred } = await supabase
      .from('api_credentials')
      .select('bar_id, configuracoes')
      .eq('sistema', 'google_sheets')
      .eq('ativo', true)
      .eq('bar_id', bar_id)
      .single()

    if (errCred || !credencial) {
      throw new Error(`Erro ao buscar credenciais: ${errCred?.message || 'Não encontrado'}`)
    }

    const config = credencial.configuracoes as any
    const spreadsheetId = config.cmv_spreadsheet_id
    const rowMap = config.row_map_cmv_mensal

    if (!spreadsheetId) {
      throw new Error('cmv_spreadsheet_id não configurado')
    }

    console.log('📋 Spreadsheet ID:', spreadsheetId)
    console.log('📋 Row Map:', JSON.stringify(rowMap))

    const accessToken = await getGoogleAccessToken()

    // Buscar dados da aba CMV Mensal
    const range = `'CMV Mensal'!A1:Z25`
    const rows = await getSheetData(spreadsheetId, range, accessToken)
    
    console.log(`📊 ${rows.length} linhas carregadas`)

    // Retornar dados brutos para análise
    return new Response(
      JSON.stringify({
        success: true,
        bar_id: bar_id,
        spreadsheet_id: spreadsheetId,
        row_map: rowMap,
        total_linhas: rows.length,
        primeiras_20_linhas: rows.slice(0, 20),
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
