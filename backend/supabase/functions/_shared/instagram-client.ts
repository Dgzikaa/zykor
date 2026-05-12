/**
 * Cliente compartilhado para Instagram Graph API.
 *
 * Cada bar tem sua própria auth (token salvo em integrations.instagram_contas),
 * porque os 2 bares (Ordinário e Deboche) são negócios independentes com donos
 * diferentes. NUNCA usar token global do env para puxar dados de um bar.
 */

// Apps via "Use Case Instagram" (novo modelo Meta 2024-2025) usam
// graph.instagram.com direto, não graph.facebook.com. Mantém v22.0
// (versão atual). Endpoints como /me, /me/media, /{media_id}/insights
// funcionam aqui sem precisar da Facebook Page intermediária.
const IG_API_BASE = 'https://graph.instagram.com/v22.0';

export interface IgContaConfig {
  bar_id: number;
  ig_business_id: string;
  ig_username: string | null;
  facebook_page_id: string;
  access_token: string;
  expires_at: string | null;
  ativo: boolean;
}

export interface SupabaseLike {
  from: (t: string) => any;
  schema?: (s: string) => SupabaseLike;
}

/**
 * Busca todas as contas IG ativas. Cada cron itera sobre elas.
 */
export async function listarContasAtivas(supabase: SupabaseLike): Promise<IgContaConfig[]> {
  const { data, error } = await supabase
    .from('instagram_contas')
    .select('bar_id, ig_business_id, ig_username, facebook_page_id, access_token, expires_at, ativo')
    .eq('ativo', true);
  if (error) {
    console.error('[ig-client] erro listando contas:', error);
    return [];
  }
  return (data || []) as IgContaConfig[];
}

/**
 * GET genérico na Graph API com token.
 */
export async function igGet<T = any>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const qs = new URLSearchParams({ access_token: accessToken });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const url = `${IG_API_BASE}/${path}?${qs.toString()}`;
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`IG API ${res.status}: ${txt.slice(0, 500)}`);
  }
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error(`IG API resposta não-JSON: ${txt.slice(0, 200)}`);
  }
}

/**
 * Pagina por todos os edges (`/{id}/media`, `/{id}/stories`, etc) seguindo
 * `paging.next` até o fim ou até limite.
 */
export async function igGetAllPaged<T = any>(
  path: string,
  accessToken: string,
  params: Record<string, string | number> = {},
  maxPages = 20,
): Promise<T[]> {
  const todos: T[] = [];
  let proxima = `${IG_API_BASE}/${path}?${new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    access_token: accessToken,
  }).toString()}`;
  let pagina = 0;
  while (proxima && pagina < maxPages) {
    const res = await fetch(proxima);
    const json = await res.json();
    if (!res.ok) throw new Error(`IG paged ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
    if (Array.isArray(json.data)) todos.push(...json.data);
    proxima = json?.paging?.next || '';
    pagina++;
  }
  return todos;
}

/**
 * Cria entry em integrations.instagram_sync_logs no início e
 * retorna função pra fechar com status no fim.
 */
export async function startSyncLog(
  supabase: SupabaseLike,
  barId: number | null,
  tipo: 'posts' | 'stories' | 'post_insights' | 'account',
) {
  const inicio = Date.now();
  const { data, error } = await supabase
    .from('instagram_sync_logs')
    .insert({
      bar_id: barId,
      tipo_sync: tipo,
      status: 'success',
      iniciado_em: new Date().toISOString(),
    })
    .select('id')
    .single();
  const logId = error ? null : (data as any)?.id;
  if (error) console.warn('[ig-client] erro criando log:', error);
  return {
    finalizar: async (resultado: {
      status: 'success' | 'partial' | 'error';
      itens_processados?: number;
      itens_novos?: number;
      itens_atualizados?: number;
      erro_mensagem?: string;
      raw_response?: unknown;
    }) => {
      if (!logId) return;
      await supabase
        .from('instagram_sync_logs')
        .update({
          status: resultado.status,
          itens_processados: resultado.itens_processados ?? 0,
          itens_novos: resultado.itens_novos ?? 0,
          itens_atualizados: resultado.itens_atualizados ?? 0,
          erro_mensagem: resultado.erro_mensagem ?? null,
          duracao_ms: Date.now() - inicio,
          concluido_em: new Date().toISOString(),
          raw_response: resultado.raw_response ?? null,
        })
        .eq('id', logId);
    },
  };
}

export async function marcarUltimaSync(
  supabase: SupabaseLike,
  barId: number,
) {
  await supabase
    .from('instagram_contas')
    .update({ ultima_sync_em: new Date().toISOString() })
    .eq('bar_id', barId);
}

/**
 * Detecta se erro é de token expirado/inválido.
 * IG retorna {error:{code:190,...}} ou {error:{type:'OAuthException'}}.
 */
export function isTokenInvalido(err: unknown): boolean {
  const s = String(err);
  return s.includes('"code":190') || s.includes('OAuthException') || s.includes('Session has expired');
}
