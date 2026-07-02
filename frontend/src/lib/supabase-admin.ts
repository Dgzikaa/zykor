import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'async_hooks';

// Cliente administrativo do Supabase (usa service role key)
let adminClient: SupabaseClient | null = null;

/**
 * Contexto de auditoria por requisição. `authenticateUser` publica o usuário aqui
 * (enterWith) e o `getAdminClient` injeta os headers x-audit-* em cada chamada — assim
 * o trigger de auditoria no banco (system.fn_audit) sabe QUEM fez a escrita, sem precisar
 * alterar as centenas de rotas. Escritas sem esse contexto (ETL/cron/edge) não mandam o
 * header e por isso não são auditadas (é o gate que evita poluir a trilha com escrita de máquina).
 */
export interface AuditActor { email?: string; role?: string; bar_id?: number }
export const auditContext = new AsyncLocalStorage<{ actor: AuditActor; client?: SupabaseClient }>();

function novoServiceClient(headers?: Record<string, string>): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias'
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(headers ? { global: { headers } } : {}),
  });
}

async function getAdminClient(): Promise<SupabaseClient> {
  // Se há usuário autenticado no contexto da requisição, devolve um client que carrega
  // a identidade nos headers (pra o trigger de auditoria atribuir a escrita). Cacheado no
  // próprio store → 1 client por requisição.
  const store = auditContext.getStore();
  if (store?.actor?.email) {
    if (store.client) return store.client;
    store.client = novoServiceClient({
      'x-audit-email': store.actor.email,
      'x-audit-role': store.actor.role ?? '',
      'x-audit-bar': store.actor.bar_id != null ? String(store.actor.bar_id) : '',
    });
    return store.client;
  }

  if (adminClient) {
    return adminClient;
  }

  try {
    adminClient = novoServiceClient();
    console.log('✅ Cliente administrativo Supabase inicializado');
    return adminClient;
  } catch (error) {
    console.error('❌ Erro ao inicializar cliente administrativo:', error);
    throw error;
  }
}

// Função helper para rotas API (evita inicialização no módulo). Também carrega os headers
// de auditoria quando há usuário no contexto da requisição (mesma lógica do getAdminClient).
function createServiceRoleClient() {
  const store = auditContext.getStore();
  const headers = store?.actor?.email
    ? {
        'x-audit-email': store.actor.email,
        'x-audit-role': store.actor.role ?? '',
        'x-audit-bar': store.actor.bar_id != null ? String(store.actor.bar_id) : '',
      }
    : undefined;
  return novoServiceClient(headers);
}

/**
 * Pagina qualquer query PostgREST até esgotar (o PostgREST corta em ~1000 linhas por requisição).
 * Use sempre que a query puder retornar muitas linhas, senão o resultado vem truncado silenciosamente.
 *
 * Ex.: const rows = await selectAll((from, to) =>
 *        supabase.from('tabela').select('a,b').eq('bar_id', barId).range(from, to));
 */
async function selectAll<T = any>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export { getAdminClient, createServiceRoleClient, selectAll };
