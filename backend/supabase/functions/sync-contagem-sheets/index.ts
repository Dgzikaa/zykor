import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

/**
 * 📦 SYNC-CONTAGEM-SHEETS (v4 — medallion jun/2026)
 *
 * MEDALLION:
 *   Planilha (aba INSUMOS)
 *     └─ aqui: parseia o GRID e grava as linhas CRUAS (tidy) em
 *        public.bronze_contagem_sheet (bar, data, código, nome, fechado, flutuante)
 *          └─ operations.fn_refresh_contagem_estoque (SQL): tipa + deriva tipo_contagem
 *             + casa no cadastro (código→nome) + calcula final ─►
 *             operations.contagem_estoque_insumos  ← a tela lê daqui
 *
 * Esta função NÃO enriquece mais (isso é SQL). Só landa o bronze e dispara o refresh.
 * Assim o cru fica guardado e dá pra reprocessar sem reler a planilha.
 *
 * Parser mapeia colunas pelo CABEÇALHO (linha 6): a data fica na coluna
 * "ESTOQUE FECHADO" e o "ESTOQUE FLUTUANTE" é a coluna seguinte. NÃO usa offset fixo.
 *
 * Query: ?bar_id=3|4 (default: ambos) & ?dias_atras=14 (janela)
 */

const GOOGLE_API_KEY = 'AIzaSyBKprFuR1gpvoTB4hV16rKlBk3oF0v1BhQ'
const SHEETS: Record<number, string> = {
  3: '1QhuD52kQrdCv4XMfKR5NSRMttx6NzVBZO0S8ajQK1H8', // Ordinário
  4: '1PXqIquLaUh12wka_Md4YufOo4FoHilrP_x6qmPSW440', // Deboche
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toISO(s: unknown): string | null {
  if (typeof s !== 'string' || !s.includes('/')) return null
  const [d, m, y] = s.split('/')
  if (!y || y.length !== 4) return null
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

// range default = aba INSUMOS (800 linhas: ~482 + seção FUNCIONÁRIOS depois da linha 400)
async function fetchSheet(id: string, range = 'INSUMOS!A1:AMJ800'): Promise<unknown[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}` +
    `?key=${GOOGLE_API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  const r = await fetch(url)
  const j = await r.json()
  if (j.error) throw new Error(`Sheets API: ${JSON.stringify(j.error)}`)
  return (j.values || []) as unknown[][]
}

interface BronzeRec {
  data_contagem: string; insumo_codigo: string; insumo_nome: string;
  estoque_fechado: number | null; estoque_flutuante: number | null;
  preco_planilha: number | null;
}

// "R$ 1.234,56" → 1234.56 (mas com UNFORMATTED_VALUE normalmente já vem número)
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  let s = String(v).replace(/R\$/gi, '').replace(/\s/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// Coluna de PREÇO (atributo do item, perto do código) — detectada pelo cabeçalho, não por índice fixo.
function findPrecoCol(rows: unknown[][]): number {
  const norm = (s: unknown) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  for (const ri of [5, 4, 3, 6, 2, 1, 0]) {
    const r = (rows[ri] || []) as unknown[]
    for (let c = 0; c < Math.min(r.length, 14); c++) {
      const v = norm(r[c])
      if (v === 'preco' || v.startsWith('preco')) return c
    }
  }
  return -1
}

/** Parseia o grid → linhas cruas (tidy) por (data, código). Soma duplicatas do mesmo código no dia. */
function parse(rows: unknown[][], fromISO: string, toISODate: string): BronzeRec[] {
  const dateRow = (rows[3] || []) as unknown[]
  const header = (rows[5] || []) as unknown[]
  const precoCol = findPrecoCol(rows)
  const dcols: { c: number; iso: string }[] = []
  for (let c = 0; c < dateRow.length; c++) {
    const iso = toISO(dateRow[c])
    if (iso && iso >= fromISO && iso <= toISODate) {
      const h = String(header[c] || '').toUpperCase()
      if (h.includes('FECHADO')) dcols.push({ c, iso })
    }
  }
  const agg = new Map<string, BronzeRec>()
  for (const { c, iso } of dcols) {
    for (let i = 6; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      if (!row) continue
      const cod = String(row[3] || '').trim().toUpperCase()
      const nome = String(row[6] || '').trim()
      if (!cod || !nome || cod === 'CÓD') continue
      const f = row[c], fl = row[c + 1]
      const fechado = typeof f === 'number' ? f : null
      const flut = typeof fl === 'number' ? fl : null
      if (fechado === null && flut === null) continue
      const preco = precoCol >= 0 ? toNum(row[precoCol]) : null
      const key = `${iso}|${cod}`
      const ex = agg.get(key)
      if (ex) {
        ex.estoque_fechado = (ex.estoque_fechado || 0) + (fechado || 0)
        ex.estoque_flutuante = (ex.estoque_flutuante || 0) + (flut || 0)
        if (ex.preco_planilha == null && preco != null) ex.preco_planilha = preco
      } else {
        agg.set(key, { data_contagem: iso, insumo_codigo: cod, insumo_nome: nome, estoque_fechado: fechado, estoque_flutuante: flut, preco_planilha: preco })
      }
    }
  }
  return [...agg.values()]
}

async function syncBar(sb: ReturnType<typeof createClient>, bar: number, diasAtras: number) {
  const sheetId = SHEETS[bar]
  if (!sheetId) throw new Error(`sem planilha para bar ${bar}`)
  const today = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - diasAtras * 86400000).toISOString().slice(0, 10)

  const rows = await fetchSheet(sheetId)
  const recs = parse(rows, from, today)

  // BRONZE: linhas cruas (tidy) da planilha
  const now = new Date().toISOString()
  const bronze = recs.map((r) => ({
    bar_id: bar,
    data_contagem: r.data_contagem,
    insumo_codigo: r.insumo_codigo,
    insumo_nome: r.insumo_nome,
    estoque_fechado: r.estoque_fechado,
    estoque_flutuante: r.estoque_flutuante,
    preco_planilha: r.preco_planilha,
    ingested_em: now,
  }))
  let landed = 0
  for (let i = 0; i < bronze.length; i += 500) {
    const chunk = bronze.slice(i, i + 500)
    const { error } = await sb.from('bronze_contagem_sheet')
      .upsert(chunk, { onConflict: 'bar_id,data_contagem,insumo_codigo' })
    if (error) throw error
    landed += chunk.length
  }

  // ESPELHO: o que sumiu da planilha (não foi tocado nesta leitura) some do bronze na janela.
  // As linhas relidas têm ingested_em = now; as órfãs ficaram com ingested_em antigo.
  const { error: delErr } = await sb.from('bronze_contagem_sheet')
    .delete().eq('bar_id', bar).gte('data_contagem', from).lt('ingested_em', now)
  if (delErr) throw delErr

  // SILVER/GOLD: refresh do operations a partir do bronze (enriquecimento em SQL)
  const { data: upserted, error: re } = await (sb.schema('operations') as any)
    .rpc('fn_refresh_contagem_estoque', { p_bar: bar, p_dias: diasAtras })
  if (re) throw re

  return { bar, janela: { from, to: today }, bronze: landed, upserted }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const barParam = url.searchParams.get('bar_id')
    const diasAtras = Math.max(1, Math.min(400, Number(url.searchParams.get('dias_atras')) || 14)) // até 400 p/ backfill
    const bars = barParam ? [Number(barParam)] : [3, 4]

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const results = []
    for (const bar of bars) results.push(await syncBar(sb, bar, diasAtras))

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
