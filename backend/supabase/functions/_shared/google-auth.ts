/**
 * 🔐 MÓDULO COMPARTILHADO - AUTENTICAÇÃO GOOGLE
 * 
 * Este módulo fornece autenticação unificada para todas as funções
 * que acessam Google Drive/Sheets via Service Account.
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

// Credenciais da Service Account - carregadas de variável de ambiente
export function getCredentials(): { client_email: string; private_key: string } {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada. Configure o secret no Supabase Dashboard.')
  }
  
  try {
    const credentials = JSON.parse(serviceAccountKey)
    return {
      client_email: credentials.client_email,
      private_key: credentials.private_key
    }
  } catch (e) {
    throw new Error('Erro ao parsear GOOGLE_SERVICE_ACCOUNT_KEY: ' + (e as Error).message)
  }
}

/**
 * Obtém Access Token do Google usando Service Account
 * @param scopes - Scopes de permissão (padrão: drive.readonly + spreadsheets.readonly)
 */
export async function getGoogleAccessToken(
  scopes: string = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly'
): Promise<string> {
  const CREDENTIALS = getCredentials()
  const encoder = new TextEncoder()
  const now = Math.floor(Date.now() / 1000)
  
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: CREDENTIALS.client_email,
    sub: CREDENTIALS.client_email,
    scope: scopes,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }

  // Importar chave privada
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
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )

  // Criar assinatura
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

  // Trocar JWT por Access Token
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

/**
 * Obtém metadados de um arquivo do Google Drive
 * @param fileId - ID do arquivo no Google Drive
 * @param accessToken - Token de acesso Google
 */
export async function getFileMimeType(
  fileId: string,
  accessToken: string
): Promise<{ mimeType: string; name: string }> {
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`
  
  const response = await fetch(metadataUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Erro ao obter metadados do arquivo: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    mimeType: data.mimeType,
    name: data.name
  }
}

/**
 * Baixa um arquivo do Google Drive como Excel
 * Detecta automaticamente se é Google Sheet ou arquivo nativo e usa o endpoint correto
 * 
 * @param fileId - ID do arquivo no Google Drive
 * @param accessToken - Token de acesso Google
 */
export async function downloadDriveFileAsExcel(
  fileId: string,
  accessToken: string
): Promise<ArrayBuffer> {
  // Primeiro, obter o tipo do arquivo
  const { mimeType, name } = await getFileMimeType(fileId, accessToken)
  
  console.log(`📄 Arquivo: ${name} (${mimeType})`)
  
  let downloadUrl: string
  
  // Google Sheets → usar /export para converter para xlsx
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    console.log(`📊 Tipo: Google Sheet → usando /export`)
  } 
  // Arquivos nativos (xlsx, xls, etc) → usar ?alt=media para download direto
  else {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    console.log(`📁 Tipo: Arquivo nativo → usando ?alt=media`)
  }
  
  const fileResponse = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!fileResponse.ok) {
    throw new Error(`Erro ao baixar arquivo: ${fileResponse.status} ${fileResponse.statusText}`)
  }

  return await fileResponse.arrayBuffer()
}

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD (formato PostgreSQL)
 */
export function parseDataBR(dateStr: string): string | null {
  if (!dateStr) return null
  
  const str = String(dateStr).trim()
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3]
    return `${year}-${month}-${day}`
  }
  
  return null
}

/**
 * Converte data MM/DD/YYYY (formato US) para YYYY-MM-DD
 */
export function parseDataUS(dateStr: string): string | null {
  if (!dateStr) return null
  
  const str = String(dateStr).trim()
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  
  if (match) {
    const month = match[1].padStart(2, '0')
    const day = match[2].padStart(2, '0')
    const year = match[3]
    return `${year}-${month}-${day}`
  }
  
  return null
}

/**
 * Converte valor textual/numérico para escala 0-10
 */
export function parseNPSValue(val: unknown): number {
  if (!val || val === '' || val === 'Não') return 0
  
  const str = String(val).trim().toLowerCase()
  
  // Mapear textos descritivos para números
  const textoParaNota: { [key: string]: number } = {
    'péssimo': 1,
    'pessimo': 1,
    'ruim': 2,
    'regular': 3,
    'bom': 4,
    'ótimo': 5,
    'otimo': 5,
    'excelente': 5
  }
  
  if (textoParaNota[str]) {
    return textoParaNota[str]
  }
  
  // Tentar converter para número
  const num = typeof val === 'number' ? val : parseFloat(str.replace('%', '').replace(',', '.'))
  
  if (isNaN(num) || num < 0) return 0
  
  // Manter escala original 0-10
  if (num >= 0 && num <= 10) {
    return Math.round(num * 10) / 10
  }
  
  return 0
}
