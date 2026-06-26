import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cliente administrativo do Supabase (usa service role key)
let adminClient: SupabaseClient | null = null;

async function getAdminClient(): Promise<SupabaseClient> {
  if (adminClient) {
    return adminClient;
  }

  // SEMPRE usar variáveis de ambiente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias'
    );
  }

  try {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('✅ Cliente administrativo Supabase inicializado');
    return adminClient;
  } catch (error) {
    console.error('❌ Erro ao inicializar cliente administrativo:', error);
    throw error;
  }
}

// Função helper para rotas API (evita inicialização no módulo)
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis de ambiente Supabase não configuradas');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
