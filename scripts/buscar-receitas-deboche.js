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

async function buscarReceitas() {
  console.log('🔍 Buscando Contas a RECEBER do Deboche\n')

  // Buscar credenciais do Deboche
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

  // Buscar com período amplo
  const params = new URLSearchParams({
    pagina: '1',
    tamanho_pagina: '10',
    data_vencimento_de: '2020-01-01',
    data_vencimento_ate: '2030-12-31'
  })

  const url = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?${params}`

  console.log('📡 Buscando primeiro lote...')
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${creds.access_token}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()

  console.log('\n📊 TOTAIS DA API (campo "totais"):')
  console.log('   Pago:', data.totais?.pago?.valor ? `R$ ${data.totais.pago.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'N/A')
  console.log('   Vencido:', data.totais?.vencido?.valor ? `R$ ${data.totais.vencido.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'N/A')
  console.log('   Aberto:', data.totais?.aberto?.valor ? `R$ ${data.totais.aberto.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'N/A')
  console.log('   TODOS:', data.totais?.todos ? `R$ ${data.totais.todos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'N/A')

  console.log('\n📋 Total de itens na API:', data.itens_totais)

  // Buscar TODOS os itens para somar
  console.log('\n🔄 Buscando TODOS os lançamentos...')
  let totalValor = 0
  let totalItens = 0
  let pagina = 1
  const tamanhoPagina = 1000
  let hasMore = true

  while (hasMore) {
    const params2 = new URLSearchParams({
      pagina: pagina.toString(),
      tamanho_pagina: tamanhoPagina.toString(),
      data_vencimento_de: '2020-01-01',
      data_vencimento_ate: '2030-12-31'
    })

    const url2 = `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?${params2}`
    
    const response2 = await fetch(url2, {
      headers: {
        'Authorization': `Bearer ${creds.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    const data2 = await response2.json()
    
    if (data2.itens && data2.itens.length > 0) {
      for (const item of data2.itens) {
        totalValor += Number(item.total)
      }
      
      totalItens += data2.itens.length
      
      console.log(`   Página ${pagina}: ${data2.itens.length} itens`)
      
      if (data2.itens.length < tamanhoPagina) {
        hasMore = false
      } else {
        pagina++
      }
    } else {
      hasMore = false
    }
  }

  console.log('\n📊 RESUMO FINAL:')
  console.log('   Total de lançamentos:', totalItens)
  console.log('   Valor total (soma):', `R$ ${totalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  
  console.log('\n🔍 Comparação:')
  console.log('   API totais.todos:', data.totais?.todos ? `R$ ${data.totais.todos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'N/A')
  console.log('   Soma dos itens:', `R$ ${totalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  console.log('   Diferença:', data.totais?.todos ? `R$ ${(data.totais.todos - totalValor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'N/A')
  
  console.log('\n📦 No banco Supabase temos:')
  const { data: dbData } = await supabase
    .from('contaazul_lancamentos')
    .select('valor_bruto')
    .eq('bar_id', 4)
    .eq('tipo', 'RECEITA')
  
  const dbTotal = dbData?.reduce((sum, item) => sum + parseFloat(item.valor_bruto), 0) || 0
  console.log('   Total no banco:', dbData?.length || 0, 'lançamentos')
  console.log('   Valor no banco:', `R$ ${dbTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  console.log('   Diferença API vs Banco:', `${totalItens - (dbData?.length || 0)} lançamentos, R$ ${(totalValor - dbTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
}

buscarReceitas().catch(console.error)
