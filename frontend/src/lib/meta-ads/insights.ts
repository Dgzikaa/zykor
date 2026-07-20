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
const PURCHASE_TYPES = ['purchase', 'omni_purchase'];
const PURCHASE_ROAS_TYPES = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase'];

// Métricas extras (custo por resultado, ROAS de compra, frequência, vídeo) — todas na mesma
// chamada de insights (fields abaixo). Reusadas no resumo, por campanha e por anúncio.
const METRICAS_FIELDS = 'frequency,purchase_roas,video_thruplay_watched_actions';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Extrai o primeiro valor de um array [{action_type, value}] que casar com os tipos dados. */
function arrValue(arr: any[], types: string[]): number {
  if (!Array.isArray(arr)) return 0;
  for (const t of types) {
    const a = arr.find((x) => x.action_type === t);
    if (a) return num(a.value);
  }
  return 0;
}

export interface MetricasExtras {
  frequencia: number | null; // média de vezes que cada pessoa viu (fadiga se > ~3-4)
  leads: number;
  compras: number;
  thruplays: number; // vídeos assistidos completos/15s
  roas_compra: number | null; // retorno de venda via pixel (Sympla) por R$1
  custo_conversa: number | null;
  custo_venda: number | null;
}

/** Calcula as métricas extras a partir de uma linha crua de insights. */
function extraMetrics(row: any, investimento: number, conversas: number): MetricasExtras {
  const compras = arrValue(row.actions, PURCHASE_TYPES);
  const roas = round2(arrValue(row.purchase_roas, PURCHASE_ROAS_TYPES));
  const freq = num(row.frequency); // precisão cheia (ex.: 1.9922) — a UI formata
  return {
    frequencia: freq > 0 ? freq : null,
    leads: arrValue(row.actions, ['lead']),
    compras,
    thruplays: arrValue(row.video_thruplay_watched_actions, ['video_view']),
    roas_compra: roas > 0 ? roas : null,
    custo_conversa: conversas > 0 ? round2(investimento / conversas) : null,
    custo_venda: compras > 0 ? round2(investimento / compras) : null,
  };
}

export interface MetaAdsInsights extends MetricasExtras {
  investimento: number; // spend (BRL)
  impressoes: number;
  alcance: number;
  cliques: number; // clicks (TODOS os cliques — like, perfil, expandir, link)
  cliques_link: number; // inline_link_clicks (só cliques no link) — base de CTR/CPC (igual Reportei)
  conversas: number; // conversas iniciadas por mensagem
  cpm: number | null;
  ctr: number | null; // % — cliques no link ÷ impressões (link CTR)
  cpc: number | null; // custo por clique no link
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
    fields: `spend,impressions,reach,clicks,inline_link_clicks,cpm,ctr,cpc,actions,${METRICAS_FIELDS}`,
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
    return {
      investimento: 0, impressoes: 0, alcance: 0, cliques: 0, cliques_link: 0, conversas: 0, cpm: null, ctr: null, cpc: null,
      frequencia: null, leads: 0, compras: 0, thruplays: 0, roas_compra: null, custo_conversa: null, custo_venda: null,
    };
  }

  const investimento = num(row.spend);
  const impressoes = num(row.impressions);
  const cliques = num(row.clicks);
  const cliquesLink = num(row.inline_link_clicks);
  const conversas = arrValue(row.actions, [CONVERSA_ACTION]);

  return {
    investimento,
    impressoes,
    alcance: num(row.reach),
    cliques,
    cliques_link: cliquesLink,
    conversas,
    // recalcula dos totais (mais estável que confiar no cpm/ctr médio da API).
    // CTR/CPC usam cliques NO LINK (inline_link_clicks) pra bater com o Reportei.
    cpm: impressoes > 0 ? round2((investimento / impressoes) * 1000) : null,
    ctr: impressoes > 0 ? round2((cliquesLink / impressoes) * 100) : null,
    cpc: cliquesLink > 0 ? round2(investimento / cliquesLink) : null,
    ...extraMetrics(row, investimento, conversas),
  };
}

// ── Detalhamento por campanha / anúncio (aba "Anúncios") ────────────────────

export interface CampanhaRow extends MetricasExtras {
  campanha: string;
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  cliques_link: number;
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
  status: string | null; // effective_status (ACTIVE, PAUSED, ...)
  ativo: boolean;
  criado_em: string | null; // created_time ISO
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
      fields: `spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,actions,${METRICAS_FIELDS},${extraFields}`,
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

interface AdMeta {
  thumbnail: string | null;
  status: string | null;
  criado_em: string | null;
}

/** Busca thumbnail + status + data de criação por ad_id (batches de 50, EM PARALELO). Best-effort — nunca lança. */
async function fetchAdMeta(account: string, token: string, adIds: string[]): Promise<Record<string, AdMeta>> {
  const chunks: string[][] = [];
  for (let i = 0; i < adIds.length; i += 50) chunks.push(adIds.slice(i, i + 50));

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const params = new URLSearchParams({
          ids: chunk.join(','),
          fields: 'effective_status,created_time,creative.fields(thumbnail_url)',
          access_token: token,
        });
        const res = await fetch(`${GRAPH_BASE}/?${params.toString()}`, { next: { revalidate: 3600 } });
        if (!res.ok) return {};
        const json = await res.json();
        const partial: Record<string, AdMeta> = {};
        for (const id of chunk) {
          const ad = json?.[id];
          if (ad) {
            partial[id] = {
              thumbnail: ad.creative?.thumbnail_url || null,
              status: ad.effective_status || null,
              criado_em: ad.created_time || null,
            };
          }
        }
        return partial;
      } catch {
        return {}; // metadados são opcionais; segue sem
      }
    }),
  );

  return Object.assign({}, ...results);
}

function toCampanhaRow(r: any): CampanhaRow {
  const investimento = num(r.spend);
  const impressoes = num(r.impressions);
  const cliques = num(r.clicks);
  const cliquesLink = num(r.inline_link_clicks);
  const conversas = arrValue(r.actions, [CONVERSA_ACTION]);
  return {
    campanha: r.campaign_name || '(sem nome)',
    investimento,
    impressoes,
    alcance: num(r.reach),
    cliques,
    cliques_link: cliquesLink,
    conversas,
    cpm: impressoes > 0 ? round2((investimento / impressoes) * 1000) : null,
    ctr: impressoes > 0 ? round2((cliquesLink / impressoes) * 100) : null,
    cpc: cliquesLink > 0 ? round2(investimento / cliquesLink) : null,
    ...extraMetrics(r, investimento, conversas),
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

  const metas = await fetchAdMeta(
    account,
    token,
    adRows.map((r) => String(r.ad_id)).filter(Boolean),
  );

  const campanhas = campRows.map(toCampanhaRow).sort((a, b) => b.investimento - a.investimento);
  const anuncios: AnuncioRow[] = adRows
    .map((r) => {
      const m = metas[String(r.ad_id)];
      return {
        ...toCampanhaRow(r),
        ad_id: String(r.ad_id),
        anuncio: r.ad_name || '(sem nome)',
        conjunto: r.adset_name || '',
        thumbnail: m?.thumbnail || null,
        status: m?.status || null,
        ativo: m?.status === 'ACTIVE',
        criado_em: m?.criado_em || null,
      };
    })
    .sort((a, b) => b.investimento - a.investimento);

  return { campanhas, anuncios };
}

// ── Quebras (posicionamento / demografia) ───────────────────────────────────

export interface PosicionamentoRow {
  local: string; // ex.: "Instagram · Stories"
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number | null;
}

export interface DemografiaRow {
  faixa: string; // faixa etária (ex.: "25-34")
  feminino: number; // impressões
  masculino: number;
  outros: number;
}

const PLATAFORMA_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', audience_network: 'Audience Network', messenger: 'Messenger',
};
const POSICAO_LABEL: Record<string, string> = {
  feed: 'Feed', instagram_stories: 'Stories', instagram_reels: 'Reels', facebook_reels: 'Reels', facebook_stories: 'Stories',
  instagram_explore_grid_home: 'Explorar', instream_video: 'Vídeo', marketplace: 'Marketplace', threads_feed: 'Feed',
};

async function fetchBreakdown(account: string, token: string, breakdowns: string, inicio: string, fim: string, fields: string): Promise<any[]> {
  const params = new URLSearchParams({
    level: 'account',
    fields,
    breakdowns,
    time_range: JSON.stringify({ since: inicio, until: fim }),
    limit: '500',
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/${account}/insights?${params.toString()}`, { next: { revalidate: 1800 } });
  const json = await res.json();
  if (!res.ok) throw new Error(`Meta Ads API (breakdown ${breakdowns}): ${json?.error?.message || 'erro'}`);
  return Array.isArray(json.data) ? json.data : [];
}

/** Quebra por posicionamento (Stories/Feed/Reels × IG/FB) e por demografia (idade × gênero). */
export async function fetchMetaAdsBreakdowns(
  barId: number,
  inicio: string,
  fim: string,
): Promise<{ posicionamento: PosicionamentoRow[]; demografia: DemografiaRow[] } | null> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const account = getAdAccountId(barId);
  if (!token || !account) return null;

  const [posRaw, demoRaw] = await Promise.all([
    fetchBreakdown(account, token, 'publisher_platform,platform_position', inicio, fim, 'spend,impressions,clicks'),
    fetchBreakdown(account, token, 'age,gender', inicio, fim, 'impressions'),
  ]);

  // Posicionamento: agrega e rotula amigável; descarta ruído sub-R$1; top por gasto.
  const posMap = new Map<string, PosicionamentoRow>();
  for (const r of posRaw) {
    const plat = PLATAFORMA_LABEL[r.publisher_platform] || r.publisher_platform || '?';
    const pos = POSICAO_LABEL[r.platform_position] || r.platform_position || '?';
    const local = `${plat} · ${pos}`;
    const prev = posMap.get(local) || { local, investimento: 0, impressoes: 0, cliques: 0, ctr: null };
    prev.investimento += num(r.spend);
    prev.impressoes += num(r.impressions);
    prev.cliques += num(r.clicks);
    posMap.set(local, prev);
  }
  const posicionamento = [...posMap.values()]
    .filter((p) => p.investimento >= 1)
    .map((p) => ({ ...p, investimento: round2(p.investimento), ctr: p.impressoes > 0 ? round2((p.cliques / p.impressoes) * 100) : null }))
    .sort((a, b) => b.investimento - a.investimento);

  // Demografia: faixa etária × gênero (impressões).
  const demoMap = new Map<string, DemografiaRow>();
  for (const r of demoRaw) {
    const faixa = r.age || '?';
    const row = demoMap.get(faixa) || { faixa, feminino: 0, masculino: 0, outros: 0 };
    const imp = num(r.impressions);
    if (r.gender === 'female') row.feminino += imp;
    else if (r.gender === 'male') row.masculino += imp;
    else row.outros += imp;
    demoMap.set(faixa, row);
  }
  const demografia = [...demoMap.values()].sort((a, b) => a.faixa.localeCompare(b.faixa));

  return { posicionamento, demografia };
}
