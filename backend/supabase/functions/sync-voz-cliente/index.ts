import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { read, utils } from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credenciais da Service Account
function getCredentials() {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada.')
  }
  
  try {
    const credentials = JSON.parse(serviceAccountKey)
    return {
      client_email: credentials.client_email,
      private_key: credentials.private_key
    }
  } catch (e) {
    throw new Error('Erro ao parsear GOOGLE_SERVICE_ACCOUNT_KEY: ' + e.message)
  }
}

// ID da planilha Voz do Cliente
const VOZ_CLIENTE_FILE_ID = '10YoLlCX1K5bPI6qeZ56wagFSY8q7oOMCOJVgObNEKdo'

interface VozClienteRow {
  bar_id: number
  data_feedback: string
  semana: number | null
  dia_semana: string | null
  feedback: string
  tom: string
  categoria: string | null
  fonte: string | null
  criticidade: string | null
  responsavel: string | null
  status: string | null
}

// Função para obter Access Token usando Service Account
async function getAccessToken(): Promise<string> {
  const CREDENTIALS = getCredentials()
  const encoder = new TextEncoder()
  const now = Math.floor(Date.now() / 1000)
  
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: CREDENTIALS.client_email,
    sub: CREDENTIALS.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
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
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
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

// Função para converter data DD/MM/YYYY para YYYY-MM-DD
function parseData(dateStr: string): string | null {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { bar_id } = body

    console.log('🔄 Iniciando sincronização da Voz do Cliente...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obter Access Token
    console.log('🔑 Obtendo Access Token...')
    const accessToken = await getAccessToken()
    console.log('✅ Token obtido!')

    // 2. Baixar arquivo Excel do Google Drive
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${VOZ_CLIENTE_FILE_ID}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    
    const fileResponse = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!fileResponse.ok) {
      throw new Error(`Erro ao baixar arquivo: ${fileResponse.status} ${fileResponse.statusText}`)
    }

    const arrayBuffer = await fileResponse.arrayBuffer()
    console.log(`✅ Arquivo baixado! (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`)

    // 3. Processar Excel
    console.log('📊 Processando planilha...')
    const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })
    
    console.log(`📑 Abas encontradas: ${workbook.SheetNames.join(', ')}`)

    // Mapeamento de abas para bar_id
    const abaParaBar: { [key: string]: number } = {
      'Ordinário - VDC': 3,
      'Deboche - VDC': 4
    }

    const resultados: { bar_id: number, bar_nome: string, processados: number, inseridos: number }[] = []
    
    // Processar cada aba relevante
    for (const [abaNome, barIdAba] of Object.entries(abaParaBar)) {
      // Se bar_id foi especificado, processar apenas esse bar
      if (bar_id && barIdAba !== bar_id) continue

      const sheet = workbook.Sheets[abaNome]
      if (!sheet) {
        console.warn(`⚠️ Aba "${abaNome}" não encontrada`)
        continue
      }

      console.log(`\n🏪 Processando aba: ${abaNome} (bar_id: ${barIdAba})`)

      // Converter para JSON
      const jsonData = utils.sheet_to_json(sheet, { 
        header: 1,
        defval: '',
        raw: false
      }) as any[][]

      console.log(`📊 ${jsonData.length} linhas encontradas`)
      
      // Log do cabeçalho para debug
      if (jsonData.length > 0) {
        console.log('📋 Cabeçalho:', jsonData[0].slice(0, 12))
      }

      // Estrutura da planilha Voz do Cliente:
      // A: Feedbacks | B: Tom | C: Categoria | D: Fonte | E: Criticidade | F: Responsável | G: Status | H: Dia da semana | I: Semana | J: Data
      const registros: VozClienteRow[] = []
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        
        const feedback = String(row[0] || '').trim()
        if (!feedback || feedback.length < 3) continue

        const tom = String(row[1] || '').trim()
        if (!tom || !['Positivo', 'Negativo', 'Sugestão', 'Neutro'].includes(tom)) {
          // Tentar normalizar o tom
          const tomLower = tom.toLowerCase()
          let tomNormalizado = 'Neutro'
          if (tomLower.includes('positiv')) tomNormalizado = 'Positivo'
          else if (tomLower.includes('negativ')) tomNormalizado = 'Negativo'
          else if (tomLower.includes('sugest')) tomNormalizado = 'Sugestão'
          
          if (tomNormalizado === 'Neutro' && !tomLower) continue
        }

        const dataFeedback = parseData(String(row[9] || ''))
        if (!dataFeedback) {
          // Tentar usar data da coluna J (índice 9) ou ignorar linha
          if (i <= 5) console.warn(`⚠️ Linha ${i + 1}: Data inválida - "${row[9]}"`)
          continue
        }

        const registro: VozClienteRow = {
          bar_id: barIdAba,
          data_feedback: dataFeedback,
          semana: row[8] ? parseInt(String(row[8])) || null : null,
          dia_semana: String(row[7] || '').trim() || null,
          feedback: feedback.substring(0, 2000), // Limitar tamanho
          tom: String(row[1] || '').trim() || 'Neutro',
          categoria: String(row[2] || '').trim() || null,
          fonte: String(row[3] || '').trim() || null,
          criticidade: String(row[4] || '').trim() || null,
          responsavel: String(row[5] || '').trim() || null,
          status: String(row[6] || '').trim() || null
        }

        registros.push(registro)
      }

      console.log(`✅ ${registros.length} registros processados para ${abaNome}`)

      if (registros.length === 0) {
        resultados.push({
          bar_id: barIdAba,
          bar_nome: abaNome,
          processados: 0,
          inseridos: 0
        })
        continue
      }

      // Inserir no Supabase em lotes
      const BATCH_SIZE = 500
      let totalInserted = 0
      
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        console.log(`📦 Inserindo lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(registros.length / BATCH_SIZE)} (${batch.length} registros)...`)
        
        const { data: insertedData, error: insertError } = await supabase
          .from('voz_cliente')
          .upsert(batch, {
            onConflict: 'bar_id,data_feedback,feedback',
            ignoreDuplicates: false
          })
          .select('id')

        if (insertError) {
          console.error(`❌ Erro ao inserir lote:`, insertError)
          throw insertError
        }

        totalInserted += insertedData?.length || 0
      }

      console.log(`✅ Total: ${totalInserted} registros inseridos/atualizados para ${abaNome}`)
      
      resultados.push({
        bar_id: barIdAba,
        bar_nome: abaNome,
        processados: registros.length,
        inseridos: totalInserted
      })
    }

    const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
    const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Voz do Cliente sincronizada: ${resultados.length} bar(es), ${totalProcessados} processados, ${totalInseridos} inseridos`,
        resultados,
        totais: {
          processados: totalProcessados,
          inseridos: totalInseridos
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na função:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
