import { createClient } from '@supabase/supabase-js';

// Cliente Supabase - SEMPRE usar variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias'
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface ApiCredentials {
  id: string;
  bar_id: string;
  servico: string;
  api_key?: string;
  client_id?: string;
  client_secret?: string;
  organization_id?: string;
  conta_corrente?: string;
  webhook_url?: string;
  configuracoes?: Record<string, any>;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Busca credenciais de uma API específica para um bar
 */
export async function getApiCredentials(
  barId: string,
  servico: string
): Promise<ApiCredentials | null> {
  try {
    const { data, error } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('bar_id', barId)
      .eq('sistema', servico)
      .eq('ativo', true)
      .single();

    if (error) {
      console.error(`❌ Erro ao buscar credenciais ${servico}:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`❌ Erro ao buscar credenciais ${servico}:`, error);
    return null;
  }
}

/**
 * Busca credenciais do Inter
 */
export async function getInterCredentials(barId: string): Promise<{
  client_id: string;
  client_secret: string;
  conta_corrente: string;
} | null> {
  const creds = await getApiCredentials(barId, 'inter');

  if (
    !creds ||
    !creds.client_id ||
    !creds.client_secret ||
    !creds.configuracoes?.conta_corrente
  ) {
    console.error('❌ Credenciais do Inter incompletas ou não encontradas');
    return null;
  }

  return {
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    conta_corrente: creds.configuracoes.conta_corrente,
  };
}

/**
 * Busca credenciais do ContaHub
 */
export async function getContaHubCredentials(barId: string): Promise<{
  email: string;
  password: string;
} | null> {
  const creds = await getApiCredentials(barId, 'contahub');

  if (!creds || !creds.api_key) {
    console.error('❌ Credenciais do ContaHub não encontradas');
    return null;
  }

  // api_key contém email:password
  const [email, password] = creds.api_key.split(':');

  if (!email || !password) {
    console.error('❌ Formato de credenciais do ContaHub inválido');
    return null;
  }

  return { email, password };
}

/**
 * Busca webhook URL de um serviço
 */
export async function getWebhookUrl(
  barId: string,
  servico: string
): Promise<string | null> {
  const creds = await getApiCredentials(barId, servico);
  return creds?.webhook_url || null;
}
