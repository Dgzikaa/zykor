/**
 * Helper para gerar URLs de Edge Functions do Supabase
 * NUNCA use URLs hardcoded - sempre use esta função
 */

/**
 * Retorna a URL base das Edge Functions do Supabase
 * Exemplo: https://[project-id].supabase.co/functions/v1
 */
export function getSupabaseFunctionsUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não está configurada');
  }

  // Extrair o project ID da URL
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  
  if (!match) {
    throw new Error('URL do Supabase inválida');
  }

  const projectId = match[1];
  return `https://${projectId}.supabase.co/functions/v1`;
}

/**
 * Retorna a URL completa de uma Edge Function específica
 * @param functionName - Nome da função (ex: 'contahub-sync')
 */
export function getSupabaseFunctionUrl(functionName: string): string {
  return `${getSupabaseFunctionsUrl()}/${functionName}`;
}

/**
 * Retorna o Project ID do Supabase
 */
export function getSupabaseProjectId(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não está configurada');
  }

  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  
  if (!match) {
    throw new Error('URL do Supabase inválida');
  }

  return match[1];
}
