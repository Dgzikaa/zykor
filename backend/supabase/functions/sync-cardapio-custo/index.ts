/**
 * sync-cardapio-custo
 * --------------------------------------------------------------------------
 * Re-sincroniza diariamente o CUSTO FINAL / PRECO das planilhas de Engenharia
 * de Cardapio (uma por bar) para operations.produto_custo_manual.
 *
 * - O de-para planilha->ContaHub ja existe (produto_custo_manual.codigo_planilha);
 *   aqui so atualizamos o custo das linhas com fonte='planilha_cardapio'
 *   (linhas 'manual' nunca sao tocadas).
 * - Apos atualizar, tira o snapshot do dia (operations.snapshot_produto_custo)
 *   para o historico de precos.
 *
 * Config das planilhas: operations.cardapio_planilha_config.
 * Pre-requisito: cada planilha precisa estar COMPARTILHADA com o service account
 * do Google (o mesmo de GOOGLE_SERVICE_ACCOUNT_KEY usado no sync de CMV).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getGoogleAccessToken, getSheetValues, getSheetNames } from '../_shared/google-auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// minuscula, sem acento, trim
function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).replace(/r\$/i, '').trim()
  if (s === '' || s === '-') return null
  // pt-BR: 1.234,56 -> 1234.56
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  s = s.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const isCodigo = (s: unknown) => /^[a-z]\d{4}$/.test(String(s ?? '').trim())

interface Item { codigo_planilha: string; custo: number | null; preco: number | null }

/**
 * Varre a aba inteira. Cada vez que encontra um header de tabela-resumo
 * (tem celula "produto" e celula "custo final"), mapeia as colunas e le as
 * linhas de produto (codigo b/c/d####) seguintes. Blocos posteriores
 * (resumo final) sobrescrevem os anteriores no mesmo codigo.
 * Obs: comparacoes usam texto ja normalizado (sem acento).
 */
function parseBlocoResumo(rows: any[][]): Item[] {
  const acc = new Map<string, Item>()
  let cols: { cod: number; custo: number; preco: number } | null = null

  for (const row of rows) {
    if (!row || row.length === 0) continue
    const cells = row.map(norm)

    const temProduto = cells.some(c => c === 'produto')
    const temCustoFinal = cells.some(c => c === 'custo final')
    if (temProduto && temCustoFinal) {
      const cod = cells.findIndex(c => /^(codigo|cod\.?\s*insumo|codproduto)$/.test(c))
      const custo = cells.findIndex(c => c === 'custo final')
      const preco = cells.findIndex(c => /^preco( venda)?$/.test(c))
      if (cod >= 0 && custo >= 0) {
        cols = { cod, custo, preco }
        continue
      }
    }

    if (!cols) continue
    const codigo = String(row[cols.cod] ?? '').trim()
    if (!isCodigo(codigo)) continue
    const custo = parseNum(row[cols.custo])
    const preco = cols.preco >= 0 ? parseNum(row[cols.preco]) : null
    acc.set(codigo, { codigo_planilha: codigo, custo, preco })
  }
  return [...acc.values()]
}

async function escolherAba(spreadsheetId: string, abaConfig: string | null, token: string): Promise<string> {
  if (abaConfig) return abaConfig
  const nomes = await getSheetNames(spreadsheetId, token)
  const pref = nomes.find(n => /card[aá]pio|engenharia/i.test(n))
  return pref || nomes[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    let body: any = {}
    try { body = await req.json() } catch { /* sem body = todos os bares */ }
    const filtroBar: number | null = body?.bar_id ?? null

    const { data: configs, error: cfgErr } = await supabase
      .schema('operations')
      .from('cardapio_planilha_config')
      .select('bar_id, spreadsheet_id, aba, ativo')
      .eq('ativo', true)
    if (cfgErr) throw cfgErr

    const token = await getGoogleAccessToken()
    const resultados: any[] = []

    for (const cfg of (configs ?? [])) {
      if (filtroBar && cfg.bar_id !== filtroBar) continue
      try {
        const aba = await escolherAba(cfg.spreadsheet_id, cfg.aba, token)
        const rows = await getSheetValues(cfg.spreadsheet_id, aba, token)
        const items = parseBlocoResumo(rows).filter(i => i.custo !== null && i.custo > 0)

        const { data: mudou, error: rpcErr } = await supabase.rpc('sync_custo_planilha', {
          p_bar_id: cfg.bar_id,
          p_items: items,
        })
        if (rpcErr) throw rpcErr

        resultados.push({ bar_id: cfg.bar_id, aba, produtos_lidos: items.length, linhas_atualizadas: mudou })
      } catch (e) {
        resultados.push({ bar_id: cfg.bar_id, erro: (e as Error).message })
      }
    }

    // snapshot do dia (historico de precos) — funcao em operations
    const { data: snap, error: snapErr } = await supabase
      .schema('operations')
      .rpc('snapshot_produto_custo')
    if (snapErr) resultados.push({ snapshot_erro: snapErr.message })

    return new Response(
      JSON.stringify({ success: true, resultados, snapshot_linhas: snap }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
