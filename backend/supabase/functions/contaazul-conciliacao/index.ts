/**
 * @camada bronze
 * @jobName contaazul-conciliacao
 * @descricao Enriquecimento por parcela do Conta Azul: grava DATA DE PAGAMENTO + CONCILIADO
 * numa unica chamada GET /v1/financeiro/eventos-financeiros/parcelas/{id} (que traz baixas[]
 * + conciliado + conta_financeira). Unifica o que antes eram 2 funcoes (baixas + conciliacao).
 *
 * Auto-corrige: so grava em status 200 (em erro/429 pula e re-tenta; conciliado_checado_em
 * fica NULL). Processa nunca-checados primeiro, e entre eles os sem data_pagamento / mais
 * recentes antes. Time-boxed, pace 130ms (~7,6/seg, dentro do teto por conta). So sobrescreve
 * data_pagamento se achar baixa (nao zera o que existe). Chamada pelo contaazul-orquestrador.
 *
 * Body: { bar_id, limit?, data_pgto_de?, probe?, parcela_id? }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const handleCorsOptions = (_req: Request) => new Response('ok', { headers: CORS })
const jsonResponse = (data: unknown, _req?: Request, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const errorResponse = (message: string, _req?: Request, _d?: unknown, status = 500) => new Response(JSON.stringify({ success: false, error: message }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com'
const CONTA_AZUL_AUTH_URL = 'https://auth.contaazul.com'
const REQUEST_TIMEOUT_MS = 20000
const SAFE_TIMEOUT_MS = 350000
const DELAY_MS = 130

interface ApiCredentials { id: number; bar_id: number; client_id: string; client_secret: string; access_token: string | null; refresh_token: string | null }

function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes')
  return createClient(url, key)
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function extrairDataPagamento(data: any): string | null {
  const bs = Array.isArray(data?.baixas) ? data.baixas : []
  const ds = bs.map((b: any) => b?.data_baixa || b?.data_pagamento || b?.data || b?.data_liquidacao)
    .filter((d: any) => typeof d === 'string' && d.length >= 10).map((d: string) => d.slice(0, 10))
  return ds.length ? ds.sort().at(-1) : null
}

async function refreshToken(supabase: SupabaseClient, c: ApiCredentials): Promise<string | null> {
  if (!c.refresh_token) return null
  const basic = btoa(c.client_id + ':' + c.client_secret)
  try {
    const resp = await fetch(CONTA_AZUL_AUTH_URL + '/oauth2/token', { method: 'POST', headers: { 'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: c.refresh_token, grant_type: 'refresh_token' }).toString() })
    if (!resp.ok) { console.error('[concil] refresh falhou', resp.status); return null }
    const t = await resp.json()
    const expiresAt = new Date(); expiresAt.setSeconds(expiresAt.getSeconds() + (t.expires_in || 3600))
    await supabase.from('api_credentials').update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: expiresAt.toISOString(), atualizado_em: new Date().toISOString() }).eq('id', c.id)
    return t.access_token
  } catch (e) { console.error('[concil] excecao refresh', e); return null }
}

async function caGet(path: string, token: string, supabase: SupabaseClient, c: ApiCredentials, retry = 0): Promise<{ data: any; status: number; token: string }> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await fetch(CONTA_AZUL_API_URL + path, { method: 'GET', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, signal: controller.signal })
    clearTimeout(tid)
    if (resp.status === 401 && retry < 1) { const nt = await refreshToken(supabase, c); if (nt) return caGet(path, nt, supabase, c, retry + 1); return { data: null, status: 401, token } }
    if (resp.status === 429 && retry < 3) { await sleep(1000 * (retry + 1)); return caGet(path, token, supabase, c, retry + 1) }
    const data = resp.ok ? await resp.json() : null
    return { data, status: resp.status, token }
  } catch (_e) { clearTimeout(tid); return { data: null, status: 0, token } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req)
  const t0 = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const barId = Number(body.bar_id)
    const probe = !!body.probe
    const limit = Math.min(Number(body.limit) || 1500, 6000)
    if (!barId) return errorResponse('bar_id obrigatorio', req, undefined, 400)

    const supabase = getSupabaseClient()
    const { data: cred, error: credErr } = await supabase.from('api_credentials').select('id, bar_id, client_id, client_secret, access_token, refresh_token').eq('bar_id', barId).eq('sistema', 'conta_azul').maybeSingle()
    if (credErr || !cred) return errorResponse('credencial Conta Azul nao encontrada para bar ' + barId, req, undefined, 404)
    const credentials = cred as ApiCredentials
    let token = credentials.access_token || (await refreshToken(supabase, credentials)) || ''
    if (!token) return errorResponse('sem token Conta Azul', req, undefined, 401)

    if (probe && body.parcela_id) {
      const { data, status } = await caGet('/v1/financeiro/eventos-financeiros/parcelas/' + body.parcela_id, token, supabase, credentials)
      return jsonResponse({ success: true, probe: 'por_id', status, conciliado: data?.conciliado, parcela_status: data?.status, data_pagamento: extrairDataPagamento(data), banco: data?.conta_financeira?.banco }, req)
    }

    // Parcelas PAGAS (valor_pago>0): nunca-checadas primeiro; entre elas, sem data_pagamento e mais recentes antes.
    let q = supabase.schema('bronze').from('bronze_contaazul_lancamentos').select('contaazul_id, data_pagamento').eq('bar_id', barId).is('excluido_em', null).gt('valor_pago', 0)
    if (body.data_pgto_de) q = q.gte('data_pagamento', body.data_pgto_de)
    const { data: rows, error: selErr } = await q.order('conciliado_checado_em', { ascending: true, nullsFirst: true }).order('data_pagamento', { ascending: false, nullsFirst: true }).limit(limit)
    if (selErr) return errorResponse('erro ao selecionar: ' + selErr.message, req, undefined, 500)

    let conc = 0, naoConc = 0, pag = 0, erros = 0, proc = 0
    for (const row of rows || []) {
      if (Date.now() - t0 > SAFE_TIMEOUT_MS) break
      proc++
      const { data, status, token: nt } = await caGet('/v1/financeiro/eventos-financeiros/parcelas/' + row.contaazul_id, token, supabase, credentials)
      token = nt
      if (status !== 200 || !data) { erros++; await sleep(DELAY_MS); continue }
      const c = data.conciliado === true
      const upd: Record<string, unknown> = { conciliado: c, conciliado_checado_em: new Date().toISOString() }
      const dPag = extrairDataPagamento(data)
      if (dPag && dPag !== row.data_pagamento) { upd.data_pagamento = dPag; pag++ }
      const { error: upErr } = await supabase.schema('bronze').from('bronze_contaazul_lancamentos').update(upd).eq('bar_id', barId).eq('contaazul_id', row.contaazul_id)
      if (upErr) erros++; else if (c) conc++; else naoConc++
      await sleep(DELAY_MS)
    }
    const stats = { bar_id: barId, processados: proc, conciliados: conc, nao_conciliados: naoConc, data_pagamento_set: pag, erros, total_fila: rows?.length || 0, ms: Date.now() - t0 }
    console.log('[concil] fim', JSON.stringify(stats))
    return jsonResponse({ success: true, stats }, req)
  } catch (e) {
    console.error('[concil] fatal', e)
    return errorResponse((e as Error).message || 'erro interno', req, undefined, 500)
  }
})
