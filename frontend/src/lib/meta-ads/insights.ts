/**
 * Cliente da Meta Marketing API (mídia PAGA — Meta Ads).
 *
 * Token = System User (não expira) com scope `ads_read`, guardado na env do Vercel
 * `META_ADS_ACCESS_TOKEN` (nunca no código/banco em texto). O mapa bar_id -> conta de
 * anúncio vive em `META_ADS_ACCOUNTS` (JSON: {"3":"1153081576486761"}).
 *
 * Substitui a fonte manual (Reportei em meta.marketing_semanal) por dado real de
 * `graph.facebook.com/act_<id>/insights`. Ver [[project_receitas_hub_marketing_planejamento]].
 */

const GRAPH_VERSION = 'v22.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// action_type que representa "conversas iniciadas" (mensagens no Messenger/IG via anúncio).
const CONVERSA_ACTION = 'onsite_conversion.messaging_conversation_started_7d';

export interface MetaAdsInsights {
  investimento: number; // spend (BRL)
  impressoes: number;
  alcance: number;
  cliques: number;
  conversas: number; // conversas iniciadas por mensagem
  cpm: number | null;
  ctr: number | null; // %
  cpc: number | null;
}

/** Lê o mapa bar_id -> ad_account_id da env. Normaliza pro formato `act_<id>`. */
export function getAdAccountId(barId: number): string | null {
  const raw = process.env.META_ADS_ACCOUNTS;
  if (!raw) return null;
  let map: Record<string, string>;
  try {
    map = JSON.parse(raw);
  } catch {
    console.error('[meta-ads] META_ADS_ACCOUNTS não é JSON válido');
    return null;
  }
  const id = map[String(barId)];
  if (!id) return null;
  return String(id).startsWith('act_') ? String(id) : `act_${id}`;
}

export function hasMetaAdsCredentials(barId: number): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN) && Boolean(getAdAccountId(barId));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Busca insights agregados de uma conta de anúncio no intervalo [inicio, fim] (YYYY-MM-DD).
 * Retorna null se faltar credencial. Lança em erro de API (deixa a rota decidir fallback).
 */
export async function fetchMetaAdsInsights(
  barId: number,
  inicio: string,
  fim: string,
): Promise<MetaAdsInsights | null> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const account = getAdAccountId(barId);
  if (!token || !account) return null;

  const params = new URLSearchParams({
    fields: 'spend,impressions,reach,clicks,cpm,ctr,cpc,actions',
    time_range: JSON.stringify({ since: inicio, until: fim }),
    level: 'account',
    access_token: token,
  });

  const res = await fetch(`${GRAPH_BASE}/${account}/insights?${params.toString()}`, {
    // dado de anúncio muda devagar; cache curto no edge evita bater a API a cada request
    next: { revalidate: 1800 },
  });
  const json = await res.json();

  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json).slice(0, 300);
    throw new Error(`Meta Ads API: ${msg}`);
  }

  const row = Array.isArray(json?.data) ? json.data[0] : null;
  if (!row) {
    // sem gasto no período → zera (não é erro)
    return { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, conversas: 0, cpm: null, ctr: null, cpc: null };
  }

  const conversa = Array.isArray(row.actions)
    ? row.actions.find((a: any) => a.action_type === CONVERSA_ACTION)
    : null;

  const investimento = num(row.spend);
  const impressoes = num(row.impressions);
  const cliques = num(row.clicks);

  return {
    investimento,
    impressoes,
    alcance: num(row.reach),
    cliques,
    conversas: conversa ? num(conversa.value) : 0,
    // recalcula dos totais (mais estável que confiar no cpm/ctr médio da API)
    cpm: impressoes > 0 ? Math.round((investimento / impressoes) * 1000 * 100) / 100 : null,
    ctr: impressoes > 0 ? Math.round((cliques / impressoes) * 100 * 100) / 100 : null,
    cpc: cliques > 0 ? Math.round((investimento / cliques) * 100) / 100 : null,
  };
}
