/**
 * @camada bronze
 * @jobName contaazul-sync
 * @descricao Sync diario Conta Azul
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * Edge Function: contaazul-sync
 * 
 * Sincroniza dados financeiros do Conta Azul para tabelas locais.
 * 
 * Sync modes:
 * - daily_incremental: busca lancamentos alterados nos ultimos 2 dias
 * - full_month: busca por data_vencimento do mes atual + mes anterior
 * - full_sync: categorias, centros de custo, pessoas, contas + lancamentos
 * - custom: usa date_from/date_to fornecidos
 * 
 * @version 1.0.0
 * @date 2026-03-24
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsOptions, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com'
const CONTA_AZUL_AUTH_URL = 'https://auth.contaazul.com'
const REQUEST_TIMEOUT_MS = 25000
const PAGE_SIZE = 200
const SAFE_TIMEOUT_MS = 120000 // 120s (30s antes do limite de 150s do Supabase)
const MAX_RECORDS_PER_SYNC = 10000 // Limitar registros por execução (aumentado para capturar todos)

interface SyncRequest {
  bar_id: number
  sync_mode: 'daily_incremental' | 'full_month' | 'full_sync' | 'custom'
  date_from?: string
  date_to?: string
}

interface ApiCredentials {
  id: number
  bar_id: number
  client_id: string
  client_secret: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
}

interface SyncStats {
  lancamentos: number
  categorias: number
  centros_custo: number
  pessoas: number
  contas_financeiras: number
  erros: number
}

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configuradas')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return btoa(clientId + ':' + clientSecret)
}

// ============ REFRESH TOKEN ============

async function refreshToken(supabase: SupabaseClient, credentials: ApiCredentials): Promise<string | null> {
  if (!credentials.refresh_token) {
    console.error('[contaazul-sync] Sem refresh_token disponivel')
    return null
  }

  const tokenUrl = CONTA_AZUL_AUTH_URL + '/oauth2/token'
  const basicAuth = encodeBasicAuth(credentials.client_id, credentials.client_secret)

  const body = new URLSearchParams({
    refresh_token: credentials.refresh_token,
    grant_type: 'refresh_token'
  })

  console.log('[contaazul-sync] Renovando access_token...')

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[contaazul-sync] Erro ao renovar token:', response.status, errorText)
      return null
    }

    const tokenData = await response.json()
    
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600))

    const { error } = await supabase
      .from('api_credentials')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .eq('id', credentials.id)

    if (error) {
      console.error('[contaazul-sync] Erro ao salvar tokens:', error)
      return null
    }

    console.log('[contaazul-sync] Token renovado com sucesso')
    return tokenData.access_token
  } catch (err) {
    console.error('[contaazul-sync] Excecao ao renovar token:', err)
    return null
  }
}

// ============ FETCH HELPER ============

async function fetchCA(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string,
  supabase: SupabaseClient,
  credentials: ApiCredentials,
  retryCount: number = 0
): Promise<{ data: any; newToken?: string } | null> {
  
  const url = new URL(CONTA_AZUL_API_URL + endpoint)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.status === 401 && retryCount < 1) {
      console.log('[contaazul-sync] Token expirado, tentando renovar...')
      const newToken = await refreshToken(supabase, credentials)
      if (newToken) {
        return fetchCA(endpoint, params, newToken, supabase, credentials, retryCount + 1)
      }
      return null
    }

    if (response.status === 429 && retryCount < 2) {
      console.log('[contaazul-sync] Rate limit, aguardando 2s...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      return fetchCA(endpoint, params, accessToken, supabase, credentials, retryCount + 1)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[contaazul-sync] Erro API ' + response.status + ':', errorText)
      return null
    }

    const data = await response.json()
    return { data, newToken: retryCount > 0 ? accessToken : undefined }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      console.error('[contaazul-sync] Timeout na requisicao')
    } else {
      console.error('[contaazul-sync] Erro na requisicao:', err)
    }
    return null
  }
}

// ============ SYNC LANCAMENTOS ============

async function syncLancamentos(
  supabase: SupabaseClient,
  credentials: ApiCredentials,
  accessToken: string,
  barId: number,
  dateFrom: string,
  dateTo: string,
  useAlteracaoFilter: boolean,
  functionStartTime: number
): Promise<{ count: number; newToken?: string; timedOut?: boolean }> {
  
  let totalCount = 0
  let currentToken = accessToken

  const tipos = [
    { endpoint: '/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar', tipo: 'DESPESA' },
    { endpoint: '/v1/financeiro/eventos-financeiros/contas-a-receber/buscar', tipo: 'RECEITA' }
  ]

  for (const { endpoint, tipo } of tipos) {
    let pagina = 1
    let totalPaginas = 1

    console.log('[contaazul-sync] Buscando ' + tipo + '...')

    while (pagina <= totalPaginas) {
      // Verificar timeout safety
      if (Date.now() - functionStartTime > SAFE_TIMEOUT_MS) {
        console.warn('[contaazul-sync] ⚠️ Approaching timeout, saving progress and stopping')
        return { count: totalCount, newToken: currentToken !== accessToken ? currentToken : undefined, timedOut: true }
      }

      // Verificar limite de registros por execução (desabilitado para sincronização completa)
      // if (totalCount >= MAX_RECORDS_PER_SYNC) {
      //   console.warn(`[contaazul-sync] ⚠️ Limite de ${MAX_RECORDS_PER_SYNC} registros atingido. Próxima execução continuará.`)
      //   return { count: totalCount, newToken: currentToken !== accessToken ? currentToken : undefined, timedOut: false }
      // }
      const params: Record<string, string> = {
        pagina: String(pagina),
        tamanho_pagina: String(PAGE_SIZE)
      }

      if (useAlteracaoFilter) {
        params.data_alteracao_de = dateFrom + 'T00:00:00'
        params.data_alteracao_ate = dateTo + 'T23:59:59'
      } else {
        // API do Conta Azul exige data_vencimento (não aceita data_competencia como filtro)
        // Buscar período amplo (3 meses) para capturar lançamentos com competência no período
        // mas vencimento futuro. Depois filtramos por data_competencia no banco.
        const fromDate = new Date(dateFrom)
        fromDate.setMonth(fromDate.getMonth() - 1) // 1 mês antes
        const toDate = new Date(dateTo)
        toDate.setMonth(toDate.getMonth() + 2) // 2 meses depois
        
        params.data_vencimento_de = fromDate.toISOString().split('T')[0]
        params.data_vencimento_ate = toDate.toISOString().split('T')[0]
      }

      const result = await fetchCA(endpoint, params, currentToken, supabase, credentials)
      
      if (!result) {
        console.error('[contaazul-sync] Falha ao buscar ' + tipo + ' pagina ' + pagina)
        break
      }

      if (result.newToken) {
        currentToken = result.newToken
      }

      const { data } = result
      const itens = data.itens || []
      totalPaginas = Math.ceil((data.itens_totais || 0) / PAGE_SIZE)

      console.log('[contaazul-sync] ' + tipo + ' pagina ' + pagina + '/' + totalPaginas + ' - ' + itens.length + ' itens')
      console.log('[contaazul-sync] bar_id=' + barId + ', total_itens_api=' + (data.itens_totais || 0))

      if (itens.length > 0) {
        console.log('[contaazul-sync] Preparando ' + itens.length + ' lancamentos para upsert...')
        
        // Processar em batches de 500 para evitar timeout em upserts grandes
        const BATCH_SIZE = 500
        const totalBatches = Math.ceil(itens.length / BATCH_SIZE)
        
        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batchStart = batchIdx * BATCH_SIZE
          const batchEnd = Math.min(batchStart + BATCH_SIZE, itens.length)
          const batchItens = itens.slice(batchStart, batchEnd)
          
          console.log(`[contaazul-sync] Processando batch ${batchIdx + 1}/${totalBatches} (${batchItens.length} itens)`)
          
        const lancamentos = batchItens.map((item: any) => {
          // API Conta Azul retorna valores JÁ em reais, não precisa dividir por 100
          const valorTotal = item.total ? Number(item.total) : 0
          const valorPago = item.pago ? Number(item.pago) : 0
          const valorNaoPago = item.nao_pago ? Number(item.nao_pago) : 0
          
          return {
            contaazul_id: item.id,
            contaazul_evento_id: item.id_evento || null,
            bar_id: barId,
            tipo: tipo,
            status: item.status || 'PENDENTE',
            status_traduzido: item.status_traduzido || null,
            descricao: item.descricao || null,
            observacao: item.observacao || null,
            valor_bruto: valorTotal,
            valor_liquido: valorTotal - valorNaoPago,
            valor_pago: valorPago,
            valor_nao_pago: valorNaoPago,
            data_vencimento: item.data_vencimento || null,
            data_competencia: item.data_competencia || null,
            data_pagamento: item.data_pagamento || null,
            data_pagamento_previsto: item.data_pagamento_previsto || null,
            data_criacao_ca: item.data_criacao || null,
            data_alteracao_ca: item.data_alteracao || null,
            categoria_id: item.categorias?.[0]?.id || null,
            categoria_nome: item.categorias?.[0]?.nome || null,
            todas_categorias: item.categorias || null,
            centro_custo_id: item.centros_de_custo?.[0]?.id || null,
            centro_custo_nome: item.centros_de_custo?.[0]?.nome || null,
            todos_centros_custo: item.centros_de_custo || null,
            pessoa_id: item.fornecedor?.id || item.cliente?.id || null,
            pessoa_nome: item.fornecedor?.nome || item.cliente?.nome || null,
            conta_financeira_id: item.conta_financeira?.id || null,
            conta_financeira_nome: item.conta_financeira?.nome || null,
            conta_financeira: item.conta_financeira || null,
            metodo_pagamento: item.metodo_pagamento || null,
            conciliado: item.conciliado || false,
            renegociacao: item.renegociacao || null,
            raw_data: item,
            updated_at: new Date().toISOString()
          }
        })

          console.log('[contaazul-sync] Executando upsert de ' + lancamentos.length + ' registros...')
          if (batchIdx === 0) {
            console.log('[contaazul-sync] Primeiro registro:', JSON.stringify(lancamentos[0]))
          }
          
          const { error, data: upsertData } = await supabase
            .from('contaazul_lancamentos')
            .upsert(lancamentos, { onConflict: 'contaazul_id,bar_id' })
            .select('id')

          if (error) {
            console.error('[contaazul-sync] Erro ao inserir lancamentos batch ' + (batchIdx + 1) + ':', JSON.stringify(error))
          } else {
            console.log('[contaazul-sync] Upsert OK batch ' + (batchIdx + 1) + ': ' + (upsertData?.length || lancamentos.length) + ' registros')
            totalCount += lancamentos.length
          }
        }
      }

      pagina++
      
      if (pagina <= totalPaginas) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
  }

  console.log('[contaazul-sync] Total lancamentos sincronizados: ' + totalCount)
  return { count: totalCount, newToken: currentToken !== accessToken ? currentToken : undefined }
}

// ============ SYNC CATEGORIAS ============

async function syncCategorias(
  supabase: SupabaseClient,
  credentials: ApiCredentials,
  accessToken: string,
  barId: number
): Promise<number> {
  
  console.log('[contaazul-sync] Buscando categorias...')

  const result = await fetchCA(
    '/v1/categorias',
    { pagina: '1', tamanho_pagina: '1000', permite_apenas_filhos: 'true' },
    accessToken,
    supabase,
    credentials
  )

  if (!result) {
    console.error('[contaazul-sync] Falha ao buscar categorias')
    return 0
  }

  const itens = result.data.itens || result.data || []
  console.log('[contaazul-sync] Categorias encontradas: ' + itens.length)

  if (itens.length === 0) return 0

  const categorias = itens.map((item: any) => ({
    contaazul_id: item.id,
    bar_id: barId,
    nome: item.nome,
    tipo: item.tipo || null,
    categoria_pai_id: item.id_pai || null,
    apenas_filhos: item.apenas_filhos || false,
    ativo: true,
    updated_at: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('contaazul_categorias')
    .upsert(categorias, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

  if (error) {
    console.error('[contaazul-sync] Erro ao inserir categorias:', error)
    return 0
  }

  return categorias.length
}

// ============ SYNC CENTROS DE CUSTO ============

async function syncCentrosCusto(
  supabase: SupabaseClient,
  credentials: ApiCredentials,
  accessToken: string,
  barId: number
): Promise<number> {
  
  console.log('[contaazul-sync] Buscando centros de custo...')

  const result = await fetchCA(
    '/v1/centro-de-custo',
    { pagina: '1', tamanho_pagina: '1000' },
    accessToken,
    supabase,
    credentials
  )

  if (!result) {
    console.error('[contaazul-sync] Falha ao buscar centros de custo')
    return 0
  }

  const itens = result.data.itens || result.data || []
  console.log('[contaazul-sync] Centros de custo encontrados: ' + itens.length)

  if (itens.length === 0) return 0

  const centros = itens.map((item: any) => ({
    contaazul_id: item.id,
    bar_id: barId,
    codigo: item.codigo || null,
    nome: item.nome,
    ativo: item.ativo !== false,
    updated_at: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('contaazul_centros_custo')
    .upsert(centros, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

  if (error) {
    console.error('[contaazul-sync] Erro ao inserir centros de custo:', error)
    return 0
  }

  return centros.length
}

// ============ SYNC PESSOAS ============

async function syncPessoas(
  supabase: SupabaseClient,
  credentials: ApiCredentials,
  accessToken: string,
  barId: number
): Promise<number> {
  
  let totalCount = 0

  // Buscar fornecedores
  console.log('[contaazul-sync] Buscando fornecedores...')
  const fornecedoresResult = await fetchCA(
    '/v1/fornecedores',
    { page: '1', size: '500' },
    accessToken,
    supabase,
    credentials
  )

  if (fornecedoresResult) {
    const fornecedores = fornecedoresResult.data.content || fornecedoresResult.data.items || fornecedoresResult.data || []
    console.log('[contaazul-sync] Fornecedores encontrados: ' + fornecedores.length)

    if (fornecedores.length > 0) {
      const pessoas = fornecedores.map((item: any) => ({
        contaazul_id: item.id || item.uuid,
        bar_id: barId,
        nome: item.nome || item.name || item.razao_social,
        tipo_pessoa: item.tipo_pessoa || item.person_type || (item.cpf ? 'FISICA' : 'JURIDICA'),
        documento: item.cpf || item.cnpj || item.cpf_cnpj || item.document,
        email: item.email,
        telefone: item.telefone || item.phone || item.celular,
        perfil: 'FORNECEDOR',
        ativo: item.ativo !== false && item.status !== 'INATIVO',
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('contaazul_pessoas')
        .upsert(pessoas, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

      if (error) {
        console.error('[contaazul-sync] Erro ao inserir fornecedores:', error)
      } else {
        totalCount += pessoas.length
      }
    }
  }

  // Buscar clientes
  console.log('[contaazul-sync] Buscando clientes...')
  const clientesResult = await fetchCA(
    '/v1/clientes',
    { page: '1', size: '500' },
    accessToken,
    supabase,
    credentials
  )

  if (clientesResult) {
    const clientes = clientesResult.data.content || clientesResult.data.items || clientesResult.data || []
    console.log('[contaazul-sync] Clientes encontrados: ' + clientes.length)

    if (clientes.length > 0) {
      const pessoas = clientes.map((item: any) => ({
        contaazul_id: item.id || item.uuid,
        bar_id: barId,
        nome: item.nome || item.name || item.razao_social,
        tipo_pessoa: item.tipo_pessoa || item.person_type || (item.cpf ? 'FISICA' : 'JURIDICA'),
        documento: item.cpf || item.cnpj || item.cpf_cnpj || item.document,
        email: item.email,
        telefone: item.telefone || item.phone || item.celular,
        perfil: 'CLIENTE',
        ativo: item.ativo !== false && item.status !== 'INATIVO',
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('contaazul_pessoas')
        .upsert(pessoas, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

      if (error) {
        console.error('[contaazul-sync] Erro ao inserir clientes:', error)
      } else {
        totalCount += pessoas.length
      }
    }
  }

  console.log('[contaazul-sync] Total pessoas sincronizadas: ' + totalCount)
  return totalCount
}

// ============ SYNC CONTAS FINANCEIRAS ============

async function syncContasFinanceiras(
  supabase: SupabaseClient,
  credentials: ApiCredentials,
  accessToken: string,
  barId: number
): Promise<number> {
  
  console.log('[contaazul-sync] Buscando contas financeiras...')

  const result = await fetchCA(
    '/v1/conta-financeira',
    { pagina: '1', tamanho_pagina: '200', apenas_ativo: 'true' },
    accessToken,
    supabase,
    credentials
  )

  if (!result) {
    console.error('[contaazul-sync] Falha ao buscar contas financeiras')
    return 0
  }

  const itens = result.data.itens || result.data || []
  console.log('[contaazul-sync] Contas financeiras encontradas: ' + itens.length)

  if (itens.length === 0) return 0

  const contas = itens.map((item: any) => ({
    contaazul_id: item.id,
    bar_id: barId,
    nome: item.nome,
    tipo: item.tipo || null,
    banco: item.banco || null,
    agencia: item.agencia || null,
    numero: item.numero || null,
    ativo: true,
    conta_padrao: item.conta_padrao || false,
    updated_at: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('contaazul_contas_financeiras')
    .upsert(contas, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

  if (error) {
    console.error('[contaazul-sync] Erro ao inserir contas financeiras:', error)
    return 0
  }

  return contas.length
}

// ============ CREATE LOG ============

async function createSyncLog(
  supabase: SupabaseClient,
  barId: number,
  tipoSincronizacao: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('contaazul_logs_sincronizacao')
    .insert({
      bar_id: barId,
      tipo_sincronizacao: tipoSincronizacao,
      status: 'iniciado',
      data_inicio: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) {
    console.error('[contaazul-sync] Erro ao criar log:', error)
    return null
  }

  return data.id
}

async function updateSyncLog(
  supabase: SupabaseClient,
  logId: number,
  status: string,
  stats: SyncStats,
  startTime: number,
  errorMessage?: string
): Promise<void> {
  const duracao = Math.round((Date.now() - startTime) / 1000)
  const totalRegistros = stats.lancamentos + stats.categorias + stats.centros_custo + stats.pessoas + stats.contas_financeiras

  const { error } = await supabase
    .from('contaazul_logs_sincronizacao')
    .update({
      status,
      total_registros: totalRegistros,
      registros_processados: totalRegistros - stats.erros,
      registros_erro: stats.erros,
      mensagem_erro: errorMessage || null,
      data_fim: new Date().toISOString(),
      duracao_segundos: duracao
    })
    .eq('id', logId)

  if (error) {
    console.error('[contaazul-sync] Erro ao atualizar log:', error)
  }
}

// ============ MAIN HANDLER ============

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req)
  }

  if (req.method !== 'POST') {
    return errorResponse('Metodo nao permitido. Use POST.', req, undefined, 405)
  }

  const supabase = getSupabaseClient()
  let heartbeatId: number | null = null
  let startTime = Date.now()
  let logId: number | null = null
  let barId: number | null = null

  try {
    const body: SyncRequest = await req.json()

    if (!body.bar_id) {
      return errorResponse('bar_id e obrigatorio', req, undefined, 400)
    }

    if (!body.sync_mode) {
      return errorResponse('sync_mode e obrigatorio', req, undefined, 400)
    }

    barId = body.bar_id

    // Heartbeat
    const hb = await heartbeatStart(supabase, 'contaazul-sync', barId, body.sync_mode, 'api')
    heartbeatId = hb.heartbeatId
    startTime = hb.startTime

    // Buscar credentials
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', barId)
      .single()

    if (credError || !credentials) {
      await heartbeatError(supabase, heartbeatId, startTime, 'Credenciais nao encontradas', {}, 'contaazul-sync', barId)
      return errorResponse('Credenciais Conta Azul nao encontradas para bar_id=' + barId, req, undefined, 404)
    }

    if (!credentials.access_token) {
      await heartbeatError(supabase, heartbeatId, startTime, 'Token nao disponivel', {}, 'contaazul-sync', barId)
      return errorResponse('Access token nao disponivel. Reconecte via OAuth.', req, undefined, 401)
    }

    // Verificar expiracao
    let accessToken = credentials.access_token
    if (credentials.expires_at) {
      const expiresAt = new Date(credentials.expires_at)
      if (expiresAt <= new Date()) {
        console.log('[contaazul-sync] Token expirado, renovando...')
        const newToken = await refreshToken(supabase, credentials)
        if (!newToken) {
          await heartbeatError(supabase, heartbeatId, startTime, 'Falha ao renovar token', {}, 'contaazul-sync', barId)
          return errorResponse('Token expirado e falha ao renovar. Reconecte via OAuth.', req, undefined, 401)
        }
        accessToken = newToken
      }
    }

    // Criar log
    logId = await createSyncLog(supabase, barId, body.sync_mode)

    // Calcular datas
    let dateFrom: string
    let dateTo: string
    let useAlteracaoFilter = false

    const now = new Date()

    switch (body.sync_mode) {
      case 'daily_incremental':
        // Buscar últimos 7 dias para capturar lançamentos com competência recente
        // mas vencimento futuro (período amplo garante captura completa)
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        dateFrom = formatDate(sevenDaysAgo)
        dateTo = formatDate(now)
        useAlteracaoFilter = false // Usar data_vencimento com período amplo
        break

      case 'full_month':
        // Buscar mês anterior + mês atual + próximo mês
        // para capturar todos os lançamentos independente do vencimento
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0)
        dateFrom = formatDate(firstDayLastMonth)
        dateTo = formatDate(lastDayNextMonth)
        break

      case 'full_sync':
        // Buscar 2 meses antes até 3 meses depois para captura completa
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 4, 0)
        dateFrom = formatDate(twoMonthsAgo)
        dateTo = formatDate(threeMonthsAhead)
        break

      case 'custom':
        if (!body.date_from || !body.date_to) {
          return errorResponse('date_from e date_to sao obrigatorios para sync_mode=custom', req, undefined, 400)
        }
        dateFrom = body.date_from
        dateTo = body.date_to
        break

      default:
        return errorResponse('sync_mode invalido: ' + body.sync_mode, req, undefined, 400)
    }

    console.log('[contaazul-sync] Iniciando sync ' + body.sync_mode + ' para bar_id=' + barId)
    console.log('[contaazul-sync] Periodo: ' + dateFrom + ' a ' + dateTo)

    const stats: SyncStats = {
      lancamentos: 0,
      categorias: 0,
      centros_custo: 0,
      pessoas: 0,
      contas_financeiras: 0,
      erros: 0
    }

    // Sync auxiliares primeiro (full_sync e daily_incremental)
    if (body.sync_mode === 'full_sync' || body.sync_mode === 'daily_incremental') {
      console.log('[contaazul-sync] Sincronizando dados auxiliares...')
      stats.categorias = await syncCategorias(supabase, credentials, accessToken, barId)
      stats.centros_custo = await syncCentrosCusto(supabase, credentials, accessToken, barId)
      stats.pessoas = await syncPessoas(supabase, credentials, accessToken, barId)
      stats.contas_financeiras = await syncContasFinanceiras(supabase, credentials, accessToken, barId)
      console.log('[contaazul-sync] Dados auxiliares sincronizados')
    }

    // Sync lancamentos
    const lancResult = await syncLancamentos(
      supabase,
      credentials,
      accessToken,
      barId,
      dateFrom,
      dateTo,
      useAlteracaoFilter,
      startTime
    )
    stats.lancamentos = lancResult.count
    
    // Se houve timeout ou limite atingido, registrar no log
    if (lancResult.timedOut) {
      console.warn('[contaazul-sync] ⚠️ Sync interrompido por timeout safety')
    }

    // Atualizar log
    if (logId) {
      await updateSyncLog(supabase, logId, 'success', stats, startTime)
    }

    // Heartbeat sucesso
    const totalRegistros = stats.lancamentos + stats.categorias + stats.centros_custo + stats.pessoas + stats.contas_financeiras
    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, totalRegistros, stats, undefined, 'contaazul-sync', barId)

    console.log('[contaazul-sync] Sync concluido com sucesso')

    return jsonResponse({
      success: true,
      bar_id: barId,
      sync_mode: body.sync_mode,
      period: { from: dateFrom, to: dateTo },
      stats,
      duration_seconds: Math.round((Date.now() - startTime) / 1000)
    }, req)

  } catch (err) {
    console.error('[contaazul-sync] Erro nao tratado:', err)
    
    const errorMessage = err instanceof Error ? err.message : String(err)

    if (logId) {
      await updateSyncLog(supabase, logId, 'error', { lancamentos: 0, categorias: 0, centros_custo: 0, pessoas: 0, contas_financeiras: 0, erros: 1 }, startTime, errorMessage)
    }

    await heartbeatError(supabase, heartbeatId, startTime, errorMessage, {}, 'contaazul-sync', barId)

    return errorResponse('Erro interno', req, err, 500)
  }
})