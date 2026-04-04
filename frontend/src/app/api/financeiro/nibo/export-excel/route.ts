import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface NiboScheduleItem {
  scheduleId?: string
  type: string
  value: number
  paidValue?: number
  dueDate: string
  paymentDate?: string
  accrualDate?: string
  description?: string
  createDate?: string
  category?: {
    id: string
    name: string
  }
  costCenters?: Array<{
    costCenterId: string
    costCenterName: string
    value: number
  }>
}

interface ExcelRow {
  dataCompetencia: string
  dataVencimento: string
  dataPagamento: string
  descricao: string
  categoria: string
  centroCusto: string
  valor: string
}

function formatDate(date: string | null): string {
  if (!date) return ''
  return date.split('T')[0]
}

function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

async function fetchAllNiboSchedules(
  apiToken: string,
  createdAfter: Date
): Promise<NiboScheduleItem[]> {
  const allSchedules: NiboScheduleItem[] = []
  const top = 500
  const maxPages = 50

  // Buscar schedules/debit (despesas) e schedules/credit (receitas)
  const endpoints = ['schedules/debit', 'schedules/credit']

  for (const endpoint of endpoints) {
    console.log(`[nibo-export] Buscando ${endpoint}...`)
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
        console.error(`[nibo-export] Erro ${response.status}:`, errorText)
        break
      }

      const data = await response.json()
      const items = data.items || data.value || []

      if (items.length === 0) {
        break
      }

      allSchedules.push(...items)
      console.log(`[nibo-export] ${endpoint} - página ${pageCount + 1}: ${items.length} registros (total: ${allSchedules.length})`)

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

  console.log(`[nibo-export] Total schedules: ${allSchedules.length}, Filtrados após ${createdAfterStr}: ${filtered.length}`)

  return filtered
}

function convertToExcelRows(schedules: NiboScheduleItem[]): ExcelRow[] {
  return schedules.map(schedule => {
    const centroCusto = schedule.costCenters?.[0]
    
    return {
      dataCompetencia: formatDate(schedule.accrualDate || schedule.dueDate),
      dataVencimento: formatDate(schedule.dueDate),
      dataPagamento: formatDate(schedule.paymentDate || null),
      descricao: schedule.description || '',
      categoria: schedule.category?.name || '',
      centroCusto: centroCusto?.costCenterName || '',
      valor: formatCurrency(Math.abs(schedule.value || 0))
    }
  })
}

function generateCSV(rows: ExcelRow[]): string {
  const headers = [
    'Data Competência',
    'Data Vencimento',
    'Data Pagamento',
    'Descrição',
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
      row.categoria,
      row.centroCusto,
      row.valor
    ]
    csvLines.push(line.join(';'))
  }

  return csvLines.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 })
    }

    const barId = body.bar_id

    // Buscar credenciais do NIBO
    const { data: credencial, error: credError } = await supabase
      .from('api_credentials')
      .select('api_token, bar_id')
      .eq('bar_id', barId)
      .eq('sistema', 'nibo')
      .eq('ativo', true)
      .single()

    if (credError || !credencial?.api_token) {
      return NextResponse.json(
        { error: `Credenciais NIBO não encontradas para bar_id=${barId}` },
        { status: 404 }
      )
    }

    // Buscar nome do bar
    const { data: bars } = await supabase
      .from('bars')
      .select('nome')
      .eq('id', barId)
      .single()

    const barNome = bars?.nome || (barId === 3 ? 'Ordinário' : 'Deboche')

    // Definir data/hora de corte baseado no bar
    let createdAfter: Date

    if (body.created_after) {
      // Se fornecido, usar o valor customizado
      createdAfter = new Date(body.created_after)
    } else {
      // Padrão por bar
      if (barId === 3) {
        // Ordinário: 25/03/2026 12:00 BRT (UTC-3)
        createdAfter = new Date('2026-03-25T15:00:00Z') // 12:00 BRT = 15:00 UTC
      } else if (barId === 4) {
        // Deboche: 26/03/2026 10:30 BRT (UTC-3)
        createdAfter = new Date('2026-03-26T13:30:00Z') // 10:30 BRT = 13:30 UTC
      } else {
        return NextResponse.json(
          { error: 'bar_id deve ser 3 (Ordinário) ou 4 (Deboche)' },
          { status: 400 }
        )
      }
    }

    console.log(`[nibo-export] Bar: ${barNome} (ID: ${barId})`)
    console.log(`[nibo-export] Buscando lançamentos criados após: ${createdAfter.toISOString()}`)

    // Buscar schedules do NIBO
    const schedules = await fetchAllNiboSchedules(credencial.api_token, createdAfter)

    if (schedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum lançamento encontrado no período',
        bar_id: barId,
        bar_nome: barNome,
        created_after: createdAfter.toISOString(),
        total: 0
      })
    }

    // Converter para formato Excel
    const excelRows = convertToExcelRows(schedules)

    // Gerar CSV (Excel pode abrir CSV com ponto-e-vírgula)
    const csvContent = generateCSV(excelRows)

    // Adicionar BOM UTF-8 para Excel reconhecer acentos corretamente
    const bom = '\uFEFF'
    const csvWithBom = bom + csvContent

    // Retornar CSV como download
    const filename = `nibo_${barNome.toLowerCase().replace(/\s+/g, '_')}_${formatDate(createdAfter.toISOString())}.csv`

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('[nibo-export] Erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
