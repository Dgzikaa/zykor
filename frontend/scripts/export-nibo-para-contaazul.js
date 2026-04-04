/**
 * Script para exportar lançamentos do NIBO para Excel
 * Gera 2 arquivos CSV (formato Excel) com lançamentos criados após data específica
 * 
 * Uso: node scripts/export-nibo-para-contaazul.js
 * 
 * Gera:
 * - nibo_ordinario_2026-03-25.csv (lançamentos após 25/03/2026 12:00 BRT)
 * - nibo_deboche_2026-03-26.csv (lançamentos após 26/03/2026 10:30 BRT)
 */

const fs = require('fs')
const path = require('path')

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1'

// Configuração dos bares
const BARS_CONFIG = [
  {
    id: 3,
    nome: 'Ordinário',
    createdAfter: new Date('2026-03-25T15:00:00Z'), // 12:00 BRT = 15:00 UTC
    filename: 'nibo_ordinario_2026-03-25.csv'
  },
  {
    id: 4,
    nome: 'Deboche',
    createdAfter: new Date('2026-03-26T13:30:00Z'), // 10:30 BRT = 13:30 UTC
    filename: 'nibo_deboche_2026-03-26.csv'
  }
]

function formatDate(date) {
  if (!date) return ''
  return date.split('T')[0]
}

function formatCurrency(value) {
  return value.toFixed(2).replace('.', ',')
}

async function fetchAllNiboSchedules(apiToken, createdAfter) {
  const allSchedules = []
  const top = 500
  const maxPages = 50

  // Buscar schedules/debit (despesas) e schedules/credit (receitas)
  const endpoints = ['schedules/debit', 'schedules/credit']

  for (const endpoint of endpoints) {
    console.log(`  Buscando ${endpoint}...`)
    let skip = 0
    let pageCount = 0

    while (pageCount < maxPages) {
      const url = `${NIBO_BASE_URL}/${endpoint}?apitoken=${apiToken}&$orderby=createDate desc&$skip=${skip}&$top=${top}`

      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'ApiToken': apiToken
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`  ❌ Erro ${response.status}:`, errorText)
        break
      }

      const data = await response.json()
      const items = data.items || data.value || []

      if (items.length === 0) {
        break
      }

      allSchedules.push(...items)
      console.log(`  ✓ Página ${pageCount + 1}: ${items.length} registros (total: ${allSchedules.length})`)

      if (items.length < top) {
        break
      }

      skip += top
      pageCount++
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Filtrar por createDate
  const createdAfterStr = createdAfter.toISOString()
  const filtered = allSchedules.filter(schedule => {
    if (!schedule.createDate) return false
    return schedule.createDate >= createdAfterStr
  })

  console.log(`  ✓ Total: ${allSchedules.length} schedules, Filtrados: ${filtered.length}`)

  return filtered
}

function convertToExcelRows(schedules) {
  return schedules.map(schedule => {
    const centroCusto = schedule.costCenters?.[0]
    
    return {
      dataCompetencia: formatDate(schedule.accrualDate || schedule.dueDate),
      dataVencimento: formatDate(schedule.dueDate),
      dataPagamento: formatDate(schedule.paymentDate || null),
      descricao: schedule.description || '',
      fornecedor: schedule.stakeholder?.name || '',
      categoria: schedule.category?.name || '',
      centroCusto: centroCusto?.costCenterName || '',
      valor: formatCurrency(Math.abs(schedule.value || 0))
    }
  })
}

function generateCSV(rows) {
  const headers = [
    'Data Competência',
    'Data Vencimento',
    'Data Pagamento',
    'Descrição',
    'Fornecedor',
    'Categoria',
    'Centro de Custo',
    'Valor'
  ]

  const csvLines = [headers.join(';')]

  for (const row of rows) {
    const line = [
      row.dataCompetencia,
      row.dataVencimento,
      row.dataPagamento,
      `"${row.descricao.replace(/"/g, '""')}"`,
      row.fornecedor,
      row.categoria,
      row.centroCusto,
      row.valor
    ]
    csvLines.push(line.join(';'))
  }

  return csvLines.join('\n')
}

async function exportBarToExcel(barConfig, apiToken) {
  console.log(`\n📊 Processando ${barConfig.nome}...`)
  console.log(`   Buscando lançamentos criados após: ${barConfig.createdAfter.toISOString()}`)

  // Buscar schedules do NIBO
  const schedules = await fetchAllNiboSchedules(apiToken, barConfig.createdAfter)

  if (schedules.length === 0) {
    console.log(`   ⚠️  Nenhum lançamento encontrado`)
    return
  }

  // Converter para formato Excel
  const excelRows = convertToExcelRows(schedules)

  // Gerar CSV
  const csvContent = generateCSV(excelRows)

  // Adicionar BOM UTF-8 para Excel reconhecer acentos
  const bom = '\uFEFF'
  const csvWithBom = bom + csvContent

  // Salvar arquivo
  const outputPath = path.join(__dirname, '..', barConfig.filename)
  fs.writeFileSync(outputPath, csvWithBom, 'utf8')

  console.log(`   ✅ Arquivo gerado: ${barConfig.filename}`)
  console.log(`   📝 Total de lançamentos: ${schedules.length}`)
}

async function main() {
  console.log('🚀 Exportando lançamentos NIBO para Conta Azul\n')

  // Buscar credenciais do .env
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas no .env.local')
    process.exit(1)
  }

  // Buscar credenciais NIBO do banco
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  for (const barConfig of BARS_CONFIG) {
    try {
      // Buscar credencial NIBO do bar
      const { data: credencial, error } = await supabase
        .from('api_credentials')
        .select('api_token')
        .eq('bar_id', barConfig.id)
        .eq('sistema', 'nibo')
        .eq('ativo', true)
        .single()

      if (error || !credencial?.api_token) {
        console.error(`❌ Credenciais NIBO não encontradas para ${barConfig.nome} (bar_id=${barConfig.id})`)
        continue
      }

      await exportBarToExcel(barConfig, credencial.api_token)

    } catch (error) {
      console.error(`❌ Erro ao processar ${barConfig.nome}:`, error.message)
    }
  }

  console.log('\n✅ Exportação concluída!')
  console.log('\n📁 Arquivos gerados na raiz do projeto:')
  BARS_CONFIG.forEach(bar => {
    console.log(`   - ${bar.filename}`)
  })
}

main().catch(error => {
  console.error('❌ Erro fatal:', error)
  process.exit(1)
})
