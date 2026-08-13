/**
 * @camada bronze
 * @jobName google-sheets-sync
 * @descricao Sync planilhas Google
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * 📊 DISPATCHER - SINCRONIZAÇÃO GOOGLE SHEETS
 * 
 * Edge Function unificada para todas as sincronizações de planilhas Google.
 * 
 * Actions disponíveis:
 * - nps: Sincroniza pesquisa NPS (antes: sync-nps)
 * - nps-reservas: Sincroniza NPS de reservas (antes: sync-nps-reservas)  
 * - voz-cliente: Sincroniza feedbacks (antes: sync-voz-cliente)
 * - pesquisa-felicidade: Pesquisa da Felicidade (semanal, mensal e Marca Empregadora)
 * - tempo-de-casa: histórico de desligamentos (aba "Tempo de Casa")
 * - contagem: Sincroniza contagem de estoque (antes: sync-contagem-sheets)
 *
 * As duas actions de RH leem a planilha "Indicadores - RH" do bar, apontada por
 * `rh_indicadores_file_id` na config google_sheets daquele bar.
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { read, utils } from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'
import { getGoogleAccessToken, downloadDriveFileAsExcel, parseDataBR, parseDataUS, parseNPSValue } from '../_shared/google-auth.ts'
import { getSupabaseServiceClient, getBarsAtivos, getApiConfig } from '../_shared/supabase-client.ts'
import { handleCorsOptions, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'
import { withRetry, isRetriableError } from '../_shared/retry.ts'
import { validateFunctionEnv } from '../_shared/env-validator.ts'
import { requireAuth } from '../_shared/auth-guard.ts'

// ========== TIPOS ==========
interface SyncResult {
  bar_id: number
  bar_nome: string
  processados: number
  inseridos: number
  success: boolean
  error?: string
  // Contexto extra de um sync específico (ex.: quem o Tempo de Casa criou,
  // atualizou ou deixou divergente). Vai no retorno pra quem chamou conferir.
  detalhes?: Record<string, unknown>
}

// ========== CONFIGURAÇÕES DEFAULT ==========
const DEFAULT_NPS_FILE_ID = '1GSsU3G2uEl6RHkQUop_WDWjzLBsMVomJN-rf-_J8Sx4'
const DEFAULT_NPS_RESERVAS_FILE_ID = '1HXSsGWum84HrB3yRvuzv-TsPcd8wEywVrOztdFcHna0'
const DEFAULT_VOZ_CLIENTE_FILE_ID = '10YoLlCX1K5bPI6qeZ56wagFSY8q7oOMCOJVgObNEKdo'
// A planilha "Indicadores - RH" NÃO tem default: cada bar tem a sua e o arquivo
// vem de `rh_indicadores_file_id` na config do bar. Existia um default aqui (o
// do Ordinário) e o efeito foi a planilha do Ordinário ser gravada em todos os
// bar_id — o Deboche exibia os setores do Ordinário. Bar sem config é pulado.

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
      
      // Pular Deboche (bar_id 4) se não houver configuração específica
      if (bar.id === 4 && !config?.configuracoes) {
        console.log(`⏭️ Pulando ${bar.nome} - sem configuração específica de NPS`)
        resultados.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          processados: 0,
          inseridos: 0,
          success: true,
          error: 'Sem configuração específica - pulado'
        })
        continue
      }
      
      console.log(`📋 Arquivo: ${fileId}`)
      
      const arrayBuffer = await downloadDriveFileAsExcel(fileId, accessToken)
      console.log(`✅ Arquivo baixado! (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`)
      
      // dense:true usa bem menos memória em planilhas grandes (a de NPS acumula anos de respostas
      // e estourava o WORKER_RESOURCE_LIMIT da edge). cellStyles/cellHTML off = só os valores.
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array', dense: true, cellStyles: false, cellHTML: false })
      
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
        
        // sem .select(): devolver todas as linhas gravadas de volta estourava a memória da edge.
        // batch.length = contagem exata (ignoreDuplicates:false grava todas as linhas do lote).
        const { error: insertError } = await supabase
          .schema('crm' as any)
          .from('nps')
          .upsert(batch, {
            onConflict: 'bar_id,data_pesquisa,funcionario_nome,setor',
            ignoreDuplicates: false
          })

        if (insertError) throw insertError
        totalInserted += batch.length
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

      const registros: any[] = []
      
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
        
        registros.push({
          bar_id: bar.id,
          data_pesquisa: dataFormatada,
          nota,
          dia_semana,
          comentarios
        })
      }
      
      console.log(`✅ ${registros.length} registros processados`)
      
      // Inserir em lotes com upsert para evitar duplicação
      const BATCH_SIZE = 500
      let totalInserted = 0
      
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        
        const { data: insertedData, error: insertError } = await supabase
          .schema('crm' as any)
          .from('nps_reservas')
          .upsert(batch, {
            onConflict: 'bar_id,data_pesquisa,nota,comentarios',
            ignoreDuplicates: true
          })
          .select('id')
        
        if (insertError) {
          console.error(`❌ Erro ao inserir lote:`, insertError)
          continue
        }
        totalInserted += insertedData?.length || batch.length
      }
      
      atualizados = totalInserted
      
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
        .schema('crm' as any)
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

// ========== HELPERS: planilha "Indicadores - RH" ==========
//
// As duas planilhas (Ordinário e Deboche) têm as MESMAS abas com ORDEM DE
// COLUNA DIFERENTE — na semanal, o Ordinário começa por "Data da Pesquisa" e
// o Deboche por "Setor"; na mensal, um é Ano/Mês/Setor e o outro Ano/Setor/Mês.
// Por isso nada aqui usa índice fixo de coluna: tudo é resolvido pelo texto do
// cabeçalho. Ler por posição foi o que fez o sync antigo só funcionar no
// Ordinário.

/** minúsculas, sem acento, sem espaço duplicado — para casar cabeçalho e nome. */
function normalizarTexto(val: any): string {
  return String(val ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Percentual da planilha, preservado como está.
 *
 * NÃO converte para escala 1-5 (era o que o sync antigo fazia e destruía o
 * dado). A escala é tipo eNPS — %favorável menos %desfavorável — então valor
 * negativo é legítimo e precisa sobreviver. Vazio, "-" e "-%" viram null;
 * "Poucas respostas"/"Sem quórum" também (texto onde deveria haver número).
 */
function parsePercentual(val: any): number | null {
  if (val === null || val === undefined) return null
  const str = String(val).replace(/%/g, '').replace(',', '.').trim()
  if (!str || str === '-') return null
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

/** Número simples (coluna "Média", 0-5). */
function parseNumero(val: any): number | null {
  if (val === null || val === undefined) return null
  const str = String(val).replace(',', '.').trim()
  if (!str || str === '-') return null
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

/**
 * Data da planilha (serial do Excel ou DD/MM/AAAA), VALIDADA.
 *
 * A validação não é preciosismo: as planilhas têm datas impossíveis digitadas
 * à mão (o Deboche tem "31/06/2025", e junho não tem 31). Sem checar, isso
 * viraria '2025-06-31' e o INSERT inteiro do lote quebrava no Postgres.
 */
function parseDataPlanilha(val: any): string | null {
  if (val === null || val === undefined || val === '') return null

  let ano: number, mes: number, dia: number

  if (typeof val === 'number' || /^\d+(\.\d+)?$/.test(String(val).trim())) {
    const serial = Number(val)
    if (!isFinite(serial) || serial <= 0) return null
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000))
    if (isNaN(d.getTime())) return null
    ano = d.getUTCFullYear(); mes = d.getUTCMonth() + 1; dia = d.getUTCDate()
  } else {
    const partes = String(val).trim().split('/')
    if (partes.length !== 3) return null
    dia = parseInt(partes[0], 10); mes = parseInt(partes[1], 10); ano = parseInt(partes[2], 10)
    if (!dia || !mes || !ano) return null
    if (ano < 100) ano += 2000
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  // Round-trip: se o dia "transbordar" o mês, o Date normaliza para o mês
  // seguinte e a comparação abaixo denuncia.
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() + 1 !== mes || d.getUTCDate() !== dia) return null

  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}
function parseMes(val: any): number | null {
  const t = normalizarTexto(val)
  if (!t) return null
  if (MESES_PT[t]) return MESES_PT[t]
  const n = parseInt(t, 10)
  return n >= 1 && n <= 12 ? n : null
}

/** Acha a aba cujo nome (normalizado) satisfaz o predicado. */
function acharAba(workbook: any, pred: (nomeNormalizado: string) => boolean): any | null {
  const nome = workbook.SheetNames.find((n: string) => pred(normalizarTexto(n)))
  return nome ? { nome, sheet: workbook.Sheets[nome] } : null
}

/**
 * Acha a linha de cabeçalho (as abas têm título e linhas de descrição antes) e
 * devolve um resolvedor de coluna por trecho do texto do cabeçalho.
 */
function acharCabecalho(rows: any[][], obrigatorio: string, limite = 12) {
  for (let i = 0; i < Math.min(rows.length, limite); i++) {
    const row = rows[i] || []
    const idx = row.findIndex(c => normalizarTexto(c).includes(obrigatorio))
    if (idx >= 0) {
      const headers = row.map(c => normalizarTexto(c))
      return {
        linha: i,
        col: (...trechos: string[]): number => {
          for (const t of trechos) {
            const j = headers.findIndex(h => h.includes(t))
            if (j >= 0) return j
          }
          return -1
        },
      }
    }
  }
  return null
}

/**
 * Upsert em lote com deduplicação prévia pela chave de conflito.
 *
 * O Postgres recusa um ON CONFLICT DO UPDATE que atinja a mesma linha duas
 * vezes no mesmo comando, e as planilhas têm (data, setor) repetido de vez em
 * quando. Sem deduplicar, o lote inteiro morria. Última ocorrência vence, que
 * é o que a pessoa que digitou por último quis dizer.
 */
async function upsertDeduplicado(
  supabase: any, schema: string, tabela: string,
  registros: any[], onConflict: string,
): Promise<number> {
  const chave = onConflict.split(',').map(c => c.trim())
  const porChave = new Map<string, any>()
  for (const r of registros) porChave.set(chave.map(c => String(r[c])).join('|'), r)
  const unicos = [...porChave.values()]

  let inseridos = 0
  const BATCH_SIZE = 500
  for (let i = 0; i < unicos.length; i += BATCH_SIZE) {
    const batch = unicos.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .schema(schema as any).from(tabela)
      .upsert(batch, { onConflict, ignoreDuplicates: false })
      .select('id')
    if (error) {
      console.error(`❌ Erro ao gravar lote em ${schema}.${tabela}:`, error.message)
      throw new Error(`${schema}.${tabela}: ${error.message}`)
    }
    inseridos += data?.length || 0
  }
  if (unicos.length < registros.length) {
    console.log(`ℹ️ ${registros.length - unicos.length} linha(s) duplicada(s) na planilha — última venceu`)
  }
  return inseridos
}

/**
 * Arquivo "Indicadores - RH" do bar.
 *
 * SEM default global. O sync antigo caía num file_id fixo (o do Ordinário)
 * quando o bar não tinha config, e o resultado foi a planilha do Ordinário
 * gravada igualzinha em TODOS os bar_id — o Deboche exibia os setores do
 * Ordinário. Bar sem arquivo configurado agora é pulado, explicitamente.
 */
function acharArquivoRH(config: any): string | null {
  const c = (config?.configuracoes as any) || {}
  return c.rh_indicadores_file_id || c.pesquisa_felicidade_file_id || null
}

// ========== SYNC PESQUISA FELICIDADE ==========
/**
 * Sincroniza a Pesquisa da Felicidade a partir da planilha "Indicadores - RH"
 * de CADA bar: aba semanal, aba mensal e Marca Empregadora.
 *
 * Os percentuais são gravados como estão na planilha (ver `parsePercentual`) e
 * "Média"/"Resultado" vêm das colunas homônimas em vez de recalculados.
 */
async function syncPesquisaFelicidade(barId?: number): Promise<{ message: string; resultados: SyncResult[] }> {
  console.log('🔄 Iniciando sincronização da Pesquisa da Felicidade...')

  const supabase = getSupabaseServiceClient()
  const baresParaProcessar = await getBarsAtivos(supabase, barId)
  const accessToken = await getGoogleAccessToken()

  const resultados: SyncResult[] = []

  for (const bar of baresParaProcessar) {
    console.log(`\n🏪 Pesquisa da Felicidade — ${bar.nome} (ID: ${bar.id})`)

    try {
      const config = await getApiConfig(supabase, 'google_sheets', bar.id)
      const fileId = acharArquivoRH(config)
      if (!fileId) {
        console.log(`⏭️ ${bar.nome} não tem "rh_indicadores_file_id" configurado — pulando`)
        resultados.push({
          bar_id: bar.id, bar_nome: bar.nome, processados: 0, inseridos: 0, success: true,
          error: 'Sem planilha "Indicadores - RH" configurada para este bar',
        })
        continue
      }

      const arrayBuffer = await downloadDriveFileAsExcel(fileId, accessToken)
      // dense:true usa bem menos memória em planilhas grandes (a de NPS acumula anos de respostas
      // e estourava o WORKER_RESOURCE_LIMIT da edge). cellStyles/cellHTML off = só os valores.
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array', dense: true, cellStyles: false, cellHTML: false })

      let processados = 0
      let inseridos = 0

      // ── Semanal ────────────────────────────────────────────────────
      // "mensal" no nome desqualifica: as duas abas contêm "felicidade".
      const abaSemanal = acharAba(workbook, n => n.includes('felicidade') && !n.includes('mensal'))
      if (!abaSemanal) throw new Error('Aba "Pesquisa da Felicidade" não encontrada na planilha')

      const linhasSem = utils.sheet_to_json(abaSemanal.sheet, { header: 1, defval: '', raw: false }) as any[][]
      const cabSem = acharCabecalho(linhasSem, 'data da pesquisa')
      if (!cabSem) throw new Error(`Cabeçalho não encontrado na aba "${abaSemanal.nome}"`)

      const cData = cabSem.col('data da pesquisa')
      const cSetor = cabSem.col('setor')
      const cQuorum = cabSem.col('quorum')
      const cEng = cabSem.col('eu comigo')
      const cPer = cabSem.col('eu com empresa')
      const cRel = cabSem.col('eu com meu colega', 'eu com colega')
      const cLid = cabSem.col('eu com meu gestor', 'eu com gestor')
      const cRec = cabSem.col('justica')
      const cMedia = cabSem.col('media')
      const cResult = cabSem.col('resultado')

      const semanais: any[] = []
      for (let i = cabSem.linha + 1; i < linhasSem.length; i++) {
        const row = linhasSem[i] || []
        const data = parseDataPlanilha(row[cData])
        if (!data) continue // linhas de rodapé/meta não têm data válida
        const setor = String(row[cSetor] ?? '').trim() || 'TODOS'
        semanais.push({
          bar_id: bar.id,
          data_pesquisa: data,
          setor: setor.toUpperCase(),
          quorum: parseNumero(row[cQuorum]) ?? 0,
          eu_comigo_engajamento: parsePercentual(row[cEng]),
          eu_com_empresa_pertencimento: parsePercentual(row[cPer]),
          eu_com_colega_relacionamento: parsePercentual(row[cRel]),
          eu_com_gestor_lideranca: parsePercentual(row[cLid]),
          justica_reconhecimento: parsePercentual(row[cRec]),
          media_geral: parseNumero(row[cMedia]),
          resultado_percentual: parsePercentual(row[cResult]),
        })
      }
      processados += semanais.length
      inseridos += await upsertDeduplicado(supabase, 'hr', 'pesquisa_felicidade', semanais, 'bar_id,data_pesquisa,setor')
      console.log(`  📅 semanal: ${semanais.length} linha(s)`)

      // ── Mensal ─────────────────────────────────────────────────────
      const abaMensal = acharAba(workbook, n => n.includes('felicidade') && n.includes('mensal'))
      if (abaMensal) {
        const linhasMes = utils.sheet_to_json(abaMensal.sheet, { header: 1, defval: '', raw: false }) as any[][]
        const cabMes = acharCabecalho(linhasMes, 'mes da pesquisa')
        if (cabMes) {
          const mAno = cabMes.col('ano')
          const mMes = cabMes.col('mes da pesquisa')
          const mSetor = cabMes.col('setor')
          const mEng = cabMes.col('eu comigo')
          const mPer = cabMes.col('eu com empresa')
          const mRel = cabMes.col('eu com meu colega', 'eu com colega')
          const mLid = cabMes.col('eu com meu gestor', 'eu com gestor')
          const mRec = cabMes.col('justica')
          const mMedia = cabMes.col('media')
          const mResult = cabMes.col('resultado')

          const mensais: any[] = []
          for (let i = cabMes.linha + 1; i < linhasMes.length; i++) {
            const row = linhasMes[i] || []
            const ano = parseNumero(row[mAno])
            const mes = parseMes(row[mMes])
            const setor = String(row[mSetor] ?? '').trim()
            if (!ano || !mes || !setor) continue
            mensais.push({
              bar_id: bar.id,
              ano: Math.round(ano),
              mes,
              setor: setor.toUpperCase(),
              eu_comigo_engajamento: parsePercentual(row[mEng]),
              eu_com_empresa_pertencimento: parsePercentual(row[mPer]),
              eu_com_colega_relacionamento: parsePercentual(row[mRel]),
              eu_com_gestor_lideranca: parsePercentual(row[mLid]),
              justica_reconhecimento: parsePercentual(row[mRec]),
              media_geral: parseNumero(row[mMedia]),
              resultado_percentual: parsePercentual(row[mResult]),
            })
          }
          processados += mensais.length
          inseridos += await upsertDeduplicado(supabase, 'hr', 'pesquisa_felicidade_mensal', mensais, 'bar_id,ano,mes,setor')
          console.log(`  🗓️ mensal: ${mensais.length} linha(s)`)
        } else {
          console.warn(`  ⚠️ aba "${abaMensal.nome}" sem cabeçalho reconhecível — pulada`)
        }
      }

      // ── Marca Empregadora ──────────────────────────────────────────
      const abaMarca = acharAba(workbook, n => n.includes('marca empregadora'))
      if (abaMarca) {
        const linhasMarca = utils.sheet_to_json(abaMarca.sheet, { header: 1, defval: '', raw: false }) as any[][]
        const cabMarca = acharCabecalho(linhasMarca, 'mes da pesquisa')
        if (cabMarca) {
          const kAno = cabMarca.col('ano')
          const kMes = cabMarca.col('mes da pesquisa')
          const kQuorum = cabMarca.col('quorum')
          const kResult = cabMarca.col('resultado')

          const marcas: any[] = []
          for (let i = cabMarca.linha + 1; i < linhasMarca.length; i++) {
            const row = linhasMarca[i] || []
            const ano = parseNumero(row[kAno])
            const mes = parseMes(row[kMes])
            if (!ano || !mes) continue
            const quorum = parseNumero(row[kQuorum])
            const resultado = parsePercentual(row[kResult])
            // A aba já vem com os meses do ano inteiro pré-listados; os que ainda
            // não aconteceram são linha vazia e não viram registro.
            if (quorum === null && resultado === null) continue
            marcas.push({ bar_id: bar.id, ano: Math.round(ano), mes, quorum, resultado_percentual: resultado })
          }
          processados += marcas.length
          inseridos += await upsertDeduplicado(supabase, 'hr', 'marca_empregadora', marcas, 'bar_id,ano,mes')
          console.log(`  🏷️ marca empregadora: ${marcas.length} linha(s)`)
        }
      }

      resultados.push({
        bar_id: bar.id, bar_nome: bar.nome, processados, inseridos, success: true,
      })
    } catch (error: any) {
      console.error(`❌ Erro ao processar ${bar.nome}:`, error)
      resultados.push({
        bar_id: bar.id, bar_nome: bar.nome, processados: 0, inseridos: 0,
        success: false, error: error.message,
      })
    }
  }

  const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
  const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)

  return {
    message: `Pesquisa da Felicidade: ${baresParaProcessar.length} bar(es), ${totalProcessados} processados, ${totalInseridos} gravados`,
    resultados,
  }
}

// ========== SYNC TEMPO DE CASA (histórico de desligamentos) ==========

// Nomes de cargo que a planilha escreve diferente do cadastro. Só apelidos
// óbvios — o resto casa por texto normalizado, e o que sobrar vira cargo novo.
const APELIDOS_CARGO: Record<string, string> = {
  'asg': 'Auxiliar de Serviços Gerais',
  'cumin': 'Cumim',
  'cumins': 'Cumim',
  'cozinheira': 'Cozinheiro',
  'sub gerente': 'Subgerente',
  'gerente': 'Gerente Operacional',
  'estagiario': 'Estagiário',
  'recepcionista': 'Recepcionista',
  'auxiliar de limpeza': 'Auxiliar de Limpeza',
}

/**
 * Resolve o cargo textual da planilha para um `hr.cargos.id` do bar.
 * Cria o cargo quando é um cargo real que o cadastro ainda não tem (a planilha
 * cobre anos de história e traz funções que já não existem, tipo "Técnico de Som").
 */
function criarResolvedorDeCargo(supabase: any, barId: number, cargos: { id: number; nome: string }[]) {
  const porNome = new Map(cargos.map(c => [normalizarTexto(c.nome), c.id]))
  const criados: string[] = []

  return {
    criados,
    async resolver(textoCargo: string): Promise<number | null> {
      const bruto = String(textoCargo ?? '').trim()
      if (!bruto) return null

      const norm = normalizarTexto(bruto)
      const alvo = APELIDOS_CARGO[norm] ?? bruto
      const chave = normalizarTexto(alvo)

      const existente = porNome.get(chave)
      if (existente) return existente

      const { data, error } = await supabase
        .schema('hr' as any).from('cargos')
        .insert({ bar_id: barId, nome: alvo, ativo: false })
        .select('id').single()
      if (error) {
        console.warn(`  ⚠️ não consegui criar o cargo "${alvo}": ${error.message}`)
        return null
      }
      porNome.set(chave, data.id)
      criados.push(alvo)
      return data.id
    },
  }
}

/**
 * Importa a aba "Tempo de Casa" para hr.funcionarios: data de desligamento,
 * se foi voluntário/involuntário e o motivo.
 *
 * Duas armadilhas da planilha, tratadas aqui:
 *
 * 1) Quem AINDA ESTÁ na casa aparece com a data de desligamento preenchida —
 *    é a fórmula que calcula "tempo de casa (dias)" ancorada em HOJE(),
 *    congelada no último recálculo. Dezenas de linhas compartilham essa mesma
 *    data. Importar isso como desligamento demitiria a operação inteira. A
 *    data-sentinela é detectada pela repetição (ver `acharDataSentinela`).
 *
 * 2) A mesma pessoa reaparece quando é recontratada (o Deboche tem "João
 *    Paulo", "Luma de Oliveira" e "Alane de Jesus" duas vezes). Por isso a
 *    chave de casamento é nome + data de admissão, nunca só o nome — senão a
 *    segunda passagem sobrescreveria a primeira.
 */
function acharDataSentinela(datas: string[]): string | null {
  if (!datas.length) return null
  const contagem = new Map<string, number>()
  for (const d of datas) contagem.set(d, (contagem.get(d) || 0) + 1)

  const ordenadas = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const [dataMaisComum, vezes] = ordenadas[0]
  const segundaMaior = ordenadas[1]?.[1] ?? 0

  // Uma data compartilhada por dezenas de pessoas e que destoa MUITO da segunda
  // colocada só pode ser fórmula. Desligamento real também repete (o Ordinário
  // desligou 5 pessoas em 08/07/2026), por isso o critério é a distância para a
  // segunda, e não "ser a data mais recente" — a planilha tem linha com data
  // futura digitada à mão, e isso derrubava a detecção.
  return vezes >= 5 && vezes >= segundaMaior * 3 ? dataMaisComum : null
}

/**
 * Decide se um nome da planilha corresponde a alguém do cadastro.
 *
 * O problema: o cadastro guarda nome completo em caixa alta ("MATHEUS DA SILVA
 * MONTENEGRO", "JOÃO VICTOR DUARTH DA SILVA") e a planilha usa o nome curto do
 * dia a dia ("Matheus Montenegro", "João Victor"). Comparar por conteúdo de
 * tokens ("um nome contido no outro") parece resolver, mas casa errado: existem
 * três "João Victor" diferentes e a planilha não distingue.
 *
 * Por isso a decisão tem TRÊS saídas, e só uma delas escreve:
 *  - `casado`   — nome idêntico (mesmos tokens). Preenche o desligamento.
 *  - `ambiguo`  — parece a mesma pessoa (um nome contido no outro), mas não dá
 *                 pra ter certeza. NÃO escreve e NÃO cria: vai pro relatório.
 *  - `novo`     — nenhum candidato plausível. Aí sim pode criar o histórico.
 *
 * A assimetria é de propósito: errar criando duplicata da equipe inteira, ou
 * carimbar desligamento na pessoa errada, é muito pior do que devolver uma
 * lista pro RH conferir.
 */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
function tokensDoNome(nome: string): string[] {
  return normalizarTexto(nome).split(' ').filter(t => t && !PARTICULAS.has(t))
}
type Veredito =
  | { tipo: 'casado'; registro: any }
  | { tipo: 'ambiguo'; parecidos: string[] }
  | { tipo: 'novo' }

function criarCasadorDeNomes(existentes: any[]) {
  const fichas = existentes.map(f => ({ registro: f, tokens: new Set(tokensDoNome(f.nome)), usado: false }))
  const contido = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every(t => b.has(t))
  const iguais = (a: Set<string>, b: Set<string>) => a.size === b.size && contido(a, b)

  return function avaliar(nome: string, admissao: string | null): Veredito {
    const tokens = new Set(tokensDoNome(nome))
    if (!tokens.size) return { tipo: 'novo' }

    const disponiveis = fichas.filter(f => !f.usado)

    // Nome idêntico. Com mais de um, a data de admissão desempata (recontratação).
    const exatos = disponiveis.filter(f => iguais(tokens, f.tokens))
    if (exatos.length) {
      const escolhido = exatos.find(f => f.registro.data_admissao === admissao) ?? exatos[0]
      escolhido.usado = true
      return { tipo: 'casado', registro: escolhido.registro }
    }

    // Um nome contido no outro: pode ser a mesma pessoa, pode ser um xará.
    const parecidos = disponiveis.filter(f => contido(tokens, f.tokens) || contido(f.tokens, tokens))
    if (parecidos.length) return { tipo: 'ambiguo', parecidos: parecidos.map(f => f.registro.nome) }

    return { tipo: 'novo' }
  }
}

async function syncTempoDeCasa(barId?: number): Promise<{ message: string; resultados: SyncResult[] }> {
  console.log('🔄 Iniciando sincronização do Tempo de Casa (desligamentos)...')

  const supabase = getSupabaseServiceClient()
  const baresParaProcessar = await getBarsAtivos(supabase, barId)
  const accessToken = await getGoogleAccessToken()

  const resultados: SyncResult[] = []

  for (const bar of baresParaProcessar) {
    console.log(`\n🏪 Tempo de Casa — ${bar.nome} (ID: ${bar.id})`)

    try {
      const config = await getApiConfig(supabase, 'google_sheets', bar.id)
      const fileId = acharArquivoRH(config)
      if (!fileId) {
        console.log(`⏭️ ${bar.nome} não tem "rh_indicadores_file_id" configurado — pulando`)
        resultados.push({
          bar_id: bar.id, bar_nome: bar.nome, processados: 0, inseridos: 0, success: true,
          error: 'Sem planilha "Indicadores - RH" configurada para este bar',
        })
        continue
      }

      const arrayBuffer = await downloadDriveFileAsExcel(fileId, accessToken)
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array', dense: true, cellStyles: false, cellHTML: false })

      const aba = acharAba(workbook, n => n.includes('tempo de casa'))
      if (!aba) throw new Error('Aba "Tempo de Casa" não encontrada na planilha')

      const linhas = utils.sheet_to_json(aba.sheet, { header: 1, defval: '', raw: false }) as any[][]
      const cab = acharCabecalho(linhas, 'data de admissao')
      if (!cab) throw new Error(`Cabeçalho não encontrado na aba "${aba.nome}"`)

      const cAdm = cab.col('data de admissao')
      const cDes = cab.col('data de desligamento')
      const cNome = cab.col('nome')
      const cCargo = cab.col('cargo')
      const cTipo = cab.col('volunt')
      // O Ordinário põe "Motivo/Anotações" na linha DE BAIXO do cabeçalho, então
      // nem sempre dá pra achar pelo texto — cai pra coluna seguinte ao tipo.
      const cMotivo = cab.col('motivo', 'observ', 'anota') >= 0
        ? cab.col('motivo', 'observ', 'anota')
        : (cTipo >= 0 ? cTipo + 1 : -1)

      // Passo 1: ler as linhas válidas.
      type LinhaCasa = { nome: string; admissao: string; desligamento: string | null; cargo: string; tipo: string | null; motivo: string | null }
      const brutas: LinhaCasa[] = []
      for (let i = cab.linha + 1; i < linhas.length; i++) {
        const row = linhas[i] || []
        const nome = String(row[cNome] ?? '').trim()
        const admissao = parseDataPlanilha(row[cAdm])
        if (!nome || !admissao) continue

        const tipoBruto = normalizarTexto(row[cTipo])
        brutas.push({
          nome,
          admissao,
          desligamento: parseDataPlanilha(row[cDes]),
          cargo: String(row[cCargo] ?? '').trim(),
          // A planilha alterna gênero ("Voluntária"/"Involuntário") e às vezes usa
          // a coluna pra escrever o motivo ("Término de Experiencia").
          tipo: tipoBruto.startsWith('involunt') ? 'Involuntário'
              : tipoBruto.startsWith('volunt') ? 'Voluntário'
              : null,
          motivo: cMotivo >= 0 ? (String(row[cMotivo] ?? '').trim() || null) : null,
        })
      }

      // Passo 2: descobrir a data-fórmula dos que continuam na casa.
      const sentinela = acharDataSentinela(brutas.map(b => b.desligamento).filter(Boolean) as string[])
      if (sentinela) {
        const n = brutas.filter(b => b.desligamento === sentinela).length
        console.log(`  📌 ${sentinela} é a data-fórmula dos ativos (${n} pessoa(s)) — não conta como desligamento`)
      } else {
        console.log('  📌 nenhuma data-fórmula detectada — todas as datas contam como desligamento real')
      }

      // Passo 3: casar com o cadastro e gravar.
      const [{ data: existentes }, { data: cargos }] = await Promise.all([
        supabase.schema('hr' as any).from('funcionarios')
          .select('id, nome, data_admissao, data_demissao, tipo_desligamento, motivo_desligamento, ativo')
          .eq('bar_id', bar.id),
        supabase.schema('hr' as any).from('cargos').select('id, nome').eq('bar_id', bar.id),
      ])

      const avaliar = criarCasadorDeNomes(existentes || [])
      const cargoResolver = criarResolvedorDeCargo(supabase, bar.id, cargos || [])
      const criados: string[] = []
      const atualizados: string[] = []
      const divergentes: string[] = []
      const ambiguos: string[] = []
      const ativosSemCadastro: string[] = []
      let gravados = 0

      // Quem ainda está na casa é avaliado PRIMEIRO: a equipe atual tem
      // prioridade para consumir um registro do cadastro, e não uma linha de
      // 2021 com o mesmo nome.
      const ehSentinelaDe = (l: LinhaCasa) => !!sentinela && l.desligamento === sentinela
      const ordenadas = [...brutas].sort((a, b) => Number(ehSentinelaDe(b)) - Number(ehSentinelaDe(a)))

      for (const linha of ordenadas) {
        const desligamento = ehSentinelaDe(linha) ? null : linha.desligamento

        // Desligamento antes da admissão é linha inconsistente na planilha (ou
        // casamento errado esperando pra acontecer). Não entra.
        if (desligamento && desligamento < linha.admissao) {
          divergentes.push(`${linha.nome}: desligamento ${desligamento} anterior à admissão ${linha.admissao}`)
          continue
        }

        const veredito = avaliar(linha.nome, linha.admissao)

        if (veredito.tipo === 'ambiguo') {
          ambiguos.push(`${linha.nome} ~ ${veredito.parecidos.join(' / ')}`)
          continue
        }

        if (veredito.tipo === 'novo') {
          // Pessoa da equipe ATUAL que não está no cadastro não é criada aqui:
          // o cadastro é a fonte de verdade de quem trabalha hoje. Fica no
          // relatório pro RH cadastrar direito.
          if (!desligamento) { ativosSemCadastro.push(linha.nome); continue }

          const cargoId = await cargoResolver.resolver(linha.cargo)
          const { error } = await supabase.schema('hr' as any).from('funcionarios').insert({
            bar_id: bar.id,
            nome: linha.nome,
            data_admissao: linha.admissao,
            data_demissao: desligamento,
            tipo_desligamento: linha.tipo,
            motivo_desligamento: linha.motivo,
            cargo_id: cargoId,
            tipo_contratacao: 'CLT',
            ativo: false,
          })
          if (error) { console.warn(`  ⚠️ falha ao criar "${linha.nome}": ${error.message}`); continue }
          criados.push(linha.nome)
          gravados++
          continue
        }

        const atual = veredito.registro
        if (!desligamento) continue // ainda na casa: nada a preencher

        if (atual.data_admissao && desligamento < atual.data_admissao) {
          divergentes.push(`${linha.nome}: planilha desliga em ${desligamento}, mas o cadastro admite em ${atual.data_admissao}`)
          continue
        }

        // Campo preenchido à mão nunca é sobrescrito (regra do CLAUDE.md).
        // Se a planilha discorda do que já está gravado, só reporta.
        if (atual.data_demissao && atual.data_demissao !== desligamento) {
          divergentes.push(`${linha.nome}: cadastro ${atual.data_demissao} × planilha ${desligamento}`)
          continue
        }

        const patch: Record<string, any> = {}
        if (!atual.data_demissao) { patch.data_demissao = desligamento; patch.ativo = false }
        if (!atual.tipo_desligamento && linha.tipo) patch.tipo_desligamento = linha.tipo
        if (!atual.motivo_desligamento && linha.motivo) patch.motivo_desligamento = linha.motivo
        if (!Object.keys(patch).length) continue

        const { error } = await supabase.schema('hr' as any)
          .from('funcionarios').update(patch).eq('id', atual.id)
        if (error) { console.warn(`  ⚠️ falha ao atualizar "${linha.nome}": ${error.message}`); continue }
        atualizados.push(`${linha.nome} → ${desligamento}`)
        gravados++
      }

      console.log(`  ✅ ${brutas.length} linha(s) lidas · ${criados.length} criado(s) · ${atualizados.length} atualizado(s) · ${divergentes.length} divergente(s)`)
      if (cargoResolver.criados.length) console.log(`  🏷️ cargos criados: ${cargoResolver.criados.join(', ')}`)
      if (divergentes.length) console.log(`  ⚠️ divergências (mantido o cadastro): ${divergentes.join(' | ')}`)
      if (ambiguos.length) console.log(`  ❓ ambíguos (não tocados): ${ambiguos.join(' | ')}`)
      if (ativosSemCadastro.length) console.log(`  👤 na planilha mas sem cadastro (não criados): ${ativosSemCadastro.join(', ')}`)

      resultados.push({
        bar_id: bar.id, bar_nome: bar.nome,
        processados: brutas.length, inseridos: gravados, success: true,
        detalhes: {
          data_formula_ativos: sentinela,
          criados,
          atualizados,
          cargos_criados: cargoResolver.criados,
          divergencias: divergentes,
          ambiguos,
          ativos_sem_cadastro: ativosSemCadastro,
        },
      })
    } catch (error: any) {
      console.error(`❌ Erro ao processar ${bar.nome}:`, error)
      resultados.push({
        bar_id: bar.id, bar_nome: bar.nome, processados: 0, inseridos: 0,
        success: false, error: error.message,
      })
    }
  }

  const totalProcessados = resultados.reduce((acc, r) => acc + r.processados, 0)
  const totalInseridos = resultados.reduce((acc, r) => acc + r.inseridos, 0)

  return {
    message: `Tempo de Casa: ${baresParaProcessar.length} bar(es), ${totalProcessados} linhas lidas, ${totalInseridos} gravados`,
    resultados,
  }
}

// ========== PROCESSAR UMA ACTION ==========
async function processAction(
  action: string,
  bar_id?: number,
  opts?: SyncOpts,
  body?: any,
  supabase?: any
): Promise<{ action: string; success: boolean; message?: string; resultados?: SyncResult[]; error?: string; records_affected?: number }> {
  // Heartbeat por action
  const hbSupabase = supabase || getSupabaseServiceClient()
  const { heartbeatId, startTime } = await heartbeatStart(hbSupabase, 'google-sheets-sync', bar_id, action, 'api')
  
  try {
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

      case 'tempo-de-casa':
        result = await syncTempoDeCasa(bar_id)
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
        await heartbeatEnd(hbSupabase, heartbeatId, 'error', startTime, 0, { action }, `Action inválida: ${action}`)
        return {
          action,
          success: false,
          error: `Action inválida: ${action}. Use: nps, nps-reservas, voz-cliente, pesquisa-felicidade, tempo-de-casa, fichas-tecnicas, insumos-receitas, contagem, orcamentacao, cmv`
        }
    }
    
    // Calcular total de registros afetados
    const totalRecords = result.resultados?.reduce((acc, r) => acc + (r.inseridos || 0), 0) || 0
    const hasErrors = result.resultados?.some(r => !r.success)
    const status = hasErrors ? 'partial' : 'success'
    
    await heartbeatEnd(hbSupabase, heartbeatId, status, startTime, totalRecords, {
      action,
      message: result.message,
      bares: result.resultados?.length || 0
    })
    
    return {
      action,
      success: true,
      records_affected: totalRecords,
      ...result
    }
  } catch (error: any) {
    console.error(`❌ Erro ao processar action ${action}:`, error)
    await heartbeatError(hbSupabase, heartbeatId, startTime, error, { action }, 'google-sheets-sync', bar_id)
    return {
      action,
      success: false,
      error: error.message
    }
  }
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req)
  }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    // Validar variáveis de ambiente obrigatórias
    validateFunctionEnv('google-sheets-sync', [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_SERVICE_ACCOUNT_KEY'
    ]);
    const body = await req.json().catch(() => ({}))
    const { action, actions, bar_id, data_inicio, data_fim } = body
    const opts = (data_inicio || data_fim) ? { data_inicio, data_fim } : undefined
    
    // Suporte a ambos: action (singular) e actions (array)
    const actionsToProcess: string[] = actions 
      ? (Array.isArray(actions) ? actions : [actions])
      : (action ? [action] : [])
    
    if (actionsToProcess.length === 0) {
      return errorResponse(
        'Nenhuma action especificada. Use "action" (singular) ou "actions" (array).',
        req,
        null,
        400
      )
    }
    
    console.log(`📊 Google Sheets Sync - Actions: ${actionsToProcess.join(', ')}`)
    if (opts) console.log(`📅 Retroativo: ${data_inicio || '-'} até ${data_fim || '-'}`)
    
    const supabase = getSupabaseServiceClient()
    
    // Processar múltiplas actions sequencialmente
    if (actionsToProcess.length > 1) {
      const results: any[] = []
      let allSuccess = true
      let totalRecords = 0
      
      for (const act of actionsToProcess) {
        console.log(`\n🔄 Processando action: ${act}`)
        const result = await processAction(act, bar_id, opts, body, supabase)
        results.push(result)
        if (!result.success) allSuccess = false
        totalRecords += result.records_affected || 0
      }
      
      return jsonResponse({
        success: allSuccess,
        mode: 'batch',
        actions_processed: actionsToProcess.length,
        total_records_affected: totalRecords,
        results,
        timestamp: new Date().toISOString()
      })
    }
    
    // Action única
    const singleAction = actionsToProcess[0]
    const result = await processAction(singleAction, bar_id, opts, body, supabase)
    
    if (!result.success) {
      return errorResponse(result.error || 'Erro desconhecido', req, null, 400)
    }
    
    return jsonResponse({
      success: true,
      action: singleAction,
      message: result.message,
      resultados: result.resultados,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Erro na função:', error)
    return errorResponse(error?.message || String(error), req, error)
  }
})
