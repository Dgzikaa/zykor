import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { read, utils } from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credenciais da Service Account - carregadas de variável de ambiente
function getCredentials() {
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
    throw new Error('Erro ao parsear GOOGLE_SERVICE_ACCOUNT_KEY: ' + e.message)
  }
}

const FILE_ID = '1sYIKzphim9bku0jl_J6gSDEqrIhYMxAn'
const SHEET_NAME = 'Pesquisa da Felicidade'

interface PesquisaFelicidadeRow {
  bar_id: number
  data_pesquisa: string
  setor: string
  quorum: number
  eu_comigo_engajamento: number
  eu_com_empresa_pertencimento: number
  eu_com_colega_relacionamento: number
  eu_com_gestor_lideranca: number
  justica_reconhecimento: number
  media_geral: number
  resultado_percentual: number
  funcionario_nome: string
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
    scope: 'https://www.googleapis.com/auth/drive.readonly',
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

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parâmetros - bar_id é opcional (se não passar, processa todos)
    const body = await req.json().catch(() => ({}))
    const { bar_id } = body

    // Inicializar Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar bares para processar
    const { data: todosOsBares } = await supabaseClient
      .from('bars')
      .select('id, nome')
      .eq('ativo', true)
    
    if (!todosOsBares?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum bar ativo encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const baresParaProcessar = bar_id 
      ? todosOsBares.filter(b => b.id === bar_id)
      : todosOsBares

    console.log(`🔄 Iniciando sincronização da Pesquisa da Felicidade para ${baresParaProcessar.length} bar(es)...`)

    // 1. Obter Access Token
    console.log('🔑 Obtendo Access Token...')
    const accessToken = await getAccessToken()
    console.log('✅ Token obtido!')

    const resultadosPorBar: any[] = []

    // ====== LOOP POR CADA BAR ======
    for (const bar of baresParaProcessar) {
      console.log(`\n🏪 Processando Pesquisa da Felicidade para: ${bar.nome} (ID: ${bar.id})`)
      
      try {
        // Buscar configuração do arquivo para este bar
        const { data: config } = await supabaseClient
          .from('api_credentials')
          .select('configuracoes')
          .eq('sistema', 'google_sheets')
          .eq('bar_id', bar.id)
          .eq('ativo', true)
          .single()
        
        const fileId = config?.configuracoes?.pesquisa_felicidade_file_id || FILE_ID
        const sheetName = config?.configuracoes?.pesquisa_felicidade_sheet_name || SHEET_NAME
        console.log(`📋 Usando arquivo: ${fileId}`)

        // 2. Baixar arquivo Excel do Google Drive
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
        
        const fileResponse = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })

        if (!fileResponse.ok) {
          throw new Error(`Erro ao baixar arquivo: ${fileResponse.status} ${fileResponse.statusText}`)
        }

        const arrayBuffer = await fileResponse.arrayBuffer()
        console.log(`✅ Arquivo baixado! (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`)

        // 3. Processar Excel com SheetJS
        const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })

        // Encontrar aba
        let targetSheet = workbook.Sheets[sheetName]
        if (!targetSheet) {
          console.warn(`⚠️ Aba "${sheetName}" não encontrada, usando primeira aba`)
          targetSheet = workbook.Sheets[workbook.SheetNames[0]]
        }

        // Converter para JSON
        const jsonData = utils.sheet_to_json(targetSheet, { 
          header: 1,
          defval: '',
          raw: false
        }) as any[][]

        console.log(`📊 ${jsonData.length} linhas encontradas`)

        // 4. Processar dados (pular cabeçalho - linhas 0-2)
        const registros: PesquisaFelicidadeRow[] = []
        
        // Converter percentuais para escala de 1-5
        const parsePercentualToScale = (val: any): number => {
          if (!val) return 0
          const str = String(val).replace('%', '').replace(',', '.')
          const percentual = parseFloat(str)
          const escala = Math.ceil((percentual / 100) * 5)
          return Math.max(1, Math.min(5, escala))
        }
        
        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i]
          
          if (!row[0] || String(row[0]).trim() === '') continue

          try {
            // Processar data
            let dataFormatada = ''
            if (row[0]) {
              if (typeof row[0] === 'number') {
                const date = new Date((row[0] - 25569) * 86400 * 1000)
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                dataFormatada = `${year}-${month}-${day}`
              } else {
                const parts = String(row[0]).split('/')
                if (parts.length === 3) {
                  dataFormatada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                }
              }
            }

            if (!dataFormatada) continue

            const engajamento = parsePercentualToScale(row[3])
            const pertencimento = parsePercentualToScale(row[4])
            const relacionamento = parsePercentualToScale(row[5])
            const lideranca = parsePercentualToScale(row[6])
            const reconhecimento = parsePercentualToScale(row[7])
            
            const mediaGeral = (engajamento + pertencimento + relacionamento + lideranca + reconhecimento) / 5
            const resultadoPercentual = (mediaGeral / 5) * 100

            const registro: PesquisaFelicidadeRow = {
              bar_id: bar.id,
              data_pesquisa: dataFormatada,
              setor: row[1] || 'TODOS',
              quorum: parseInt(row[2]) || 0,
              eu_comigo_engajamento: engajamento,
              eu_com_empresa_pertencimento: pertencimento,
              eu_com_colega_relacionamento: relacionamento,
              eu_com_gestor_lideranca: lideranca,
              justica_reconhecimento: reconhecimento,
              media_geral: parseFloat(mediaGeral.toFixed(2)),
              resultado_percentual: parseFloat(resultadoPercentual.toFixed(2)),
              funcionario_nome: 'Equipe',
            }

            registros.push(registro)
          } catch (error) {
            console.error(`⚠️ Erro ao processar linha ${i + 1}:`, error)
          }
        }

        console.log(`✅ ${registros.length} registros processados`)

        if (registros.length === 0) {
          resultadosPorBar.push({
            bar_id: bar.id,
            bar_nome: bar.nome,
            success: true,
            processados: 0,
            inseridos: 0,
            message: 'Nenhum registro para importar'
          })
          continue
        }

        // 5. Inserir no Supabase
        const { data: insertedData, error: insertError } = await supabaseClient
          .from('pesquisa_felicidade')
          .upsert(registros, {
            onConflict: 'bar_id,data_pesquisa,funcionario_nome,setor',
            ignoreDuplicates: false
          })
          .select()

        if (insertError) {
          throw insertError
        }

        console.log(`✅ ${bar.nome}: ${insertedData?.length || 0} registros inseridos/atualizados`)
        
        resultadosPorBar.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          success: true,
          processados: registros.length,
          inseridos: insertedData?.length || 0
        })
      } catch (barError) {
        console.error(`❌ Erro ao processar ${bar.nome}:`, barError)
        resultadosPorBar.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          success: false,
          error: barError.message
        })
      }
    }
    // ====== FIM DO LOOP DE BARES ======

    const totalProcessados = resultadosPorBar.reduce((acc, r) => acc + (r.processados || 0), 0)
    const totalInseridos = resultadosPorBar.reduce((acc, r) => acc + (r.inseridos || 0), 0)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Pesquisa Felicidade: ${baresParaProcessar.length} bar(es), ${totalProcessados} processados, ${totalInseridos} inseridos`,
        bares_processados: baresParaProcessar.length,
        resultados_por_bar: resultadosPorBar,
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
