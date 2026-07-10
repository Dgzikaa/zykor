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

// ── Detalhamento por campanha / anúncio (aba "Anúncios") ────────────────────

export interface CampanhaRow {
  campanha: string;
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  conversas: number;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
}

export interface AnuncioRow extends CampanhaRow {
  ad_id: string;
  anuncio: string;
  conjunto: string;
  thumbnail: string | null;
}

function actionValue(actions: any[], type: string): number {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find((x) => x.action_type === type);
  return a ? num(a.value) : 0;
}

async function fetchInsightsRows(
  account: string,
  token: string,
  level: 'campaign' | 'ad',
  inicio: string,
  fim: string,
  extraFields: string,
): Promise<any[]> {
  const rows: any[] = [];
  let url =
    `${GRAPH_BASE}/${account}/insights?` +
    new URLSearchParams({
      level,
      fields: `spend,impressions,reach,clicks,ctr,cpc,actions,${extraFields}`,
      time_range: JSON.stringify({ since: inicio, until: fim }),
      sort: 'spend_descending',
      limit: '200',
      access_token: token,
    }).toString();

  // pagina (contas grandes passam de 200 linhas); teto de 5 páginas por segurança
  for (let i = 0; i < 5 && url; i++) {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    const json = await res.json();
    if (!res.ok) throw new Error(`Meta Ads API (${level}): ${json?.error?.message || 'erro'}`);
    if (Array.isArray(json.data)) rows.push(...json.data);
    url = json?.paging?.next || '';
  }
  return rows;
}

/** Busca thumbnails dos criativos por ad_id (batch de 50). Best-effort — nunca lança. */
async function fetchThumbnails(account: string, token: string, adIds: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50);
    try {
      const params = new URLSearchParams({
        ids: chunk.join(','),
        fields: 'creative.fields(thumbnail_url)',
        access_token: token,
      });
      const res = await fetch(`${GRAPH_BASE}/?${params.toString()}`, { next: { revalidate: 3600 } });
      const json = await res.json();
      if (res.ok) {
        for (const id of chunk) {
          const thumb = json?.[id]?.creative?.thumbnail_url;
          if (thumb) map[id] = thumb;
        }
      }
    } catch {
      /* thumbnail é opcional; segue sem */
    }
  }
  return map;
}

function toCampanhaRow(r: any): CampanhaRow {
  const investimento = num(r.spend);
  const impressoes = num(r.impressions);
  const cliques = num(r.clicks);
  return {
    campanha: r.campaign_name || '(sem nome)',
    investimento,
    impressoes,
    alcance: num(r.reach),
    cliques,
    conversas: actionValue(r.actions, CONVERSA_ACTION),
    cpm: impressoes > 0 ? Math.round((investimento / impressoes) * 1000 * 100) / 100 : null,
    ctr: impressoes > 0 ? Math.round((cliques / impressoes) * 100 * 100) / 100 : null,
    cpc: cliques > 0 ? Math.round((investimento / cliques) * 100) / 100 : null,
  };
}

/** Detalhamento pra aba Anúncios: campanhas + anúncios (com thumbnail). null se sem credencial. */
export async function fetchMetaAdsBreakdown(
  barId: number,
  inicio: string,
  fim: string,
): Promise<{ campanhas: CampanhaRow[]; anuncios: AnuncioRow[] } | null> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const account = getAdAccountId(barId);
  if (!token || !account) return null;

  const [campRows, adRows] = await Promise.all([
    fetchInsightsRows(account, token, 'campaign', inicio, fim, 'campaign_name'),
    fetchInsightsRows(account, token, 'ad', inicio, fim, 'ad_id,ad_name,adset_name,campaign_name'),
  ]);

  const thumbs = await fetchThumbnails(
    account,
    token,
    adRows.map((r) => String(r.ad_id)).filter(Boolean),
  );

  const campanhas = campRows.map(toCampanhaRow).sort((a, b) => b.investimento - a.investimento);
  const anuncios: AnuncioRow[] = adRows
    .map((r) => ({
      ...toCampanhaRow(r),
      ad_id: String(r.ad_id),
      anuncio: r.ad_name || '(sem nome)',
      conjunto: r.adset_name || '',
      thumbnail: thumbs[String(r.ad_id)] || null,
    }))
    .sort((a, b) => b.investimento - a.investimento);

  return { campanhas, anuncios };
}
