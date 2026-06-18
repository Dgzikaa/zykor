/**
 * @camada bronze
 * @jobName contaazul-orquestrador
 * @descricao Orquestra o pipeline do Conta Azul EM FILA (1 etapa por vez), pra respeitar
 * o rate-limit POR CONTA do CA (10/seg, 600/min) — nunca duas funcoes martelando junto.
 *
 * Ordem: (1) lancamentos incremental (contaazul-sync alteracao_incremental, que tambem
 * refresca categorias/de-para) -> (2) enriquecimento por parcela (contaazul-conciliacao:
 * data de pagamento + conciliado numa chamada). Lock via public.contaazul_orq_estado.
 * Roda por cron pros bars 3 e 4 (contas distintas, em paralelo). Substitui os crons
 * soltos alteracao-1h, baixas-10min e conciliacao-backfill.
 *
 * Body: { bar_id?: number }  (default 3)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOCK_STALE_MIN = 12

async function callFn(name: string, body: unknown): Promise<{ status: number; body: any }> {
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/' + name, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SRK, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    return { status: r.status, body: j }
  } catch (e) { return { status: 0, body: { erro: (e as Error).message } } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const t0 = Date.now()
  const supabase = createClient(SUPABASE_URL, SRK)
  let barId = 3
  try {
    const body = await req.json().catch(() => ({}))
    barId = Number(body?.bar_id) || 3

    const { data: est } = await supabase.from('contaazul_orq_estado').select('*').eq('bar_id', barId).maybeSingle()
    if (est?.running && est.started_at && (Date.now() - new Date(est.started_at).getTime()) < LOCK_STALE_MIN * 60000) {
      return json({ skipped: 'orquestrador ja rodando', desde: est.started_at })
    }
    await supabase.from('contaazul_orq_estado').update({ running: true, started_at: new Date().toISOString(), finished_at: null }).eq('bar_id', barId)

    const passos: Record<string, any> = {}
    try {
      const s1 = await callFn('contaazul-sync', { bar_id: barId, sync_mode: 'alteracao_incremental' })
      passos.lancamentos = { status: s1.status, ok: s1.status === 200, resumo: s1.body?.stats || s1.body?.summary || null }

      const s2 = await callFn('contaazul-conciliacao', { bar_id: barId, limit: 400 })
      passos.enriquecimento = { status: s2.status, ok: s2.status === 200, resumo: s2.body?.stats || null }
    } finally {
      await supabase.from('contaazul_orq_estado').update({ running: false, finished_at: new Date().toISOString(), ultimo: { ms: Date.now() - t0, passos } }).eq('bar_id', barId)
    }

    console.log('[orq] fim', JSON.stringify({ barId, ms: Date.now() - t0, passos }))
    return json({ success: true, bar_id: barId, ms: Date.now() - t0, passos })
  } catch (e) {
    await supabase.from('contaazul_orq_estado').update({ running: false, finished_at: new Date().toISOString() }).eq('bar_id', barId).then(() => {}, () => {})
    return json({ success: false, erro: (e as Error).message }, 500)
  }
})
