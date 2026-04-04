import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../frontend/.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'definida' : 'não definida')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testarAPI() {
  console.log('🔍 Testando API Conta Azul - Contas a Pagar\n')

  // Buscar credenciais do Ordinário
  const { data: creds } = await supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', 3)
    .eq('sistema', 'conta_azul')
    .single()

  if (!creds) {
    console.error('❌ Credenciais não encontradas')
    return
  }

  console.log('✅ Credenciais encontradas\n')

  // Fazer requisição direta à API
  const params = new URLSearchParams({
    pagina: '1',
    tamanho_pagina: '10',
    data_vencimento_de: '2025-01-01',
    data_vencimento_ate: '2025-12-31'
  })

  const url = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?${params}`

  console.log('📡 Chamando API:', url)
  console.log('🔑 Token:', creds.access_token.substring(0, 20) + '...\n')

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${creds.access_token}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()

  console.log('📊 Resposta da API:')
  console.log('   Status:', response.status)
  console.log('   Total de itens:', data.itens_totais)
  console.log('   Itens retornados:', data.itens?.length || 0)
  console.log('\n📋 Primeiro item:')
  if (data.itens?.[0]) {
    const item = data.itens[0]
    console.log('   ID:', item.id)
    console.log('   Descrição:', item.descricao)
    console.log('   Total (raw):', item.total)
    console.log('   Total (dividido por 100):', item.total / 100)
    console.log('   Status:', item.status_traduzido)
    console.log('   Data vencimento:', item.data_vencimento)
    console.log('   Data competência:', item.data_competencia)
  }

  console.log('\n📊 Totais da API:')
  console.log('   Totais:', JSON.stringify(data.totais, null, 2))

  // Agora buscar TODOS os itens (paginando) - USANDO DATA_COMPETENCIA
  console.log('\n\n🔄 Buscando TODOS os lançamentos de 2025 (por DATA_COMPETENCIA)...')
  
  let totalValor = 0
  let totalItens = 0
  let pagina = 1
  const tamanhoPagina = 1000
  let hasMore = true

  while (hasMore) {
    const params2 = new URLSearchParams({
      pagina: pagina.toString(),
      tamanho_pagina: tamanhoPagina.toString(),
      data_vencimento_de: '2025-01-01',
      data_vencimento_ate: '2025-12-31',
      data_competencia_de: '2025-01-01',
      data_competencia_ate: '2025-12-31'
    })

    const url2 = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?${params2}`
    
    const response2 = await fetch(url2, {
      headers: {
        'Authorization': `Bearer ${creds.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    const data2 = await response2.json()
    
    if (data2.itens && data2.itens.length > 0) {
      // TESTE: NÃO dividir por 100
      const valorPaginaSemDividir = data2.itens.reduce((sum, item) => sum + parseFloat(item.total), 0)
      const valorPaginaDividido = data2.itens.reduce((sum, item) => sum + (parseFloat(item.total) / 100), 0)
      
      totalValor += valorPaginaSemDividir
      totalItens += data2.itens.length
      
      console.log(`   Página ${pagina}: ${data2.itens.length} itens, SEM dividir: R$ ${valorPaginaSemDividir.toFixed(2)}, COM dividir: R$ ${valorPaginaDividido.toFixed(2)}`)
      
      if (data2.itens.length < tamanhoPagina) {
        hasMore = false
      } else {
        pagina++
      }
    } else {
      hasMore = false
    }
  }

  console.log('\n📊 TOTAL GERAL (2025):')
  console.log('   Total de lançamentos:', totalItens)
  console.log('   Valor total:', `R$ ${totalValor.toFixed(2)}`)
}

testarAPI().catch(console.error)
