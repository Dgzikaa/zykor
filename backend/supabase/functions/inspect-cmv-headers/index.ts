/**
 * Inspeciona os HEADERS (linha de semanas) da planilha CMV
 * Retorna: qual coluna tem qual semana e qual ano
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

async function getSheetData(spreadsheetId: string, range: string, accessToken: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`
  
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const barId = parseInt(url.searchParams.get('bar_id') || '4')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: cred } = await supabase
      .from('api_credentials')
      .select('configuracoes')
      .eq('bar_id', barId)
      .eq('sistema', 'google_sheets')
      .single()

    const spreadsheetId = (cred?.configuracoes as any)?.cmv_spreadsheet_id
    if (!spreadsheetId) {
      return new Response(JSON.stringify({
        success: false,
        error: `cmv_spreadsheet_id não configurado para bar_id ${barId}`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const accessToken = await getGoogleAccessToken()
    
    const sheets = await listSheets(spreadsheetId, accessToken)
    
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
    
    // Buscar apenas as primeiras 3 linhas para ver headers
    const range = `'${targetSheet}'!A1:CZ3`
    const rows = await getSheetData(spreadsheetId, range, accessToken)
    
    // Parsear os headers para encontrar semanas
    const semanas: Array<{col: number, colLetter: string, header: string, semana?: number, ano?: number}> = []
    
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx] || []
      for (let col = 0; col < row.length; col++) {
        const cell = String(row[col] || '').trim()
        
        // Procurar por padrões como "Semana XX" ou "XX/YYYY" ou "XXXX" (ano)
        const matchSemana = cell.match(/semana\s*(\d+)/i)
        const matchAno = cell.match(/\b(20\d{2})\b/)
        
        if (matchSemana || matchAno) {
          const colLetter = String.fromCharCode(65 + (col % 26))
          semanas.push({
            col,
            colLetter: col < 26 ? colLetter : String.fromCharCode(65 + Math.floor(col/26) - 1) + colLetter,
            header: cell,
            semana: matchSemana ? parseInt(matchSemana[1]) : undefined,
            ano: matchAno ? parseInt(matchAno[1]) : undefined
          })
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      bar_id: barId,
      spreadsheet_id: spreadsheetId,
      aba: targetSheet,
      abas_disponiveis: sheets,
      primeiras_linhas: rows,
      semanas_encontradas: semanas,
      total_colunas: rows[0]?.length || 0,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
