/**
 * Sincroniza `meta.marketing_semanal` automaticamente a partir das fontes reais,
 * substituindo a digitação manual (Reportei) — SEM mudar a tela /estrategico/desempenho,
 * que continua lendo dessa tabela igual.
 *
 * [O] Orgânico (Instagram) = Feed + Reels somados (o "jeito Zykor", mesma base do card
 *     "Alcance (orgânico)" da aba Orgânico). Fonte: integrations.instagram_posts +
 *     instagram_post_insights (último snapshot por mídia).
 * [M] Mídia (Meta Ads) = fetchMetaAdsInsights (CTR/CPC por clique no link, igual Reportei).
 * [GMN] Google Meu Negócio = Business Profile Performance API, da ficha amarrada ao bar em
 *     integrations.google_oauth_tokens.location_id. Não vai semana a semana como os outros:
 *     roda por JANELA (ver GMN_JANELA_DIAS), porque o Google fecha os números com atraso e
 *     as semanas passadas precisam ser reescritas até estabilizarem.
 *
 * IMPORTANTE: o upsert NÃO envia as colunas de stories (o_num_stories, o_visu_stories,
 * o_retencao_stories) — elas seguem MANUAIS até resolver a captação de reposts/collabs.
 * Como o upsert do PostgREST só atualiza as colunas enviadas, os stories manuais que já
 * estiverem na linha são preservados.
 */

import { createServiceRoleClient } from '@/lib/supabase-admin';
import { fetchMetaAdsInsights, hasMetaAdsCredentials } from '@/lib/meta-ads/insights';
import { getGoogleAccessToken } from '@/lib/google/oauth';
import {
  buscarMetricasGmn,
  buscarSerieDiariaGmn,
  somarMetricas,
  type MetricasGmn,
} from '@/lib/google/business-profile';

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

// ── Cálculo [GMN] Google Meu Negócio ────────────────────────────────────────

/**
 * Métricas da ficha do Google amarrada ao bar. Retorna null (e não zeros) em qualquer
 * situação de "não deu pra calcular" — bar sem ficha, token vencido, API sem acesso liberado.
 * Zerar aqui apagaria os números que o time digitou à mão, que é justamente o que não pode
 * acontecer enquanto a automação não estiver de pé.
 */
async function computeGmn(supabase: any, barId: number, inicio: string, fim: string) {
  const { data: conexao } = await supabase
    .schema('integrations')
    .from('google_oauth_tokens')
    .select('location_id, ativo')
    .eq('bar_id', barId)
    .maybeSingle();

  if (!conexao?.location_id || conexao.ativo === false) return null;

  const tk = await getGoogleAccessToken(supabase, barId);
  if ('error' in tk) throw new Error(`Google bar ${barId}: ${tk.error}`);

  const metricas = await buscarMetricasGmn(tk.token, conexao.location_id, inicio, fim);

  await supabase
    .schema('integrations')
    .from('google_oauth_tokens')
    .update({ ultima_sync_em: new Date().toISOString(), ultimo_erro: null, ultimo_erro_em: null })
    .eq('bar_id', barId);

  return metricas;
}

/**
 * JANELA MÓVEL do GMN: quantos dias pra trás o cron diário RE-grava toda vez.
 *
 * O Google fecha os últimos dias com atraso e ainda revisa números já publicados; um valor
 * lido hoje pode subir amanhã. Congelar a semana no dia em que ela acaba foi justamente o que
 * deixou o histórico digitado à mão menor que a realidade (semana 29/2026: 11.404 digitado vs
 * 15.171 real). Re-gravar ~10 semanas todo dia custa UMA chamada por bar e faz o número se
 * corrigir sozinho — não existe mais "valor congelado no momento errado".
 */
const GMN_JANELA_DIAS = Number(process.env.GMN_JANELA_DIAS || 70);

/**
 * Janela móvel do [O] orgânico, em semanas. Mesmo princípio do GMN acima: o alcance de um post
 * continua subindo semanas depois de publicado (bar 3, semana 26: 69.963 gravados contra 79.487
 * reais), e post atrasado ainda entra no sync do Instagram depois da semana fechar. Recalcular é
 * só leitura de banco, então sai barato.
 */
const ORGANICO_JANELA_SEMANAS = Number(process.env.ORGANICO_JANELA_SEMANAS || 12);

/**
 * Piso da janela: a recontagem NUNCA passa dessa data.
 *
 * Antes de 21/07/2026 o marketing semanal era DIGITADO À MÃO a partir do Reportei — dá pra ver no
 * created_at das linhas (segunda/terça depois de cada semana, uma a uma) contra as linhas do cron
 * (11:00 em ponto). Reportei conta de um jeito e o "jeito Zykor" (Feed + Reels somados) conta de
 * outro, então recalcular aquelas semanas não corrigiria nada: apagaria o histórico que a equipe
 * validou, contra a regra de nunca sobrescrever campo manual.
 *
 * Por isso julho continua sem bater com a aba Comunicação nas semanas 27–29: são de fonte diferente.
 * Quem quiser passar o histórico para o cálculo automático faz de propósito, movendo esta data.
 */
const ORGANICO_DESDE = process.env.ORGANICO_DESDE || '2026-07-20';

/** Janela do [M] mídia. Menor porque cada semana é uma chamada à API da Meta e a atribuição
 *  assenta em ~28 dias — reprocessar 12 semanas todo dia seria gasto sem retorno. */
const MIDIA_JANELA_SEMANAS = Number(process.env.MIDIA_JANELA_SEMANAS || 5);

/** Segunda-feira da semana ISO de uma data (YYYY-MM-DD). */
function segundaDa(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dow + 1);
  return toISODate(d);
}

async function registrarErroGoogle(supabase: any, barId: number, msg: string) {
  await supabase
    .schema('integrations')
    .from('google_oauth_tokens')
    .update({ ultimo_erro: msg.slice(0, 500), ultimo_erro_em: new Date().toISOString() })
    .eq('bar_id', barId);
}

/**
 * Regrava as métricas do Google de TODAS as semanas do período, numa chamada só.
 * Serve tanto pro backfill do histórico (18 meses) quanto pra janela móvel do cron diário.
 *
 * Duas proteções que não podem sair daqui:
 *  1. `inicio` é puxado pra segunda-feira da semana ISO — começar no meio da semana gravaria
 *     um total parcial por cima de uma semana que já estava completa;
 *  2. semana sem NENHUM dia consolidado simplesmente não é escrita (em vez de virar zero),
 *     senão o backfill zeraria as semanas anteriores à existência da ficha.
 *
 * Escreve SÓ as colunas gmn_* (+ chave e datas): o upsert do PostgREST atualiza apenas as
 * colunas enviadas, então [O] Orgânico, [M] Mídia e os stories manuais ficam intactos.
 */
export async function syncGmnPeriodo(barId: number, inicio: string, fim: string) {
  const supabase = createServiceRoleClient();

  const { data: conexao } = await (supabase as any)
    .schema('integrations')
    .from('google_oauth_tokens')
    .select('location_id, ativo')
    .eq('bar_id', barId)
    .maybeSingle();

  if (!conexao?.location_id || conexao.ativo === false) {
    return { barId, skipped: true, motivo: 'sem ficha do Google vinculada' };
  }

  const tk = await getGoogleAccessToken(supabase, barId);
  if ('error' in tk) throw new Error(`Google bar ${barId}: ${tk.error}`);

  const de = segundaDa(inicio);
  const serie = await buscarSerieDiariaGmn(tk.token, conexao.location_id, de, fim);

  // Agrupa os dias consolidados por semana ISO
  const porSemana = new Map<string, { ano: number; semana: number; dias: MetricasGmn[] }>();
  for (const dia of serie) {
    const { ano, semana } = isoWeekOf(new Date(`${dia.data}T00:00:00Z`));
    const chave = `${ano}-${semana}`;
    const atual = porSemana.get(chave) ?? { ano, semana, dias: [] };
    atual.dias.push(dia.metricas);
    porSemana.set(chave, atual);
  }

  const linhas = [...porSemana.values()].map(({ ano, semana, dias }) => {
    const { inicio: ini, fim: f } = isoWeekRange(ano, semana);
    return {
      bar_id: barId,
      ano,
      semana,
      data_inicio: ini,
      data_fim: f,
      ...somarMetricas(dias),
    };
  });

  if (!linhas.length) {
    return { barId, inicio: de, fim, semanas: 0, dias: 0, motivo: 'sem dia consolidado no período' };
  }

  const { error } = await (supabase as any)
    .schema('meta')
    .from('marketing_semanal')
    .upsert(linhas, { onConflict: 'bar_id,ano,semana' });

  if (error) throw new Error(`marketing_semanal GMN bar ${barId}: ${error.message}`);

  await (supabase as any)
    .schema('integrations')
    .from('google_oauth_tokens')
    .update({ ultima_sync_em: new Date().toISOString(), ultimo_erro: null, ultimo_erro_em: null })
    .eq('bar_id', barId);

  const ordenadas = linhas.map((l) => `${l.ano}-W${String(l.semana).padStart(2, '0')}`).sort();
  return {
    barId,
    inicio: de,
    fim,
    dias: serie.length,
    semanas: linhas.length,
    primeira: ordenadas[0],
    ultima: ordenadas[ordenadas.length - 1],
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

/** bar_ids com ficha do Google Meu Negócio conectada E amarrada. */
async function gmnBars(supabase: any): Promise<number[]> {
  const { data } = await supabase
    .schema('integrations')
    .from('google_oauth_tokens')
    .select('bar_id')
    .eq('ativo', true)
    .not('location_id', 'is', null);
  return (data ?? []).map((r: any) => Number(r.bar_id)).filter(Boolean);
}

/**
 * Fontes disponíveis por bar: [O] só se tem IG ativo, [M] só se tem conta de anúncio,
 * [GMN] só se tem ficha do Google escolhida.
 */
export async function barSources(
  barId: number,
): Promise<{ organico: boolean; midia: boolean; gmn: boolean }> {
  const supabase = createServiceRoleClient();
  const { data } = await (supabase as any)
    .schema('integrations')
    .from('instagram_contas')
    .select('bar_id')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .limit(1);
  const gmn = (await gmnBars(supabase)).includes(barId);
  return { organico: !!(data && data.length), midia: adsAccountBars().includes(barId), gmn };
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
  opts: { organico?: boolean; midia?: boolean; gmn?: boolean } = {},
) {
  const incOrganico = opts.organico ?? true;
  const incMidia = opts.midia ?? true;
  const incGmn = opts.gmn ?? true;

  const supabase = createServiceRoleClient();
  const { inicio, fim } = isoWeekRange(ano, semana);

  const org = incOrganico ? await computeOrganico(supabase, barId, inicio, fim) : null;
  const midia = incMidia ? await computeMidia(barId, inicio, fim).catch(() => null) : null;
  // Falha do Google não pode derrubar [O]/[M], que já funcionam — registra e segue sem o bloco.
  const gmn = incGmn
    ? await computeGmn(supabase, barId, inicio, fim).catch(async (e) => {
        console.error(`[marketing-sync] GMN bar ${barId} ${ano}-W${semana}:`, e?.message);
        await registrarErroGoogle(supabase, barId, String(e?.message || e));
        return null;
      })
    : null;

  // Nada calculável pra esse bar → não escreve (não zera nada manual)
  if (!org && !midia && !gmn) {
    return { barId, ano, semana, inicio, fim, org: null, midia: null, gmn: null, skipped: true };
  }

  const payload = { bar_id: barId, ano, semana, ...(org ?? {}), ...(midia ?? {}), ...(gmn ?? {}) };
  const { error } = await (supabase as any)
    .schema('meta')
    .from('marketing_semanal')
    .upsert(payload, { onConflict: 'bar_id,ano,semana' });

  if (error) throw new Error(`marketing_semanal bar ${barId} ${ano}-W${semana}: ${error.message}`);
  return { barId, ano, semana, inicio, fim, org, midia: midia ?? null, gmn: gmn ?? null };
}

/**
 * Sincroniza semana atual + anterior (para pegar assentamento de atribuição da Meta, o
 * crescimento de alcance dos posts recentes e a consolidação atrasada do Google) de todos os
 * bares com IG ativo, conta de anúncio ou ficha do Google.
 */
export async function syncMarketingTodos() {
  const supabase = createServiceRoleClient();

  const { data: contas } = await (supabase as any)
    .schema('integrations')
    .from('instagram_contas')
    .select('bar_id')
    .eq('ativo', true);

  // Bares com IG ativo (recebem [O]), com conta de anúncio (recebem [M]) e com ficha do Google
  // amarrada (recebem [GMN]) — cada bloco é preenchido só onde a fonte existe, pra não zerar
  // os dados manuais dos outros.
  const igBars = new Set<number>((contas ?? []).map((c: any) => Number(c.bar_id)).filter(Boolean));
  const adsBars = new Set<number>(adsAccountBars());
  const googleBars = new Set<number>(await gmnBars(supabase));
  const bars = new Set<number>([...igBars, ...adsBars, ...googleBars]);

  const hoje = new Date();
  // Janela móvel também no [O]/[M] — mesma razão do [GMN] logo abaixo: reprocessar só a semana
  // atual + a anterior congelava o passado num momento em que o número ainda não estava pronto.
  //
  // Diogo, 13/08/2026: "o alcance tá maior na de comunicação". A aba Comunicação lê ao vivo e a
  // Desempenho lia a linha congelada. Bar 3, semana 28: a tabela tinha 15.018 de alcance e 4 posts;
  // ao vivo eram 27.793 e 5 posts. Duas coisas mudam depois da semana fechar — o alcance do post
  // segue crescendo por semanas, e post atrasado ainda entra no sync do Instagram.
  const semanasAtras = (n: number) => isoWeekOf(new Date(hoje.getTime() - n * 7 * 86400000));
  const janelaOrganico = Array.from({ length: ORGANICO_JANELA_SEMANAS }, (_, i) => semanasAtras(i))
    // não passa do piso: semana anterior à automação foi digitada à mão (ver ORGANICO_DESDE)
    .filter((w) => isoWeekRange(w.ano, w.semana).inicio >= ORGANICO_DESDE)
    .reverse();

  const resultados: any[] = [];
  for (const barId of bars) {
    // gmn: false — o Google não vai mais por semana aqui embaixo, e sim pela janela móvel
    // logo adiante (uma chamada cobre várias semanas e ainda corrige as passadas).
    for (let i = janelaOrganico.length - 1; i >= 0; i--) {
      const w = janelaOrganico[i];
      const idade = janelaOrganico.length - 1 - i; // 0 = semana atual
      const opts = {
        organico: igBars.has(barId),
        // [M] tem custo de chamada na API da Meta e a atribuição assenta em ~28 dias — não vale
        // reprocessar 12 semanas todo dia.
        midia: adsBars.has(barId) && idade < MIDIA_JANELA_SEMANAS,
        gmn: false,
      };
      if (!opts.organico && !opts.midia) continue;
      try {
        resultados.push(await syncMarketingSemana(barId, w.ano, w.semana, opts));
      } catch (e: any) {
        resultados.push({ barId, ano: w.ano, semana: w.semana, erro: e?.message || String(e) });
      }
    }
  }

  // [GMN] janela móvel: regrava as últimas ~10 semanas de cada bar com ficha vinculada, pra
  // absorver a consolidação atrasada do Google. Falha aqui não derruba [O]/[M].
  const desde = toISODate(new Date(hoje.getTime() - GMN_JANELA_DIAS * 86400000));
  for (const barId of googleBars) {
    try {
      resultados.push({ gmn: await syncGmnPeriodo(barId, desde, toISODate(hoje)) });
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[marketing-sync] GMN janela bar ${barId}:`, msg);
      await registrarErroGoogle(supabase, barId, msg);
      resultados.push({ barId, gmn_erro: msg });
    }
  }

  return resultados;
}
