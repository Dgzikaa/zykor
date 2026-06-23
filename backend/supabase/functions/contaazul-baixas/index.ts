/**
 * @camada bronze
 * @jobName contaazul-baixas
 * @descricao Preenche data_pagamento (data da baixa) dos lancamentos do Conta Azul.
 *
 * O endpoint de LISTA do CA (contas-a-pagar/receber/buscar) NAO retorna a data de
 * pagamento — so vencimento/competencia/status. A data de pagamento real mora na
 * BAIXA (quitacao): GET /v1/financeiro/eventos-financeiros/parcelas/{id}/baixa.
 * Nao existe busca de baixas em lote, entao e 1 chamada por parcela.
 *
 * Esta funcao seleciona parcelas pagas (valor_pago > 0) ainda SEM data_pagamento e
 * busca a baixa de cada uma, gravando data_pagamento no bronze. E naturalmente
 * resumivel (cada run pega as que faltam) e time-boxed. Rodada por cron pra:
 *  - backfill do historico todo, e
 *  - manter atualizado quando lancamentos forem pagos depois.
 * Se ainda nao houver pagamento, fica vazio (sem baixa) — sem problema.
 *
 * Body: { bar_id: number, limit?: number, probe?: boolean }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const handleCorsOptions = (_req: Request) => new Response('ok', { headers: CORS })
const jsonResponse = (data: unknown, _req?: Request, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const errorResponse = (message: string, _req?: Request, _details?: unknown, status = 500) =>
  new Response(JSON.stringify({ success: false, error: message }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com'
const CONTA_AZUL_AUTH_URL = 'https://auth.contaazul.com'
const REQUEST_TIMEOUT_MS = 20000
const SAFE_TIMEOUT_MS = 350000 // para antes do limite de 400s do Supabase
const DELAY_MS = 120 // gentileza com o rate limit do CA
const DEFAULT_LIMIT = 1500

interface ApiCredentials {
  id: number
  bar_id: number
  client_id: string
  client_secret: string
  access_token: string | null
  refresh_token: string | null
}

function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes')
  return createClient(url, key)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function refreshToken(supabase: SupabaseClient, c: ApiCredentials): Promise<string | null> {
  if (!c.refresh_token) return null
  const basic = btoa(c.client_id + ':' + c.client_secret)
  try {
    const resp = await fetch(CONTA_AZUL_AUTH_URL + '/oauth2/token', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: c.refresh_token, grant_type: 'refresh_token' }).toString(),
    })
    if (!resp.ok) { console.error('[baixas] refresh falhou', resp.status, await resp.text()); return null }
    const t = await resp.json()
    const expiresAt = new Date(); expiresAt.setSeconds(expiresAt.getSeconds() + (t.expires_in || 3600))
    await supabase.from('api_credentials').update({
      access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: expiresAt.toISOString(), atualizado_em: new Date().toISOString(),
    }).eq('id', c.id)
    return t.access_token
  } catch (e) { console.error('[baixas] excecao refresh', e); return null }
}

/** GET na API CA com retry de 401 (refresh) e 429 (backoff). Retorna {data, token}. */
async function caGet(
  path: string, token: string, supabase: SupabaseClient, c: ApiCredentials, retry = 0,
): Promise<{ data: any; status: number; token: string }> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await fetch(CONTA_AZUL_API_URL + path, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(tid)
    if (resp.status === 401 && retry < 1) {
      const nt = await refreshToken(supabase, c)
      if (nt) return caGet(path, nt, supabase, c, retry + 1)
      return { data: null, status: 401, token }
    }
    if (resp.status === 429 && retry < 3) {
      await sleep(2000 * (retry + 1))
      return caGet(path, token, supabase, c, retry + 1)
    }
    if (resp.status === 404) return { data: null, status: 404, token } // parcela sem baixa
    if (!resp.ok) { console.error('[baixas] erro', resp.status, (await resp.text()).slice(0, 200)); return { data: null, status: resp.status, token } }
    return { data: await resp.json(), status: 200, token }
  } catch (e) {
    clearTimeout(tid)
    console.error('[baixas] excecao GET', (e as Error).name)
    return { data: null, status: 0, token }
  }
}

/** Extrai a maior data_pagamento das baixas (lida com varios formatos de resposta). */
function extrairDataPagamento(resp: any): string | null {
  if (!resp) return null
  let itens: any[]
  if (Array.isArray(resp)) itens = resp
  else if (Array.isArray(resp.itens)) itens = resp.itens
  else if (Array.isArray(resp.baixas)) itens = resp.baixas
  else if (Array.isArray(resp.data)) itens = resp.data
  else itens = [resp]
  const datas = itens
    .map(it => it?.data_pagamento || it?.data || it?.data_baixa || it?.data_liquidacao || null)
    .filter((d): d is string => typeof d === 'string' && d.length >= 10)
    .map(d => d.slice(0, 10))
  if (datas.length === 0) return null
  return datas.sort().at(-1) || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req)
  const t0 = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const barId = Number(body.bar_id)
    const limit = Math.min(Number(body.limit) || DEFAULT_LIMIT, 5000)
    const probe = !!body.probe
    if (!barId) return errorResponse('bar_id obrigatorio', req, undefined, 400)

    const supabase = getSupabaseClient()

    const { data: cred, error: credErr } = await supabase
      .from('api_credentials')
      .select('id, bar_id, client_id, client_secret, access_token, refresh_token')
      .eq('bar_id', barId).eq('sistema', 'conta_azul').maybeSingle()
    if (credErr || !cred) return errorResponse('credencial Conta Azul nao encontrada para bar ' + barId, req, undefined, 404)
    const credentials = cred as ApiCredentials

    let token = credentials.access_token || (await refreshToken(supabase, credentials)) || ''
    if (!token) return errorResponse('sem token Conta Azul', req, undefined, 401)

    // modo 'data_pagamento' (default): só parcelas SEM data_pagamento (backfill da data).
    // modo 'baixas': TODAS as parcelas pagas (pra gravar as baixas c/ id_reconciliacao no DFC).
    const modo = body.modo === 'baixas' ? 'baixas' : 'data_pagamento'
    let sel = supabase
      .schema('bronze').from('bronze_contaazul_lancamentos')
      .select('contaazul_id, data_competencia')
      .eq('bar_id', barId).is('excluido_em', null).gt('valor_pago', 0)
    if (modo === 'data_pagamento') sel = sel.is('data_pagamento', null)
    if (modo === 'baixas') sel = sel.is('baixas_synced_em', null)
    if (body.data_de) sel = sel.gte('data_competencia', body.data_de)
    if (body.data_ate) sel = sel.lte('data_competencia', body.data_ate)
    const { data: rows, error: selErr } = await sel
      .order('data_competencia', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (selErr) return errorResponse('erro ao selecionar parcelas: ' + selErr.message, req, undefined, 500)

    const total = rows?.length || 0
    let atualizados = 0, semBaixa = 0, erros = 0, processados = 0, baixasGravadas = 0

    for (const row of rows || []) {
      if (Date.now() - t0 > SAFE_TIMEOUT_MS) { console.warn('[baixas] timeout, parando'); break }
      processados++
      const path = '/v1/financeiro/eventos-financeiros/parcelas/' + row.contaazul_id + '/baixa'
      const { data, status, token: nt } = await caGet(path, token, supabase, credentials)
      token = nt
      if (probe && processados <= 2) console.log('[baixas][probe] resp:', JSON.stringify(data)?.slice(0, 800))
      if (status === 0 || (status >= 500)) { erros++; continue }

      // Grava cada baixa (com id_reconciliacao) — fonte da conciliação REAL do DFC.
      // IMPORTANTE: tratar os MESMOS formatos que extrairDataPagamento (array, .itens,
      // .baixas, .data e objeto único). Antes só tratava array/.itens → quando o CA
      // devolvia a baixa como objeto único ou {baixas:[...]}, pegava a data mas NÃO
      // gravava a baixa (parcela paga ficava fora do DFC). Bug do furo da DFC.
      const arr: any[] = Array.isArray(data) ? data
        : Array.isArray(data?.itens) ? data.itens
        : Array.isArray(data?.baixas) ? data.baixas
        : Array.isArray(data?.data) ? data.data
        : (data && typeof data === 'object' && data.id) ? [data]
        : []
      const recs = arr.filter((bx: any) => bx?.id).map((bx: any) => ({
        baixa_id: bx.id, bar_id: barId, id_parcela: bx.id_parcela || row.contaazul_id,
        data_pagamento: (bx.data_pagamento || '').slice(0, 10) || null,
        valor_liquido: bx.valor_composicao?.valor_liquido ?? null,
        conta_financeira: bx.conta_financeira?.id || null,
        banco: bx.conta_financeira?.banco || null,
        id_reconciliacao: bx.id_reconciliacao || null,
        conciliada: !!bx.id_reconciliacao,
        metodo_pagamento: bx.metodo_pagamento || null,
        origem: bx.origem || null,
        tipo_evento: bx.tipo_evento_financeiro || null,
        synced_at: new Date().toISOString(),
      }))
      if (recs.length) {
        const { error: bErr } = await supabase.schema('bronze').from('bronze_contaazul_baixas')
          .upsert(recs, { onConflict: 'baixa_id' })
        if (bErr) console.error('[baixas] upsert baixas', bErr.message); else baixasGravadas += recs.length
      }

      const dataPag = extrairDataPagamento(data)
      if (dataPag) {
        const { error: upErr } = await supabase
          .schema('bronze').from('bronze_contaazul_lancamentos')
          .update({ data_pagamento: dataPag })
          .eq('bar_id', barId).eq('contaazul_id', row.contaazul_id)
        if (upErr) { erros++; } else { atualizados++ }
      } else {
        semBaixa++
      }
      if (modo === 'baixas') {
        await supabase.schema('bronze').from('bronze_contaazul_lancamentos')
          .update({ baixas_synced_em: new Date().toISOString() })
          .eq('bar_id', barId).eq('contaazul_id', row.contaazul_id)
      }
      await sleep(DELAY_MS)
    }

    const restantes = total - processados
    const stats = { bar_id: barId, modo, total_fila: total, processados, atualizados, baixas_gravadas: baixasGravadas, sem_baixa: semBaixa, erros, restantes_neste_lote: restantes, ms: Date.now() - t0 }
    console.log('[baixas] fim', JSON.stringify(stats))
    return jsonResponse({ success: true, stats }, req)
  } catch (e) {
    console.error('[baixas] fatal', e)
    return errorResponse((e as Error).message || 'erro interno', req, undefined, 500)
  }
})
