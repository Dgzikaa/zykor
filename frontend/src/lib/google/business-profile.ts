/**
 * Google Meu Negócio (Business Profile) — listagem de fichas e métricas diárias.
 *
 * Três APIs distintas, cada uma com seu host (o Google fatiou o antigo "My Business API"):
 *   - mybusinessaccountmanagement  → contas que o usuário administra
 *   - mybusinessbusinessinformation → fichas (locations) de cada conta
 *   - businessprofileperformance    → as métricas que alimentam gmn_*
 *
 * ACESSO: essas APIs nascem com quota ZERO em qualquer projeto novo do Google Cloud. Além de
 * habilitar cada uma no console, é preciso enviar o formulário de acesso à Business Profile API
 * e ser aprovado. Sem isso a resposta é PERMISSION_DENIED / quota 0 — foi exatamente o que
 * travou a tentativa de fev/2026 (account_id e location_id ficaram NULL no banco). Por isso
 * `traduzirErroGoogle` existe: sem ela o erro chega na tela como um JSON cru indecifrável.
 */

const ACCOUNTS_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const PERFORMANCE_API = 'https://businessprofileperformance.googleapis.com/v1';

export interface GoogleLocation {
  /** Nome do recurso: "locations/12345678" */
  name: string;
  /** Título da ficha, ex: "Ordinário Bar" */
  title: string;
  endereco: string | null;
  /** Conta dona da ficha: "accounts/98765" */
  accountName: string;
  accountNome: string | null;
}

/** Erro das APIs do Google traduzido pra instrução acionável. */
export function traduzirErroGoogle(payload: any): string {
  const status = payload?.error?.status || '';
  const msg: string = payload?.error?.message || '';

  if (status === 'PERMISSION_DENIED' || /permission/i.test(msg)) {
    return 'O Google recusou o acesso (PERMISSION_DENIED). Normalmente é a Business Profile API sem acesso aprovado no projeto, ou a conta autorizada não é gerente da ficha.';
  }
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg) || status === 'FAILED_PRECONDITION') {
    return 'API não habilitada no projeto do Google Cloud. Habilite My Business Account Management, My Business Business Information e Business Profile Performance.';
  }
  if (status === 'RESOURCE_EXHAUSTED' || /quota/i.test(msg)) {
    return 'Quota zerada para as Business Profile APIs — é o estado padrão de projeto novo. Envie o formulário de solicitação de acesso ao Google.';
  }
  if (status === 'UNAUTHENTICATED' || /invalid credentials|token/i.test(msg)) {
    return 'Token do Google inválido ou expirado. Reconecte a integração.';
  }
  return msg || 'Erro desconhecido na API do Google.';
}

async function googleGet(url: string, token: string): Promise<any> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json?.error) throw new Error(traduzirErroGoogle(json));
  return json;
}

/**
 * Todas as fichas visíveis pela conta conectada, de todas as contas que ela administra.
 * Uma conta de gestão costuma enxergar as fichas de TODOS os bares — por isso a escolha de qual
 * ficha pertence a qual bar é manual, na tela; adivinhar por nome erraria em rede com marcas
 * parecidas.
 */
export async function listarFichas(token: string): Promise<GoogleLocation[]> {
  const contas = await googleGet(`${ACCOUNTS_API}/accounts?pageSize=100`, token);
  const out: GoogleLocation[] = [];

  for (const conta of contas?.accounts ?? []) {
    // readMask é OBRIGATÓRIO nessa API — sem ele a chamada volta 400.
    const url =
      `${INFO_API}/${conta.name}/locations` +
      `?readMask=name,title,storefrontAddress&pageSize=100`;
    const locs = await googleGet(url, token);
    for (const l of locs?.locations ?? []) {
      const addr = l.storefrontAddress;
      out.push({
        name: l.name,
        title: l.title || l.name,
        endereco: addr
          ? [addr.addressLines?.join(', '), addr.locality, addr.administrativeArea]
              .filter(Boolean)
              .join(' - ')
          : null,
        accountName: conta.name,
        accountNome: conta.accountName || null,
      });
    }
  }
  return out;
}

/**
 * Métricas diárias da Performance API, já somadas no período e mapeadas pras colunas gmn_*.
 *
 * Cuidados desta API:
 *  - devolve no máximo os últimos ~18 meses;
 *  - os últimos ~2-3 dias ainda não fecharam (o Google consolida com atraso) e vão SUBINDO
 *    depois; foi exatamente isso que fez os números digitados à mão ficarem menores que os
 *    reais — por isso a janela é ressincronizada todo dia, não uma vez só;
 *  - `value` vem AUSENTE (não zero) tanto em dia sem ocorrência quanto em dia não consolidado.
 */
export interface MetricasGmn {
  gmn_visu_pesquisa: number;
  gmn_visu_maps: number;
  gmn_total_visualizacoes: number;
  gmn_solicitacoes_rotas: number;
  gmn_ligacoes: number;
  gmn_cliques_website: number;
  gmn_menu_views: number;
  gmn_total_acoes: number;
}

const METRICAS_DIARIAS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_FOOD_MENU_CLICKS',
] as const;

function paramsPeriodo(inicio: string, fim: string): URLSearchParams {
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fim.split('-').map(Number);

  const params = new URLSearchParams();
  for (const m of METRICAS_DIARIAS) params.append('dailyMetrics', m);
  params.set('dailyRange.start_date.year', String(ai));
  params.set('dailyRange.start_date.month', String(mi));
  params.set('dailyRange.start_date.day', String(di));
  params.set('dailyRange.end_date.year', String(af));
  params.set('dailyRange.end_date.month', String(mf));
  params.set('dailyRange.end_date.day', String(df));
  return params;
}

/** Soma bruta por métrica → colunas gmn_*. */
function montarMetricas(v: (k: string) => number): MetricasGmn {
  const pesquisa = v('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') + v('BUSINESS_IMPRESSIONS_MOBILE_SEARCH');
  const maps = v('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') + v('BUSINESS_IMPRESSIONS_MOBILE_MAPS');
  const rotas = v('BUSINESS_DIRECTION_REQUESTS');
  const ligacoes = v('CALL_CLICKS');
  const website = v('WEBSITE_CLICKS');
  const menu = v('BUSINESS_FOOD_MENU_CLICKS');

  return {
    gmn_visu_pesquisa: pesquisa,
    gmn_visu_maps: maps,
    gmn_total_visualizacoes: pesquisa + maps,
    gmn_solicitacoes_rotas: rotas,
    gmn_ligacoes: ligacoes,
    gmn_cliques_website: website,
    gmn_menu_views: menu,
    // "Ações" = o que a pessoa fez depois de achar a ficha. Mesma composição que o painel do
    // Google mostra como interações; não inclui as impressões (que são alcance, não ação).
    gmn_total_acoes: rotas + ligacoes + website + menu,
  };
}

export interface DiaGmn {
  /** YYYY-MM-DD */
  data: string;
  metricas: MetricasGmn;
}

/**
 * Série DIÁRIA do período, já mapeada pras colunas gmn_*. UMA chamada cobre o intervalo
 * inteiro (testado: 577 dias de uma vez), então backfill de 18 meses custa o mesmo que uma
 * semana — é por isso que o histórico é reconstruído inteiro em vez de semana a semana.
 *
 * Dias AINDA NÃO CONSOLIDADOS pelo Google chegam com o `value` ausente (não zero) e são
 * OMITIDOS daqui. Essa distinção é o coração da correção contínua: quem consome sabe
 * diferenciar "esse dia foi zero" de "esse dia ainda não fechou", e não grava um número
 * baixo como se fosse definitivo.
 */
export async function buscarSerieDiariaGmn(
  token: string,
  locationName: string,
  inicio: string,
  fim: string,
): Promise<DiaGmn[]> {
  const json = await googleGet(
    `${PERFORMANCE_API}/${locationName}:fetchMultiDailyMetricsTimeSeries?${paramsPeriodo(inicio, fim).toString()}`,
    token,
  );

  const porDia = new Map<string, Map<string, number>>();
  for (const multi of json?.multiDailyMetricTimeSeries ?? []) {
    for (const serie of multi?.dailyMetricTimeSeries ?? []) {
      for (const d of serie?.timeSeries?.datedValues ?? []) {
        if (d?.value === undefined || d?.value === null) continue; // dia ainda não fechado
        const dt = d.date;
        if (!dt?.year) continue;
        const data = `${dt.year}-${String(dt.month).padStart(2, '0')}-${String(dt.day).padStart(2, '0')}`;
        const m = porDia.get(data) ?? new Map<string, number>();
        m.set(serie.dailyMetric, (m.get(serie.dailyMetric) || 0) + (Number(d.value) || 0));
        porDia.set(data, m);
      }
    }
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, m]) => ({ data, metricas: montarMetricas((k) => m.get(k) || 0) }));
}

/** Total do período (soma da série diária). `locationName` = "locations/123". */
export async function buscarMetricasGmn(
  token: string,
  locationName: string,
  inicio: string,
  fim: string,
): Promise<MetricasGmn> {
  const serie = await buscarSerieDiariaGmn(token, locationName, inicio, fim);
  return somarMetricas(serie.map((d) => d.metricas));
}

/** Soma métricas já mapeadas (usado pra agregar dias em semana). */
export function somarMetricas(itens: MetricasGmn[]): MetricasGmn {
  const zero = montarMetricas(() => 0);
  return itens.reduce<MetricasGmn>((acc, m) => {
    for (const k of Object.keys(zero) as (keyof MetricasGmn)[]) acc[k] += m[k];
    return acc;
  }, { ...zero });
}
