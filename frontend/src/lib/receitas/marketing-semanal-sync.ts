/**
 * Sincroniza `meta.marketing_semanal` automaticamente a partir das fontes reais,
 * substituindo a digitação manual (Reportei) — SEM mudar a tela /estrategico/desempenho,
 * que continua lendo dessa tabela igual.
 *
 * [O] Orgânico (Instagram) = Feed + Reels somados (o "jeito Zykor", mesma base do card
 *     "Alcance (orgânico)" da aba Orgânico). Fonte: integrations.instagram_posts +
 *     instagram_post_insights (último snapshot por mídia).
 * [M] Mídia (Meta Ads) = fetchMetaAdsInsights (CTR/CPC por clique no link, igual Reportei).
 *
 * IMPORTANTE: o upsert NÃO envia as colunas de stories (o_num_stories, o_visu_stories,
 * o_retencao_stories) — elas seguem MANUAIS até resolver a captação de reposts/collabs.
 * Como o upsert do PostgREST só atualiza as colunas enviadas, os stories manuais que já
 * estiverem na linha são preservados.
 */

import { createServiceRoleClient } from '@/lib/supabase-admin';
import { fetchMetaAdsInsights, hasMetaAdsCredentials } from '@/lib/meta-ads/insights';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Semana ISO (mesma convenção de desempenho-mensal-service: semana 1 contém 4/jan) ──

/** ISO week (ano, semana) de uma data. */
export function isoWeekOf(d: Date): { ano: number; semana: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // domingo=0 -> 7
  date.setUTCDate(date.getUTCDate() + 4 - day); // quinta-feira da semana ISO
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { ano: date.getUTCFullYear(), semana };
}

function isoWeekStart(ano: number, semana: number): Date {
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (semana - 1) * 7);
  return start;
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/** Intervalo [segunda, domingo] (YYYY-MM-DD) de uma semana ISO. */
export function isoWeekRange(ano: number, semana: number): { inicio: string; fim: string } {
  const start = isoWeekStart(ano, semana);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { inicio: toISODate(start), fim: toISODate(end) };
}

// ── Cálculo [O] orgânico (Feed + Reels) ─────────────────────────────────────

interface OrganicoRow {
  o_num_posts: number;
  o_alcance: number;
  o_interacao: number;
  o_curtidas: number;
  o_comentarios: number;
  o_salvamentos: number;
  o_compartilhamento: number;
  o_engajamento: number; // % (interações ÷ alcance)
}

async function computeOrganico(supabase: any, barId: number, inicio: string, fim: string): Promise<OrganicoRow> {
  const vazio: OrganicoRow = {
    o_num_posts: 0, o_alcance: 0, o_interacao: 0, o_curtidas: 0,
    o_comentarios: 0, o_salvamentos: 0, o_compartilhamento: 0, o_engajamento: 0,
  };

  const { data: posts } = await supabase
    .schema('integrations')
    .from('instagram_posts')
    .select('ig_media_id, media_product_type')
    .eq('bar_id', barId)
    .in('media_product_type', ['FEED', 'REELS'])
    .gte('timestamp_post', inicio)
    .lte('timestamp_post', `${fim}T23:59:59`);

  const lista: any[] = posts || [];
  if (!lista.length) return vazio;

  const ids = lista.map((p) => p.ig_media_id);
  const { data: insights } = await supabase
    .schema('integrations')
    .from('instagram_post_insights')
    .select('ig_media_id, reach, likes, comments, shares, saved, data_snapshot')
    .eq('bar_id', barId)
    .in('ig_media_id', ids)
    .order('data_snapshot', { ascending: false });

  // último snapshot por mídia
  const map = new Map<string, any>();
  for (const i of insights ?? []) if (!map.has(i.ig_media_id)) map.set(i.ig_media_id, i);

  let alcance = 0, curtidas = 0, comentarios = 0, shares = 0, salvamentos = 0;
  for (const p of lista) {
    const i = map.get(p.ig_media_id) ?? {};
    alcance += Number(i.reach) || 0;
    curtidas += Number(i.likes) || 0;
    comentarios += Number(i.comments) || 0;
    shares += Number(i.shares) || 0;
    salvamentos += Number(i.saved) || 0;
  }
  const interacao = curtidas + comentarios + shares + salvamentos;

  return {
    o_num_posts: lista.length,
    o_alcance: alcance,
    o_interacao: interacao,
    o_curtidas: curtidas,
    o_comentarios: comentarios,
    o_salvamentos: salvamentos,
    o_compartilhamento: shares,
    o_engajamento: alcance > 0 ? round2((interacao / alcance) * 100) : 0,
  };
}

// ── Cálculo [M] mídia (Meta Ads) ────────────────────────────────────────────

async function computeMidia(barId: number, inicio: string, fim: string) {
  if (!hasMetaAdsCredentials(barId)) return null;
  const r = await fetchMetaAdsInsights(barId, inicio, fim);
  if (!r) return null;
  return {
    m_valor_investido: r.investimento,
    m_alcance: r.alcance,
    m_impressoes: r.impressoes,
    m_frequencia: r.frequencia,
    m_cpm: r.cpm,
    m_cliques: r.cliques, // todos os cliques (número exibido "Cliques")
    m_ctr: r.ctr, // por clique no link
    m_cpc: r.cpc, // por clique no link
    m_conversas_iniciadas: r.conversas,
  };
}

// ── Orquestração ────────────────────────────────────────────────────────────

/** bar_ids com conta de anúncio configurada na env META_ADS_ACCOUNTS. */
function adsAccountBars(): number[] {
  const raw = process.env.META_ADS_ACCOUNTS;
  if (!raw) return [];
  try {
    return Object.keys(JSON.parse(raw)).map(Number).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

/** Fontes disponíveis por bar: [O] só se tem IG ativo, [M] só se tem conta de anúncio. */
export async function barSources(barId: number): Promise<{ organico: boolean; midia: boolean }> {
  const supabase = createServiceRoleClient();
  const { data } = await (supabase as any)
    .schema('integrations')
    .from('instagram_contas')
    .select('bar_id')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .limit(1);
  return { organico: !!(data && data.length), midia: adsAccountBars().includes(barId) };
}

/**
 * Sincroniza uma semana de um bar (upsert preservando stories manuais).
 * `organico`/`midia` ligam cada bloco: bar SEM Instagram (ex.: Deboche hoje) NÃO deve
 * ter [O] preenchido, senão o cálculo zerado sobrescreveria os dados manuais. Idem [M]
 * só quando há conta de anúncio configurada.
 */
export async function syncMarketingSemana(
  barId: number,
  ano: number,
  semana: number,
  opts: { organico?: boolean; midia?: boolean } = {},
) {
  const incOrganico = opts.organico ?? true;
  const incMidia = opts.midia ?? true;

  const supabase = createServiceRoleClient();
  const { inicio, fim } = isoWeekRange(ano, semana);

  const org = incOrganico ? await computeOrganico(supabase, barId, inicio, fim) : null;
  const midia = incMidia ? await computeMidia(barId, inicio, fim).catch(() => null) : null;

  // Nada calculável pra esse bar → não escreve (não zera nada manual)
  if (!org && !midia) return { barId, ano, semana, inicio, fim, org: null, midia: null, skipped: true };

  const payload = { bar_id: barId, ano, semana, ...(org ?? {}), ...(midia ?? {}) };
  const { error } = await (supabase as any)
    .schema('meta')
    .from('marketing_semanal')
    .upsert(payload, { onConflict: 'bar_id,ano,semana' });

  if (error) throw new Error(`marketing_semanal bar ${barId} ${ano}-W${semana}: ${error.message}`);
  return { barId, ano, semana, inicio, fim, org, midia: midia ?? null };
}

/**
 * Sincroniza semana atual + anterior (para pegar assentamento de atribuição da Meta e
 * crescimento de alcance dos posts recentes) de todos os bares com IG ativo ou ads.
 */
export async function syncMarketingTodos() {
  const supabase = createServiceRoleClient();

  const { data: contas } = await (supabase as any)
    .schema('integrations')
    .from('instagram_contas')
    .select('bar_id')
    .eq('ativo', true);

  // Bares com IG ativo (recebem [O]) e bares com conta de anúncio (recebem [M]) — cada
  // bloco é preenchido só onde a fonte existe, pra não zerar dados manuais do outro.
  const igBars = new Set<number>((contas ?? []).map((c: any) => Number(c.bar_id)).filter(Boolean));
  const adsBars = new Set<number>(adsAccountBars());
  const bars = new Set<number>([...igBars, ...adsBars]);

  const hoje = new Date();
  const semanas = [isoWeekOf(new Date(hoje.getTime() - 7 * 86400000)), isoWeekOf(hoje)];

  const resultados: any[] = [];
  for (const barId of bars) {
    const opts = { organico: igBars.has(barId), midia: adsBars.has(barId) };
    for (const w of semanas) {
      try {
        resultados.push(await syncMarketingSemana(barId, w.ano, w.semana, opts));
      } catch (e: any) {
        resultados.push({ barId, ano: w.ano, semana: w.semana, erro: e?.message || String(e) });
      }
    }
  }
  return resultados;
}
