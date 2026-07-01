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
const PAGE_SIZE = 500
const SAFE_TIMEOUT_MS = 360000 // 360s (40s antes do limite de 400s do Supabase Pro)
const MAX_RECORDS_PER_SYNC = 10000 // Limitar registros por execução (aumentado para capturar todos)

interface SyncRequest {
  bar_id: number
  sync_mode: 'daily_incremental' | 'full_month' | 'full_sync' | 'custom'
    | 'alteracao_incremental' | 'alteracao_full_ano'
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
): Promise<{ count: number; newToken?: string; timedOut?: boolean; erros: number }> {

  let totalCount = 0
  let erros = 0
  let currentToken = accessToken

  const tipos = [
    { endpoint: '/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar', tipo: 'DESPESA' },
    { endpoint: '/v1/financeiro/eventos-financeiros/contas-a-receber/buscar', tipo: 'RECEITA' }
  ]

  for (const { endpoint, tipo } of tipos) {
    let pagina = 1
    let totalPaginas = 1
    // Coleta de IDs vindos da API neste run (pra detectar exclusões)
    const idsVindosApi: string[] = []
    let rangeVencDe = ''
    let rangeVencAte = ''
    let percorreuTudo = false

    console.log('[contaazul-sync] Buscando ' + tipo + '...')

    while (pagina <= totalPaginas) {
      // Verificar timeout safety
      if (Date.now() - functionStartTime > SAFE_TIMEOUT_MS) {
        console.warn('[contaazul-sync] ⚠️ Approaching timeout, saving progress and stopping')
        return { count: totalCount, newToken: currentToken !== accessToken ? currentToken : undefined, timedOut: true, erros }
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
        // API CA EXIGE data_vencimento_de sempre. Combinamos venc range muito
        // amplo (-5y/+5y) + filtro data_alteracao pra pegar so o que mudou.
        params.data_alteracao_de = dateFrom + 'T00:00:00'
        params.data_alteracao_ate = dateTo + 'T23:59:59'
        const vencDe = new Date(); vencDe.setFullYear(vencDe.getFullYear() - 5)
        const vencAte = new Date(); vencAte.setFullYear(vencAte.getFullYear() + 5)
        params.data_vencimento_de = vencDe.toISOString().split('T')[0]
        params.data_vencimento_ate = vencAte.toISOString().split('T')[0]
        rangeVencDe = params.data_vencimento_de
        rangeVencAte = params.data_vencimento_ate
      } else {
        // API do Conta Azul exige data_vencimento (não aceita data_competencia como filtro)
        // Buscar período AMPLO (-12/+12 meses) pra capturar lançamentos com competência
        // no período pedido mas com vencimento muito anterior/posterior.
        // Caso real (2026-05-28): salário Edson Albino comp 15/04/26 tinha venc 10/10/25.
        // Janela antiga -1/+2 deixava esses casos de fora. Depois filtramos por
        // data_competencia no banco, então o range amplo é só pra a API retornar.
        const fromDate = new Date(dateFrom)
        fromDate.setMonth(fromDate.getMonth() - 12)
        const toDate = new Date(dateTo)
        toDate.setMonth(toDate.getMonth() + 12)
        
        params.data_vencimento_de = fromDate.toISOString().split('T')[0]
        params.data_vencimento_ate = toDate.toISOString().split('T')[0]
        // Guarda o range efetivo pra detectar exclusões depois
        rangeVencDe = params.data_vencimento_de
        rangeVencAte = params.data_vencimento_ate
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

      // Acumula os IDs vindos da API pra detecção de exclusões
      for (const it of itens) {
        if (it && it.id) idsVindosApi.push(it.id)
      }

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
            // NAO setar data_pagamento aqui: o endpoint de lista do CA nao retorna a
            // data de pagamento (vem sempre null) e sobrescreveria o valor preenchido
            // pela funcao contaazul-baixas (GET .../parcelas/{id}/baixa). Ver
            // memory project_contaazul_data_pagamento_baixa.
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
            // NAO gravar conciliado aqui: o endpoint de lista nao traz conciliacao real
            // (vem sempre false) e sobrescreveria o que a fn contaazul-conciliacao preenche.
            // Protegido tambem pela trigger bronze.fn_preserva_conciliado.
            renegociacao: item.renegociacao || null,
            raw_data: item,
            // Bronze tem synced_at em vez de updated_at
            synced_at: new Date().toISOString()
          }
        })

          console.log('[contaazul-sync] Executando upsert de ' + lancamentos.length + ' registros...')
          if (batchIdx === 0) {
            console.log('[contaazul-sync] Primeiro registro:', JSON.stringify(lancamentos[0]))
          }

          // Escreve direto em bronze (medallion clássico). Antes escrevia em integrations
          // e havia uma cópia separada (sync_contaazul_integrations_to_bronze) que ficou redundante.
          const { error, data: upsertData } = await supabase
            .schema('bronze')
            .from('bronze_contaazul_lancamentos')
            .upsert(lancamentos, { onConflict: 'contaazul_id,bar_id' })
            .select('contaazul_id')

          if (error) {
            console.error('[contaazul-sync] Erro ao inserir lancamentos batch ' + (batchIdx + 1) + ':', JSON.stringify(error))
            erros++
          } else {
            console.log('[contaazul-sync] Upsert OK batch ' + (batchIdx + 1) + ': ' + (upsertData?.length || lancamentos.length) + ' registros')
            totalCount += lancamentos.length
          }
        }
      }

      pagina++

      // Marca como percorrido completamente quando passou da última página
      if (pagina > totalPaginas) {
        percorreuTudo = true
      }

      if (pagina <= totalPaginas) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // ===== SOFT-DELETE: marca como excluído quem sumiu do CA =====
    // Só roda se: (1) sync sem filtro de data_alteracao (full_month/custom — full sweep do range),
    // (2) percorreu todas as páginas, (3) tem range definido. Daily_incremental NÃO entra aqui
    // porque ele só traz alterados nos últimos 2 dias — não dá pra inferir exclusões assim.
    if (!useAlteracaoFilter && percorreuTudo && rangeVencDe && rangeVencAte) {
      try {
        // Usa RPC: array de UUIDs vai no body (sem limite de URL). Antes a gente usava
        // `.not('contaazul_id', 'in', '(...)')` mas com 6k+ IDs a URL ficava >250KB e o
        // PostgREST falhava silenciosamente sem erro.
        const { data: softDelCount, error: softDelErr } = await supabase
          .rpc('marcar_excluidos_contaazul', {
            p_bar_id: barId,
            p_tipo: tipo,
            p_data_venc_de: rangeVencDe,
            p_data_venc_ate: rangeVencAte,
            p_ids_vindos: idsVindosApi
          })

        if (softDelErr) {
          console.error('[contaazul-sync] Erro ao marcar excluídos ' + tipo + ':', softDelErr.message)
        } else {
          console.log('[contaazul-sync] Soft-delete ' + tipo + ': ' + (softDelCount || 0) + ' lançamentos marcados como excluídos no range ' + rangeVencDe + ' a ' + rangeVencAte)
        }
      } catch (sdErr) {
        console.error('[contaazul-sync] Exceção no soft-delete ' + tipo + ':', sdErr)
      }
    }
  }

  console.log('[contaazul-sync] Total lancamentos sincronizados: ' + totalCount + ' (erros de batch: ' + erros + ')')
  return { count: totalCount, newToken: currentToken !== accessToken ? currentToken : undefined, erros }
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
    // Campo correto do CA é `categoria_pai` (UUID), não `id_pai` (inexistente) — por
    // isso a hierarquia vinha toda null. O pai habilita herança de grupo na Central de
    // Categorias (filho novo herda o grupo do pai). Os nós-pai NÃO são expostos pela
    // API (404 no GET), só referenciados aqui pelo UUID.
    categoria_pai_id: item.categoria_pai || null,
    apenas_filhos: item.apenas_filhos || false,
    entrada_dre: item.entrada_dre || null,
    considera_custo_dre: item.considera_custo_dre ?? null,
    ativo: true,
    // BUG ate 2026-06: gravava 'updated_at' (coluna inexistente) -> upsert dava
    // erro silencioso (console.error + return 0) e o cadastro nunca atualizava.
    // A coluna correta e' synced_at.
    synced_at: new Date().toISOString()
  }))

  const { error } = await supabase
    .schema('bronze')
    .from('bronze_contaazul_categorias')
    .upsert(categorias, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

  if (error) {
    console.error('[contaazul-sync] Erro ao inserir categorias:', error)
    return 0
  }

  // Central de Categorias: expande o mapeamento pai->filhos na DRE, pra categoria nova
  // (criada sob um pai já mapeado) entrar automática no grupo certo. Best-effort.
  try {
    await supabase.schema('meta').rpc('aplicar_grupos_dre', { p_bar: barId })
  } catch (e) {
    console.error('[contaazul-sync] aplicar_grupos_dre falhou:', e)
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
    .schema('bronze')
    .from('bronze_contaazul_centros_custo')
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

  // CA API v2: lista TODAS as pessoas em /v1/pessoas (com perfis no array `perfis`).
  // Os endpoints antigos /v1/fornecedores e /v1/clientes NAO existem mais na v2 (404),
  // o que deixava o sync de pessoas vazio (fornecedor cadastrado no CA nao aparecia no Zykor).
  const TIPOS_VALIDOS = ['Física', 'Jurídica', 'Estrangeira']
  let pagina = 1
  const TAM = 500
  let token = accessToken
  while (true) {
    console.log('[contaazul-sync] Buscando pessoas (pagina ' + pagina + ')...')
    const result = await fetchCA(
      '/v1/pessoas',
      { pagina: String(pagina), tamanho_pagina: String(TAM) },
      token,
      supabase,
      credentials
    )
    if (!result) {
      console.error('[contaazul-sync] /v1/pessoas retornou null na pagina ' + pagina)
      break
    }
    if (result.newToken) token = result.newToken

    const items = result.data.items || result.data.content || []
    const totalItems = typeof result.data.totalItems === 'number' ? result.data.totalItems : null
    console.log('[contaazul-sync] Pessoas na pagina: ' + items.length + (totalItems !== null ? ' / total ' + totalItems : ''))
    if (items.length === 0) break

    const mapped = items
      .map((item: any) => {
        const perfis = Array.isArray(item.perfis) ? item.perfis.map((p: any) => String(p).toUpperCase()) : []
        const perfil = perfis.includes('FORNECEDOR')
          ? 'FORNECEDOR'
          : perfis.includes('CLIENTE')
            ? 'CLIENTE'
            : (perfis[0] || 'FORNECEDOR')
        const doc = String(item.documento || '').replace(/\D/g, '')
        return {
          contaazul_id: item.id || item.uuid,
          bar_id: barId,
          nome: item.nome || item.name || 'SEM NOME',
          // tipo_pessoa fica null: o CHECK constraint da tabela está mal-encodado
          // (FÃ­sica) e o valor correto do CA (Física) viola. Não é usado no match.
          tipo_pessoa: null,
          documento: doc.length ? doc : null,
          email: item.email || null,
          telefone: item.telefone || null,
          perfil,
          ativo: item.ativo !== false,
          sincronizado_em: new Date().toISOString()
        }
      })
      .filter((p: any) => p.contaazul_id)

    // Dedupe por contaazul_id (upsert em lote falha com id repetido na mesma página)
    const porId = new Map<string, any>()
    for (const p of mapped) porId.set(p.contaazul_id, p)
    const pessoas = Array.from(porId.values())

    const { error } = await supabase
      .schema('bronze')
      .from('bronze_contaazul_pessoas')
      .upsert(pessoas, { onConflict: 'contaazul_id,bar_id', ignoreDuplicates: false })

    if (error) {
      console.error('[contaazul-sync] Erro upsert pessoas (pagina ' + pagina + '):', error.message || error)
      break
    }
    totalCount += pessoas.length

    if (totalItems !== null && totalCount >= totalItems) break
    if (items.length < TAM) break
    pagina += 1
    if (pagina > 100) break // safety cap
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
    .schema('bronze')
    .from('bronze_contaazul_contas_financeiras')
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
    .schema('integrations')
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
    .schema('integrations')
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

      // SYNC ROBUSTO via data_alteracao (resolve o bug de back-date).
      // API do CA aceita filtro por alteracao — pega TUDO que foi criado/editado
      // no CA na janela, independente de venc ou comp. Usado pelo cron de 1h.
      case 'alteracao_incremental': {
        // Le cursor do state (com overlap de 1h pra evitar perder edges)
        const { data: state } = await supabase
          .schema('bronze' as never)
          .from('contaazul_sync_state')
          .select('ultima_data_alteracao')
          .eq('bar_id', barId)
          .maybeSingle()
        const cursorISO = (state as any)?.ultima_data_alteracao
          || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
        const cursor = new Date(cursorISO)
        cursor.setHours(cursor.getHours() - 1) // overlap 1h
        // Piso de 7 dias: re-varre só a última semana de alterações como margem de
        // segurança do cursor. Back-dates mais antigos (edição hoje de algo de 1-2 meses
        // atrás) são cobertos pelo cron 'alteracao_full_ano' 2x/dia (jobid 529, varre 1 ano).
        // ANTES era 90 dias re-varridos a cada 6 min (orquestrador) = ~17k linhas re-upsertadas
        // por run, o maior custo do banco. 90d→7d corta ~92% dessa escrita sem perder back-dates.
        // Reavaliar a janela mais pra frente se aparecer gap de re-categorização.
        const pisoAlteracao = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateFrom = formatDate(cursor < pisoAlteracao ? cursor : pisoAlteracao)
        dateTo = formatDate(now)
        useAlteracaoFilter = true
        break
      }

      // Reconciliacao semanal: pega 1 ano de alteracoes pra fechar gaps eventuais
      case 'alteracao_full_ano': {
        const umAnoAtras = new Date(now)
        umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
        dateFrom = formatDate(umAnoAtras)
        dateTo = formatDate(now)
        useAlteracaoFilter = true
        break
      }

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

    // O sync incremental (cron horario / botao global) tambem refresca o cadastro
    // de CATEGORIAS — sao poucas e mudam quando o socio cria/edita no CA. Mantem o
    // de-para da DRE e o cadastro espelhando o CA sem depender de full_sync manual.
    if (body.sync_mode === 'alteracao_incremental') {
      stats.categorias = await syncCategorias(supabase, credentials, accessToken, barId)
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
    stats.erros += lancResult.erros || 0

    // Se houve timeout ou limite atingido, registrar no log
    if (lancResult.timedOut) {
      console.warn('[contaazul-sync] ⚠️ Sync interrompido por timeout safety')
    }

    // Status: 'partial' se algum batch falhou ou houve timeout — dispara alerta no
    // heartbeat (antes reportava 'success' mesmo perdendo lançamentos silenciosamente).
    const syncStatus = (stats.erros > 0 || lancResult.timedOut) ? 'partial' : 'success'

    // Atualizar log
    if (logId) {
      await updateSyncLog(supabase, logId, syncStatus, stats, startTime)
    }

    // Atualiza cursor do state quando modo alteracao (sem timeout)
    if ((body.sync_mode === 'alteracao_incremental' || body.sync_mode === 'alteracao_full_ano')
        && !lancResult.timedOut) {
      try {
        await supabase
          .schema('bronze' as never)
          .from('contaazul_sync_state')
          .upsert({
            bar_id: barId,
            ultima_data_alteracao: now.toISOString(),
            ultima_sync_em: new Date().toISOString(),
          } as never, { onConflict: 'bar_id', ignoreDuplicates: false } as never)
      } catch (err) {
        console.warn('[contaazul-sync] Erro ao gravar sync_state:', err)
      }
    }

    // MEDALLION: refresh gold.orcamento_realizado_mensal pro periodo sincronizado.
    // Sem isso, /estrategico/orcamentacao nao reflete lancamentos novos ate o cron
    // diario rodar (06:30 UTC). Erro nao falha o sync — gold sera refrescado pelo cron.
    try {
      const { data: refreshResult, error: refreshError } = await supabase.rpc(
        'refresh_orcamento_gold',
        { p_bar_id: barId, p_data_inicio: dateFrom, p_data_fim: dateTo }
      )
      if (refreshError) {
        console.warn('[contaazul-sync] Erro ao refresh gold orcamentacao:', refreshError.message)
      } else {
        console.log('[contaazul-sync] Gold refresh OK:', JSON.stringify(refreshResult))
      }
    } catch (err) {
      console.warn('[contaazul-sync] Excecao no refresh gold:', err)
    }

    // Heartbeat: success só se não houve erro/timeout (senão 'partial', que alerta)
    const totalRegistros = stats.lancamentos + stats.categorias + stats.centros_custo + stats.pessoas + stats.contas_financeiras
    await heartbeatEnd(supabase, heartbeatId, syncStatus, startTime, totalRegistros, stats, undefined, 'contaazul-sync', barId)

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