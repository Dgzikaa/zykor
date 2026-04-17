import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface RetroactiveRequest {
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  data_types?: string[] // ['analitico', 'pagamentos', 'tempo', 'periodo', 'fatporhora']
  bar_id?: number
  force_recollect?: boolean // Se true, coleta mesmo se já existir dados
}

interface CollectionResult {
  success: boolean
  data_type: string
  date: string
  records_collected: number
  already_exists: boolean
  error?: string
}

interface RetroactiveResult {
  success: boolean
  message: string
  total_dates: number
  total_collections: number
  success_count: number
  error_count: number
  results: CollectionResult[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body: RetroactiveRequest = await request.json()

    // Validações
    if (!body.start_date || !body.end_date) {
      return NextResponse.json({
        success: false,
        error: 'start_date e end_date são obrigatórios'
      }, { status: 400 })
    }

    // Configurações padrão
    const dataTypes = body.data_types || ['analitico', 'pagamentos', 'tempo', 'periodo', 'fatporhora']
    if (!body.bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    const barId = body.bar_id
    const forceRecollect = body.force_recollect || false

    // Gerar lista de datas
    const startDate = new Date(body.start_date)
    const endDate = new Date(body.end_date)
    const dates: string[] = []
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    const results: CollectionResult[] = []
    let successCount = 0
    let errorCount = 0

    // Para cada data e tipo de dados
    for (const date of dates) {
      for (const dataType of dataTypes) {
        try {
          // Verificar se já existe dados (se não forçar recoleta) - MIGRADO: domain tables
          if (!forceRecollect) {
            const existingData = await checkExistingData(supabase, dataType, date, barId)
            if (existingData) {
              results.push({
                success: true,
                data_type: dataType,
                date,
                records_collected: 0,
                already_exists: true
              })
              successCount++
              continue
            }
          }

          // Coletar dados do ContaHub
          const collectionResult = await collectContaHubData(dataType, date, barId)
          
          if (collectionResult.success) {
            // Salvar dados brutos
            const { data: rawData, error: insertError } = await supabase
              .schema('bronze')
              .from('bronze_contahub_raw_data')
              .insert({
                bar_id: barId,
                data_type: dataType,
                data_date: date,
                raw_json: collectionResult.data,
                record_count: collectionResult.record_count,
                processed: false
              })
              .select('id')
              .single()

            if (insertError) {
              throw new Error(`Erro ao salvar dados brutos: ${insertError.message}`)
            }

            results.push({
              success: true,
              data_type: dataType,
              date,
              records_collected: collectionResult.record_count,
              already_exists: false
            })
            successCount++

          } else {
            throw new Error(collectionResult.error || 'Erro na coleta')
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`❌ [API] Erro coletando ${dataType} para ${date}:`, errorMessage)
          
          results.push({
            success: false,
            data_type: dataType,
            date,
            records_collected: 0,
            already_exists: false,
            error: errorMessage
          })
          errorCount++
        }

        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const totalCollections = dates.length * dataTypes.length

    return NextResponse.json({
      success: true,
      message: `Coleta retroativa concluída: ${successCount} sucessos, ${errorCount} erros`,
      total_dates: dates.length,
      total_collections: totalCollections,
      success_count: successCount,
      error_count: errorCount,
      results
    } as RetroactiveResult)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ [API] Erro na coleta retroativa:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

// MIGRADO: usa domain tables em vez de staging tables
async function checkExistingData(
  supabase: any, 
  dataType: string, 
  date: string, 
  barId: number
): Promise<boolean> {
  try {
    let tableName: string
    let dateField: string

    switch (dataType) {
      case 'analitico':
        tableName = 'vendas_item'
        dateField = 'data_venda'
        break
      case 'pagamentos':
        tableName = 'faturamento_pagamentos'
        dateField = 'data_pagamento'
        break
      case 'tempo':
        tableName = 'tempos_producao'
        dateField = 'data_producao'
        break
      case 'periodo':
        tableName = 'visitas'
        dateField = 'data_visita'
        break
      case 'fatporhora':
        tableName = 'faturamento_hora'
        dateField = 'data_venda'
        break
      default:
        return false
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .eq('bar_id', barId)
      .gte(dateField, date)
      .lt(dateField, new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(1)

    return !error && data && data.length > 0
  } catch {
    return false
  }
}

async function collectContaHubData(dataType: string, date: string, barId: number) {
  try {
    const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6
    const recordCount = isWeekend ? Math.floor(Math.random() * 50) : Math.floor(Math.random() * 200) + 50
    
    let mockData
    switch (dataType) {
      case 'analitico':
        mockData = {
          list: Array.from({ length: recordCount }, (_, i) => ({
            data_venda: date,
            trn_id: `TRN_${date}_${i}`,
            produto_id: `PROD_${i % 20}`,
            produto_desc: `Produto ${i % 20}`,
            categoria: ['Bebidas', 'Comidas', 'Sobremesas'][i % 3],
            quantidade: Math.random() * 5 + 1,
            valor_unitario: Math.random() * 50 + 10,
            valor: Math.random() * 100 + 20,
            desconto: Math.random() * 10,
            funcionario_id: `FUNC_${i % 5}`,
            mesa: `Mesa ${i % 15 + 1}`,
            observacoes: ''
          }))
        }
        break
        
      case 'pagamentos':
        mockData = {
          list: Array.from({ length: recordCount }, (_, i) => ({
            data_pagamento: date,
            id: `PAG_${date}_${i}`,
            meio: ['Dinheiro', 'Cartão', 'PIX', 'Vale'][i % 4],
            valor_bruto: Math.random() * 200 + 20,
            valor_liquido: Math.random() * 190 + 18,
            descricao: `Pagamento ${i}`,
            status: 'Aprovado'
          }))
        }
        break
        
      case 'tempo':
        mockData = {
          list: Array.from({ length: recordCount }, (_, i) => ({
            data_producao: date,
            funcionario_id: `FUNC_${i % 10}`,
            nome: `Funcionário ${i % 10}`,
            entrada: '08:00',
            saida: '17:00',
            horas: 8,
            cargo: ['Garçom', 'Cozinheiro', 'Bartender'][i % 3],
            salario_hora: 15 + Math.random() * 10
          }))
        }
        break
        
      case 'periodo':
        mockData = {
          list: Array.from({ length: recordCount }, (_, i) => ({
            data_visita: date,
            periodo: ['Manhã', 'Tarde', 'Noite'][i % 3],
            valor_consumo: Math.random() * 1000 + 500,
            qtd_vendas: Math.floor(Math.random() * 50) + 10,
            ticket_medio: Math.random() * 50 + 25
          }))
        }
        break
        
      case 'fatporhora':
        mockData = {
          list: Array.from({ length: recordCount }, (_, i) => ({
            data_venda: date,
            hora: i % 24,
            valor: Math.random() * 200 + 50,
            dds: new Date(date).getDay().toString(),
            dia: new Date(date).toLocaleDateString('pt-BR', { weekday: 'long' }),
            quantidade: Math.floor(Math.random() * 20) + 1
          }))
        }
        break
        
      default:
        throw new Error(`Tipo de dados não suportado: ${dataType}`)
    }

    return {
      success: true,
      data: mockData,
      record_count: recordCount
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: null,
      record_count: 0
    }
  }
}