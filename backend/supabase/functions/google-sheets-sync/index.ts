/**
 * 📊 DISPATCHER - SINCRONIZAÇÃO GOOGLE SHEETS
 * 
 * Edge Function unificada para todas as sincronizações de planilhas Google.
 * 
 * Actions disponíveis:
 * - nps: Sincroniza pesquisa NPS (antes: sync-nps)
 * - nps-reservas: Sincroniza NPS de reservas (antes: sync-nps-reservas)  
 * - voz-cliente: Sincroniza feedbacks (antes: sync-voz-cliente)
 * - pesquisa-felicidade: Sincroniza pesquisa de felicidade (antes: sync-pesquisa-felicidade)
 * - contagem: Sincroniza contagem de estoque (antes: sync-contagem-sheets)
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { read, utils } from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'
import { getGoogleAccessToken, downloadDriveFileAsExcel, parseDataBR, parseDataUS, parseNPSValue } from '../_shared/google-auth.ts'
import { getSupabaseServiceClient, getBarsAtivos, getApiConfig } from '../_shared/supabase-client.ts'
import { handleCorsOptions, jsonResponse, errorResponse } from '../_shared/cors.ts'

// ========== TIPOS ==========
interface SyncResult {
  bar_id: number
  bar_nome: string
  processados: number
  inseridos: number
  success: boolean
  error?: string
}

// ========== CONFIGURAÇÕES DEFAULT ==========
const DEFAULT_NPS_FILE_ID = '1GSsU3G2uEl6RHkQUop_WDWjzLBsMVomJN-rf-_J8Sx4'
const DEFAULT_NPS_RESERVAS_FILE_ID = '1HXSsGWum84HrB3yRvuzv-TsPcd8wEywVrOztdFcHna0'
const DEFAULT_VOZ_CLIENTE_FILE_ID = '10YoLlCX1K5bPI6qeZ56wagFSY8q7oOMCOJVgObNEKdo'
const DEFAULT_PESQUISA_FELICIDADE_FILE_ID = '1sYIKzphim9bku0jl_J6gSDEqrIhYMxAn'

// ========== REDIRECT HELPER ==========
async function redirectToFunction(functionName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const targetUrl = `${supabaseUrl}/functions/v1/${functionName}`
  
  console.log(`🔄 Redirecionando para: ${functionName}`)
  
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  })
  
  const result = await response.json()
  
  return {
    dispatched_to: functionName,
    result,
  }
}

// ========== SYNC NPS ==========
interface SyncOpts {
  data_inicio?: string
  data_fim?: string
}
async function syncNPS(barId?: number, opts?: SyncOpts): Promise<{ message: string; resultados: SyncResult[] }> {
  console.log('🔄 Iniciando sincronização do NPS...')
  
  const supabase = getSupabaseServiceClient()
  const baresParaProcessar = await getBarsAtivos(supabase, barId)
  const accessToken = await getGoogleAccessToken()
  
  console.log(`🏪 Processando ${baresParaProcessar.length} bar(es)`)
  
  const resultados: SyncResult[] = []
  
  for (const bar of baresParaProcessar) {
    console.log(`\n🏪 Processando NPS para: ${bar.nome} (ID: ${bar.id})`)
    
    try {
      const config = await getApiConfig(supabase, 'google_sheets', bar.id)
      const fileId = (config?.configuracoes as any)?.nps_file_id || DEFAULT_NPS_FILE_ID
      const sheetName = (config?.configuracoes as any)?.nps_sheet_name || 'Respostas ao formulário 1'
      
      console.log(`📋 Arquivo: ${fileId}`)
      
      const arrayBuffer = await downloadDriveFileAsExcel(fileId, accessToken)
      console.log(`✅ Arquivo baixado! (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`)
      
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })
      
      // Encontrar aba correta
      let targetSheet = workbook.Sheets[sheetName]
      if (!targetSheet) {
        const npsSheetName = workbook.SheetNames.find((name: string) => 
          name.toLowerCase().includes('respostas') || 
          name.toLowerCase().includes('formulário')
        )
        if (npsSheetName) {
          targetSheet = workbook.Sheets[npsSheetName]
        } else {
          throw new Error('Aba de respostas não encontrada')
        }
      }
      
      const jsonData = utils.sheet_to_json(targetSheet, { header: 1, defval: '', raw: false }) as any[][]
      console.log(`📊 ${jsonData.length} linhas encontradas`)
      
      const registros: any[] = []
      
      const dataInicioFiltro = opts?.data_inicio || null
      const dataFimFiltro = opts?.data_fim || null
      if (dataInicioFiltro || dataFimFiltro) {
        console.log(`📅 Filtro retroativo: ${dataInicioFiltro || 'início'} até ${dataFimFiltro || 'fim'}`)
      }

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row[0] || String(row[0]).trim() === '') continue
        
        try {
          const timestampCompleto = String(row[0] || '')
          const dataAjustada = row[14] // Coluna O com data limpa
          const dataFormatada = parseDataBR(String(dataAjustada || ''))
          
          if (!dataFormatada) continue
          if (dataInicioFiltro && dataFormatada < dataInicioFiltro) continue
          if (dataFimFiltro && dataFormatada > dataFimFiltro) continue
          
          const nps_ambiente = parseNPSValue(row[4])
          const nps_atendimento = parseNPSValue(row[5])
          const nps_limpeza = parseNPSValue(row[6])
          const nps_musica = parseNPSValue(row[7])
          const nps_comida = parseNPSValue(row[8])
          const nps_drink = parseNPSValue(row[9])
          const nps_preco = parseNPSValue(row[10])
          const nps_geral = parseNPSValue(row[11])
          const comentarios = row[12] ? String(row[12]).trim() : ''
          
          const reservaResposta = String(row[13] || '').trim().toLowerCase()
          const fez_reserva = reservaResposta === 'sim' || reservaResposta === 'yes' || reservaResposta === 's'
          
          const valores = [nps_ambiente, nps_atendimento, nps_limpeza, nps_musica, nps_comida, nps_drink, nps_preco, nps_geral]
          const valoresRespondidos = valores.filter(v => v > 0)
          const mediaGeral = valoresRespondidos.length > 0 
            ? valoresRespondidos.reduce((a, b) => a + b, 0) / valoresRespondidos.length 
            : 0
          const resultadoPercentual = (mediaGeral / 5) * 100
          
          registros.push({
            bar_id: bar.id,
            data_pesquisa: dataFormatada,
            setor: 'TODOS',
            quorum: 1,
            nps_geral,
            nps_ambiente,
            nps_atendimento,
            nps_limpeza,
            nps_musica,
            nps_comida,
            nps_drink,
            nps_preco,
            nps_reservas: 0,
            fez_reserva,
            media_geral: parseFloat(mediaGeral.toFixed(2)),
            resultado_percentual: parseFloat(resultadoPercentual.toFixed(2)),
            funcionario_nome: timestampCompleto.substring(0, 40),
            comentarios
          })
        } catch (error) {
          console.warn(`⚠️ Erro ao processar linha ${i + 1}:`, error)
        }
      }
      
      console.log(`✅ ${registros.length} registros processados`)
      
      // Inserir em lotes
      const BATCH_SIZE = 500
      let totalInserted = 0
      
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        
        const { data: insertedData, error: insertError } = await supabase
          .from('nps')
          .upsert(batch, {
            onConflict: 'bar_id,data_pesquisa,funcionario_nome,setor',
            ignoreDuplicates: false
          })
          .select()
        
        if (insertError) throw insertError
        totalInserted += insertedData?.length || 0
      }
      
      resultados.push({
        bar_id: bar.id,
        bar_nome: bar.nome,
        processados: registros.length,
        inseridos: totalInserted,
        success: true
      })
    } catch (error: any) {
      console.error(`❌ Erro ao processar ${bar.nome}:`, error)
      resultados.push({
        bar_id: bar.id,
        bar_nome: bar.nome,
        processados: 0,
        inseridos: 0,
        success: false,
        error: error.message
      })
    }
  }
  
  const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
  const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)
  
  return {
    message: `NPS sincronizado: ${baresParaProcessar.length} bar(es), ${totalProcessados} processados, ${totalInseridos} inseridos`,
    resultados
  }
}

// ========== SYNC NPS RESERVAS ==========
async function syncNPSReservas(barId?: number, opts?: SyncOpts): Promise<{ message: string; resultados: SyncResult[] }> {
  console.log('🔄 Iniciando sincronização do NPS Reservas...')
  
  const supabase = getSupabaseServiceClient()
  const baresParaProcessar = await getBarsAtivos(supabase, barId)
  const accessToken = await getGoogleAccessToken()
  
  const resultados: SyncResult[] = []
  
  for (const bar of baresParaProcessar) {
    console.log(`\n🏪 Processando NPS Reservas para: ${bar.nome} (ID: ${bar.id})`)
    
    try {
      const config = await getApiConfig(supabase, 'google_sheets', bar.id)
      const fileId = (config?.configuracoes as any)?.nps_reservas_file_id || DEFAULT_NPS_RESERVAS_FILE_ID
      
      const arrayBuffer = await downloadDriveFileAsExcel(fileId, accessToken)
      const workbook = read(new Uint8Array(arrayBuffer))
      
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const data = utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][]
      
      console.log(`📊 ${data.length} linhas encontradas`)
      
      let atualizados = 0
      
      const dataInicioFiltro = opts?.data_inicio || null
      const dataFimFiltro = opts?.data_fim || null
      if (dataInicioFiltro || dataFimFiltro) {
        console.log(`📅 NPS Reservas - Filtro retroativo: ${dataInicioFiltro || 'início'} até ${dataFimFiltro || 'fim'}`)
      }

      for (let i = 1; i < data.length; i++) {
        const row = data[i]
        if (!row || row.length === 0) continue
        
        // Formato americano MM/DD/YYYY
        const dataFormatada = parseDataUS(String(row[0] || '').trim())
        if (!dataFormatada) continue
        if (dataInicioFiltro && dataFormatada < dataInicioFiltro) continue
        if (dataFimFiltro && dataFormatada > dataFimFiltro) continue
        
        const nota = parseNPSValue(row[2])
        const dia_semana = row[1] ? String(row[1]).trim() : null
        const comentarios = row[3] ? String(row[3]).trim() : null
        
        const { error: erroInsert } = await supabase
          .from('nps_reservas')
          .insert({
            bar_id: bar.id,
            data_pesquisa: dataFormatada,
            nota,
            dia_semana,
            comentarios
          })
        
        if (!erroInsert) atualizados++
      }
      
      resultados.push({
        bar_id: bar.id,
        bar_nome: bar.nome,
        processados: data.length - 1,
        inseridos: atualizados,
        success: true
      })
    } catch (error: any) {
      console.error(`❌ Erro ao processar ${bar.nome}:`, error)
      resultados.push({
        bar_id: bar.id,
        bar_nome: bar.nome,
        processados: 0,
        inseridos: 0,
        success: false,
        error: error.message
      })
    }
  }
  
  const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
  const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)
  
  return {
    message: `NPS Reservas: ${baresParaProcessar.length} bar(es), ${totalProcessados} processados, ${totalInseridos} inseridos`,
    resultados
  }
}

// ========== SYNC VOZ CLIENTE ==========
async function syncVozCliente(barId?: number): Promise<{ message: string; resultados: SyncResult[] }> {
  console.log('🔄 Iniciando sincronização da Voz do Cliente...')
  
  const supabase = getSupabaseServiceClient()
  const accessToken = await getGoogleAccessToken()
  
  const arrayBuffer = await downloadDriveFileAsExcel(DEFAULT_VOZ_CLIENTE_FILE_ID, accessToken)
  const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })
  
  // Mapeamento de abas para bar_id
  const abaParaBar: { [key: string]: number } = {
    'Ordinário - VDC': 3,
    'Deboche - VDC': 4
  }
  
  const resultados: SyncResult[] = []
  
  for (const [abaNome, barIdAba] of Object.entries(abaParaBar)) {
    if (barId && barIdAba !== barId) continue
    
    const sheet = workbook.Sheets[abaNome]
    if (!sheet) {
      console.warn(`⚠️ Aba "${abaNome}" não encontrada`)
      continue
    }
    
    console.log(`\n🏪 Processando aba: ${abaNome}`)
    
    const jsonData = utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as any[][]
    
    const registros: any[] = []
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      
      const feedback = String(row[0] || '').trim()
      if (!feedback || feedback.length < 3) continue
      
      const dataFeedback = parseDataBR(String(row[9] || ''))
      if (!dataFeedback) continue
      
      registros.push({
        bar_id: barIdAba,
        data_feedback: dataFeedback,
        semana: row[8] ? parseInt(String(row[8])) || null : null,
        dia_semana: String(row[7] || '').trim() || null,
        feedback: feedback.substring(0, 2000),
        tom: String(row[1] || '').trim() || 'Neutro',
        categoria: String(row[2] || '').trim() || null,
        fonte: String(row[3] || '').trim() || null,
        criticidade: String(row[4] || '').trim() || null,
        responsavel: String(row[5] || '').trim() || null,
        status: String(row[6] || '').trim() || null
      })
    }
    
    console.log(`✅ ${registros.length} registros processados`)
    
    // Inserir em lotes
    const BATCH_SIZE = 500
    let totalInserted = 0
    
    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const batch = registros.slice(i, i + BATCH_SIZE)
      
      const { data: insertedData, error: insertError } = await supabase
        .from('voz_cliente')
        .upsert(batch, {
          onConflict: 'bar_id,data_feedback,feedback',
          ignoreDuplicates: false
        })
        .select('id')
      
      if (insertError) {
        console.error(`❌ Erro ao inserir lote:`, insertError)
        continue
      }
      totalInserted += insertedData?.length || 0
    }
    
    resultados.push({
      bar_id: barIdAba,
      bar_nome: abaNome,
      processados: registros.length,
      inseridos: totalInserted,
      success: true
    })
  }
  
  const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
  const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)
  
  return {
    message: `Voz do Cliente: ${resultados.length} bar(es), ${totalProcessados} processados, ${totalInseridos} inseridos`,
    resultados
  }
}

// ========== SYNC PESQUISA FELICIDADE ==========
async function syncPesquisaFelicidade(barId?: number): Promise<{ message: string; resultados: SyncResult[] }> {
  console.log('🔄 Iniciando sincronização da Pesquisa de Felicidade...')
  
  const supabase = getSupabaseServiceClient()
  const baresParaProcessar = await getBarsAtivos(supabase, barId)
  const accessToken = await getGoogleAccessToken()
  
  const resultados: SyncResult[] = []
  
  for (const bar of baresParaProcessar) {
    console.log(`\n🏪 Processando Pesquisa Felicidade para: ${bar.nome} (ID: ${bar.id})`)
    
    try {
      const config = await getApiConfig(supabase, 'google_sheets', bar.id)
      const fileId = (config?.configuracoes as any)?.pesquisa_felicidade_file_id || DEFAULT_PESQUISA_FELICIDADE_FILE_ID
      const sheetName = (config?.configuracoes as any)?.pesquisa_felicidade_sheet_name || 'Pesquisa da Felicidade'
      
      const arrayBuffer = await downloadDriveFileAsExcel(fileId, accessToken)
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })
      
      let targetSheet = workbook.Sheets[sheetName]
      if (!targetSheet) {
        const felicidadeSheetName = workbook.SheetNames.find((name: string) => 
          name.toLowerCase().includes('felicidade')
        )
        if (felicidadeSheetName) {
          targetSheet = workbook.Sheets[felicidadeSheetName]
        } else {
          throw new Error('Aba de pesquisa de felicidade não encontrada')
        }
      }
      
      const jsonData = utils.sheet_to_json(targetSheet, { header: 1, defval: '', raw: false }) as any[][]
      console.log(`📊 ${jsonData.length} linhas encontradas`)
      
      const registros: any[] = []
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row[0] || String(row[0]).trim() === '') continue
        
        const timestampCompleto = String(row[0] || '')
        const dataFormatada = parseDataBR(timestampCompleto.split(' ')[0])
        
        if (!dataFormatada) continue
        
        const eu_comigo_engajamento = parseNPSValue(row[2])
        const eu_com_empresa_pertencimento = parseNPSValue(row[3])
        const eu_com_colega_relacionamento = parseNPSValue(row[4])
        const eu_com_gestor_lideranca = parseNPSValue(row[5])
        const justica_reconhecimento = parseNPSValue(row[6])
        
        const valores = [eu_comigo_engajamento, eu_com_empresa_pertencimento, eu_com_colega_relacionamento, eu_com_gestor_lideranca, justica_reconhecimento]
        const valoresRespondidos = valores.filter(v => v > 0)
        const mediaGeral = valoresRespondidos.length > 0 
          ? valoresRespondidos.reduce((a, b) => a + b, 0) / valoresRespondidos.length 
          : 0
        const resultadoPercentual = (mediaGeral / 5) * 100
        
        registros.push({
          bar_id: bar.id,
          data_pesquisa: dataFormatada,
          setor: 'TODOS',
          quorum: 1,
          eu_comigo_engajamento,
          eu_com_empresa_pertencimento,
          eu_com_colega_relacionamento,
          eu_com_gestor_lideranca,
          justica_reconhecimento,
          media_geral: parseFloat(mediaGeral.toFixed(2)),
          resultado_percentual: parseFloat(resultadoPercentual.toFixed(2)),
          funcionario_nome: timestampCompleto.substring(0, 40)
        })
      }
      
      console.log(`✅ ${registros.length} registros processados`)
      
      // Inserir em lotes
      const BATCH_SIZE = 500
      let totalInserted = 0
      
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        
        const { data: insertedData, error: insertError } = await supabase
          .from('pesquisa_felicidade')
          .upsert(batch, {
            onConflict: 'bar_id,data_pesquisa,funcionario_nome,setor',
            ignoreDuplicates: false
          })
          .select()
        
        if (insertError) throw insertError
        totalInserted += insertedData?.length || 0
      }
      
      resultados.push({
        bar_id: bar.id,
        bar_nome: bar.nome,
        processados: registros.length,
        inseridos: totalInserted,
        success: true
      })
    } catch (error: any) {
      console.error(`❌ Erro ao processar ${bar.nome}:`, error)
      resultados.push({
        bar_id: bar.id,
        bar_nome: bar.nome,
        processados: 0,
        inseridos: 0,
        success: false,
        error: error.message
      })
    }
  }
  
  const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
  const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)
  
  return {
    message: `Pesquisa Felicidade: ${baresParaProcessar.length} bar(es), ${totalProcessados} processados, ${totalInseridos} inseridos`,
    resultados
  }
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions()
  }
  
  try {
    const body = await req.json().catch(() => ({}))
    const { action, bar_id, data_inicio, data_fim } = body
    const opts = (data_inicio || data_fim) ? { data_inicio, data_fim } : undefined
    
    console.log(`📊 Google Sheets Sync - Action: ${action || 'não especificada'}`)
    if (opts) console.log(`📅 Retroativo: ${data_inicio || '-'} até ${data_fim || '-'}`)
    
    let result: { message: string; resultados: SyncResult[] }
    
    switch (action) {
      case 'nps':
        result = await syncNPS(bar_id, opts)
        break
      
      case 'nps-reservas':
        result = await syncNPSReservas(bar_id, opts)
        break
      
      case 'voz-cliente':
        result = await syncVozCliente(bar_id)
        break
      
      case 'pesquisa-felicidade':
        result = await syncPesquisaFelicidade(bar_id)
        break
      
      case 'fichas-tecnicas':
        result = await redirectToFunction('sync-fichas-tecnicas', body)
        break
      
      case 'insumos-receitas':
        result = await redirectToFunction('sync-insumos-receitas', body)
        break
      
      case 'contagem':
        result = await redirectToFunction('sync-contagem-sheets', body)
        break
      
      case 'orcamentacao':
        result = await redirectToFunction('sync-orcamentacao-sheets', body)
        break
      
      case 'cmv':
        result = await redirectToFunction('sync-cmv-sheets', body)
        break
      
      default:
        return errorResponse(
          `Action inválida: ${action}. Use: nps, nps-reservas, voz-cliente, pesquisa-felicidade, fichas-tecnicas, insumos-receitas, contagem, orcamentacao, cmv`,
          null,
          400
        )
    }
    
    return jsonResponse({
      success: true,
      action,
      ...result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Erro na função:', error)
    return errorResponse(error.message, error)
  }
})
