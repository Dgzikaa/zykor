import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

/**
 * 📦 SYNC-CONTAGEM-SHEETS (v3 — rework jun/2026)
 *
 * Lê a aba INSUMOS da planilha de Contagem de Estoque (uma por bar) e grava
 * em operations.contagem_estoque_insumos no modelo novo:
 *   - estoque_fechado + estoque_flutuante (estoque_final = soma)
 *   - tipo_contagem derivado da DATA: dia 1 = mensal > segunda = semanal > resto = diaria
 *   - chave única (bar_id, data_contagem, insumo_codigo) — lossless, sem AUTO_
 *   - casa por código; se o código mudou na planilha, casa por NOME normalizado
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

function tipoFromDate(iso: string): 'mensal' | 'semanal' | 'diaria' {
  const day = Number(iso.slice(8, 10))
  const dow = new Date(iso + 'T00:00:00Z').getUTCDay() // 0=Dom 1=Seg
  if (day === 1) return 'mensal'
  if (dow === 1) return 'semanal'
  return 'diaria'
}

function normNome(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

async function fetchSheet(id: string): Promise<unknown[][]> {
  const range = 'INSUMOS!A1:AMJ400'
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}` +
    `?key=${GOOGLE_API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  const r = await fetch(url)
  const j = await r.json()
  if (j.error) throw new Error(`Sheets API: ${JSON.stringify(j.error)}`)
  return (j.values || []) as unknown[][]
}

interface Rec {
  data_contagem: string; insumo_codigo: string; insumo_nome: string;
  tipo_contagem: string; estoque_fechado: number | null; estoque_flutuante: number | null; estoque_final: number;
}

function parse(rows: unknown[][], fromISO: string, toISODate: string): Rec[] {
  const dateRow = (rows[3] || []) as unknown[]
  const header = (rows[5] || []) as unknown[]
  const dcols: { c: number; iso: string }[] = []
  for (let c = 0; c < dateRow.length; c++) {
    const iso = toISO(dateRow[c])
    if (iso && iso >= fromISO && iso <= toISODate) {
      const h = String(header[c] || '').toUpperCase()
      if (h.includes('FECHADO')) dcols.push({ c, iso })
    }
  }
  const agg = new Map<string, Rec>()
  for (const { c, iso } of dcols) {
    const tipo = tipoFromDate(iso)
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
      const key = `${iso}|${cod}`
      const ex = agg.get(key)
      if (ex) {
        ex.estoque_fechado = (ex.estoque_fechado || 0) + (fechado || 0)
        ex.estoque_flutuante = (ex.estoque_flutuante || 0) + (flut || 0)
        ex.estoque_final = (ex.estoque_fechado || 0) + (ex.estoque_flutuante || 0)
      } else {
        agg.set(key, {
          data_contagem: iso, insumo_codigo: cod, insumo_nome: nome, tipo_contagem: tipo,
          estoque_fechado: fechado, estoque_flutuante: flut, estoque_final: (fechado || 0) + (flut || 0),
        })
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

  // catálogo do bar: code -> id, nome normalizado -> id
  const { data: cat, error: ce } = await sb.schema('operations').from('insumos')
    .select('id,codigo,nome,categoria,tipo_local,unidade_medida,custo_unitario').eq('bar_id', bar)
  if (ce) throw ce
  const byCode = new Map<string, any>(), byName = new Map<string, any>()
  for (const r of (cat || []) as any[]) {
    byCode.set(String(r.codigo).toUpperCase(), r)
    byName.set(normNome(r.nome), r)
  }

  const semCadastro = new Set<string>()
  const now = new Date().toISOString()
  const payload = recs.map((r) => {
    const m = byCode.get(r.insumo_codigo) || byName.get(normNome(r.insumo_nome))
    if (!m) semCadastro.add(r.insumo_codigo)
    return {
      bar_id: bar, ...r,
      insumo_id: m?.id ?? null,
      categoria: m?.categoria ?? null,
      tipo_local: m?.tipo_local ?? null,
      unidade_medida: m?.unidade_medida ?? null,
      custo_unitario: m?.custo_unitario ?? 0,
      usuario_contagem: 'sync-contagem-sheets',
      observacoes: 'sync-diario',
      updated_at: now,
    }
  })

  let upserted = 0
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500)
    const { error } = await sb.schema('operations').from('contagem_estoque_insumos')
      .upsert(chunk, { onConflict: 'bar_id,data_contagem,insumo_codigo' })
    if (error) throw error
    upserted += chunk.length
  }
  return { bar, janela: { from, to: today }, linhas: payload.length, upserted, sem_cadastro: [...semCadastro] }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const barParam = url.searchParams.get('bar_id')
    const diasAtras = Math.max(1, Math.min(60, Number(url.searchParams.get('dias_atras')) || 14))
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
