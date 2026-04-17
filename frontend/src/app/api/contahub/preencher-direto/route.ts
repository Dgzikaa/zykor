import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { UTC_OFFSET_STRING_COMPACT, toBRTISOCompact } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await request.json()
    
    const { dates, data_type = 'analitico', bar_id } = body

    if (!bar_id) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório'
      }, { status: 400 })
    }

    if (!dates || !Array.isArray(dates)) {
      return NextResponse.json({
        success: false,
        error: 'Array de datas é obrigatório'
      }, { status: 400 })
    }

    let processedCount = 0
    const results: any[] = []

    for (const date of dates) {
      try {
        // Verificar se já existe (baseado no tipo de dados)
        let tableName = ''
        let dateField = ''
        
        switch (data_type) {
          case 'analitico':
            tableName = 'bronze_contahub_avendas_porproduto_analitico'
            dateField = 'trn_dtgerencial'
            break
          case 'fatporhora':
            tableName = 'bronze_contahub_avendas_vendasdiahoraanalitico'
            dateField = 'vd_dtgerencial'
            break
          case 'pagamentos':
            tableName = 'bronze_contahub_financeiro_pagamentosrecebidos'
            dateField = 'dt_gerencial'
            break
          case 'tempo':
            tableName = 'bronze_contahub_produtos_temposproducao'
            dateField = 'data'
            break
          case 'periodo':
            tableName = 'bronze_contahub_avendas_vendasperiodo'
            dateField = 'dt_gerencial'
            break
          default:
            throw new Error(`Tipo de dados não suportado: ${data_type}`)
        }

        const { data: existing } = await supabase
          .schema('bronze')
          .from(tableName)
          .select('id')
          .eq('bar_id', bar_id)
          .eq(dateField, date)
          .limit(1)

        if (existing && existing.length > 0) {
          results.push({ date, status: 'exists', records: 0 })
          continue
        }

        // Gerar dados baseado no tipo de tabela
        const dayOfWeek = new Date(date).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        
        let recordCount
        switch (data_type) {
          case 'fatporhora':
            recordCount = 10 // FATPORHORA tem poucos registros por dia
            break
          case 'analitico':
            recordCount = isWeekend ? Math.floor(Math.random() * 40) + 15 : Math.floor(Math.random() * 120) + 80
            break
          case 'tempo':
          case 'pagamentos':
          case 'periodo':
            // Aumentando gradualmente para encontrar o volume ideal
            recordCount = isWeekend ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 50) + 100 // 50-150 registros
            break
          default:
            recordCount = 50
        }

        // Gerar dados baseado no tipo
        let mockData
        switch (data_type) {
          case 'analitico':
            mockData = {
              list: Array.from({ length: recordCount }, (_, i) => ({
                trn_dtgerencial: date,
                trn: 1000 + i,
                trn_desc: `Transação ${i + 1}`,
                prd: `PROD_${(i % 50) + 1}`,
                prd_desc: `Produto ${(i % 50) + 1}`,
                grp_desc: ['Bebidas', 'Comidas', 'Sobremesas', 'Petiscos'][i % 4],
                qtd: Math.random() * 3 + 1,
                valorfinal: Math.random() * 80 + 20,
                desconto: Math.random() * 5,
                custo: Math.random() * 30 + 5,
                usr_lancou: `FUNC_${(i % 8) + 1}`,
                vd_mesadesc: `Mesa ${(i % 20) + 1}`,
                itm_obs: i % 10 === 0 ? 'Observação especial' : '',
                ano: 2025,
                mes: parseInt(date.split('-')[1]),
                tipo: 'VENDA',
                tipovenda: 'BALCAO'
              }))
            }
            break

          case 'fatporhora':
            mockData = {
              list: Array.from({ length: recordCount }, (_, i) => ({
                vd_dtgerencial: date,
                hora: i % 24,
                $valor: Math.round((Math.random() * 150 + 30) * 100) / 100, // Arredondar para 2 casas decimais
                dds: new Date(date).getDay().toString(),
                dia: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date(date).getDay()],
                qtd: Math.floor(Math.random() * 15) + 1
              }))
            }
            break

          case 'pagamentos':
            mockData = {
              list: Array.from({ length: recordCount }, (_, i) => ({
                vd: `${50000 + i}`,
                cli: 40000 + (i % 1000),
                pag: (i % 5 + 1).toString(),
                trn: `${100 + (i % 200)}`,
                meio: ['Credito Auto', 'Debito', 'Dinheiro', 'PIX', 'Vale'][i % 5],
                mesa: `${1000 + (i % 50)}`,
                tipo: ['Cred', 'Deb', 'Dinheiro', 'PIX', 'Vale'][i % 5],
                $valor: Math.round((Math.random() * 150 + 10) * 100) / 100,
                cartao: i % 2 === 0 ? '541555****3164' : '4111****1111',
                cliente: ['Miriam Alves', 'João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Lima'][i % 5],
                $liquido: Math.round((Math.random() * 150 + 10) * 100) / 100,
                usr_abriu: ['Amanda', 'Luan', 'Pedro', 'Carlos', 'Ana'][i % 5],
                usr_lancou: ['Amanda', 'Luan', 'Pedro', 'Carlos', 'Ana'][i % 5],
                autorizacao: `${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
                dt_gerencial: date,
                dt_transacao: date,
                hr_transacao: `${date} ${String(8 + (i % 12)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00`,
                hr_lancamento: `${date} ${String(8 + (i % 12)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00`,
                $vr_pagamentos: Math.round((Math.random() * 150 + 10) * 100) / 100
              }))
            }
            break

          case 'tempo':
            mockData = {
              list: Array.from({ length: recordCount }, (_, i) => ({
                // TODOS os campos que vêm da API real do TEMPO (baseado no registro real)
                ano: date.split('-')[0],
                dds: new Date(date).getDay().toString(),
                dia: toBRTISOCompact(date),
                itm: i + 1,
                mes: `${date.split('-')[0]}-${date.split('-')[1]}`,
                prd: (i % 200) + 100,
                hora: `${String(8 + (i % 12)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
                't0-t3': Math.floor(Math.random() * 30) + 5,
                itm_qtd: Math.floor(Math.random() * 5) + 1,
                prefixo: '',
                grp_desc: ['Cervejas', 'Drinks', 'Petiscos', 'Pratos', 'Sobremesas'][i % 5],
                loc_desc: ['Bar', 'Cozinha', 'Salão'][i % 3],
                prd_desc: `Produto ${(i % 200) + 100}`,
                tipovenda: '',
                usr_abriu: ['Pedro Henrique ', 'Amanda', 'Luan', 'Carlos', 'Ana'][i % 5], // Note o espaço após Pedro Henrique
                't3-entrega': `${date}T${String(8 + (i % 12)).padStart(2, '0')}:${String(((i % 4) * 15) + Math.floor(Math.random() * 30) + 5).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}${UTC_OFFSET_STRING_COMPACT}`,
                usr_lancou: ['Pedro Henrique ', 'Amanda', 'Luan', 'Carlos', 'Ana'][i % 5],
                diadasemana: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(date).getDay()],
                vd_mesadesc: `${1000 + (i % 50)}`,
                usr_entregou: ['cerva', 'garcom', 'cozinha'][i % 3],
                't0-lancamento': `${date}T${String(8 + (i % 12)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}${UTC_OFFSET_STRING_COMPACT}`
              }))
            }
            break

          case 'periodo':
            mockData = {
              list: Array.from({ length: recordCount }, (_, i) => ({
                pessoas: Math.floor(Math.random() * 6) + 1,
                cli_fone: `61-${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
                cli_nome: ['Miriam Alves', 'João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Lima'][i % 5],
                tipovenda: '',
                usr_abriu: ['Amanda', 'Luan', 'Pedro', 'Carlos', 'Ana'][i % 5],
                cli_dtnasc: toBRTISOCompact(`${1960 + (i % 40)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`),
                $vr_couvert: Math.round((Math.random() * 30) * 100) / 100,
                $vr_repique: Math.round((Math.random() * 10) * 100) / 100,
                vd_mesadesc: `${1000 + (i % 50)}`,
                $vr_produtos: Math.round((Math.random() * 200 + 50) * 100) / 100,
                dt_gerencial: date,
                $vr_pagamentos: Math.round((Math.random() * 250 + 50) * 100) / 100
              }))
            }
            break

          default:
            throw new Error(`Tipo de dados não suportado: ${data_type}`)
        }

        // Salvar dados brutos
        const { data: rawData, error: insertError } = await supabase
          .schema('bronze')
          .from('bronze_contahub_raw_data')
          .insert({
            bar_id: bar_id,
            data_type: data_type,
            data_date: date,
            raw_json: mockData,
            record_count: recordCount,
            processed: false
          })
          .select('id')
          .single()

        if (insertError) {
          console.error(`❌ [API] Erro ao salvar ${date}:`, insertError.message)
          results.push({ date, status: 'error', error: insertError.message })
          continue
        }

        // Processar imediatamente
        const { data: processResult, error: processError } = await supabase.functions.invoke('contahub_processor', {
          body: { raw_data_id: rawData.id }
        })

        if (processError || !processResult?.success) {
          console.error(`❌ [API] Erro ao processar ${date}:`, processError?.message)
          results.push({ date, status: 'process_error', error: processError?.message })
          continue
        }

        processedCount++
        results.push({ 
          date, 
          status: 'success', 
          records: processResult.inserted_records || recordCount 
        })

        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`❌ [API] Erro em ${date}:`, error)
        results.push({ 
          date, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processamento direto concluído: ${processedCount}/${dates.length} datas`,
      data_type,
      total_dates: dates.length,
      processed_count: processedCount,
      results
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ [API] Erro no preenchimento direto:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}
