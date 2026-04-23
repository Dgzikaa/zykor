import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../frontend/.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function refreshToken(credentials) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refresh_token,
    client_id: credentials.client_id,
    client_secret: credentials.client_secret
  })

  const response = await fetch('https://auth.contaazul.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error('Falha ao renovar token')
  }

  const data = await response.json()
  
  // Atualizar no banco
  await supabase
    .from('api_credentials')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      atualizado_em: new Date().toISOString()
    })
    .eq('id', credentials.id)

  return data.access_token
}

async function encontrarFaltantes() {
  console.log('🔍 Buscando lançamentos faltantes do Deboche (Receitas)\n')

  // Buscar credenciais
  const { data: creds } = await supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', 4)
    .eq('sistema', 'conta_azul')
    .single()

  if (!creds) {
    console.error('❌ Credenciais não encontradas')
    return
  }

  // Verificar se token expirou
  let accessToken = creds.access_token
  if (creds.expires_at) {
    const expiresAt = new Date(creds.expires_at)
    if (expiresAt <= new Date()) {
      console.log('🔄 Token expirado, renovando...')
      accessToken = await refreshToken(creds)
      console.log('✅ Token renovado\n')
    }
  }

  console.log('📡 Buscando TODOS os IDs da API...')
  const idsAPI = new Set()
  let pagina = 1
  const tamanhoPagina = 1000
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      pagina: pagina.toString(),
      tamanho_pagina: tamanhoPagina.toString(),
      data_vencimento_de: '2020-01-01',
      data_vencimento_ate: '2030-12-31'
    })

    const url = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?${params}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`   ❌ Erro na requisição: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error(`   Resposta: ${text}`)
      break
    }

    const data = await response.json()
    
    console.log(`   Página ${pagina}: status=${response.status}, itens=${data.itens?.length || 0}, total_api=${data.itens_totais || 0}`)
    
    if (data.itens && data.itens.length > 0) {
      for (const item of data.itens) {
        idsAPI.add(item.id)
      }
      
      console.log(`   Página ${pagina}: ${data.itens.length} itens (total acumulado: ${idsAPI.size})`)
      
      if (data.itens.length < tamanhoPagina) {
        hasMore = false
      } else {
        pagina++
      }
    } else {
      hasMore = false
    }
  }

  console.log(`\n✅ Total de IDs na API: ${idsAPI.size}`)

  // Buscar IDs do banco (paginando)
  console.log('\n📦 Buscando IDs do banco...')
  const idsBanco = new Set()
  let offset = 0
  const limit = 1000
  let hasMoreDB = true

  while (hasMoreDB) {
    const { data: dbData } = await supabase
      .from('contaazul_lancamentos')
      .select('contaazul_id')
      .eq('bar_id', 4)
      .eq('tipo', 'RECEITA')
      .range(offset, offset + limit - 1)

    if (dbData && dbData.length > 0) {
      for (const item of dbData) {
        idsBanco.add(item.contaazul_id)
      }
      console.log(`   Offset ${offset}: ${dbData.length} itens (total acumulado: ${idsBanco.size})`)
      
      if (dbData.length < limit) {
        hasMoreDB = false
      } else {
        offset += limit
      }
    } else {
      hasMoreDB = false
    }
  }

  console.log(`✅ Total de IDs no banco: ${idsBanco.size}`)

  // Encontrar IDs faltantes
  const idsFaltantes = [...idsAPI].filter(id => !idsBanco.has(id))
  
  console.log(`\n❌ Total de IDs faltantes: ${idsFaltantes.length}`)

  if (idsFaltantes.length > 0) {
    console.log('\n📋 IDs faltantes:')
    console.log(idsFaltantes.slice(0, 10).join('\n'))
    if (idsFaltantes.length > 10) {
      console.log(`... e mais ${idsFaltantes.length - 10} IDs`)
    }

    // Buscar detalhes dos primeiros 5 faltantes
    console.log('\n🔍 Detalhes dos primeiros 5 lançamentos faltantes:')
    for (let i = 0; i < Math.min(5, idsFaltantes.length); i++) {
      const id = idsFaltantes[i]
      
      const url = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/parcelas/${id}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`\n${i + 1}. ID: ${id}`)
        console.log(`   Descrição: ${data.descricao || 'N/A'}`)
        console.log(`   Valor: R$ ${data.valor_composicao?.valor_bruto || data.valor_composicao?.valor_liquido || 'N/A'}`)
        console.log(`   Status: ${data.status_traduzido || data.status}`)
        console.log(`   Data Vencimento: ${data.data_vencimento}`)
        console.log(`   Data Competência: ${data.evento?.data_competencia || 'N/A'}`)
        console.log(`   Tipo Evento: ${data.evento?.tipo || 'N/A'}`)
      } else {
        console.log(`\n${i + 1}. ID: ${id} - Erro ao buscar detalhes (${response.status})`)
      }
    }
  } else {
    console.log('\n✅ Nenhum lançamento faltante! Tudo sincronizado.')
  }
}

encontrarFaltantes().catch(console.error)
