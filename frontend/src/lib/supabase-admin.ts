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

export { getAdminClient, createServiceRoleClient };
