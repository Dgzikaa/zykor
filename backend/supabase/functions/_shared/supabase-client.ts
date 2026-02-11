/**
 * 🗄️ MÓDULO COMPARTILHADO - CLIENTE SUPABASE
 * 
 * Este módulo fornece um cliente Supabase configurado para Edge Functions.
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Cria um cliente Supabase com service role (acesso total)
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Busca todos os bares ativos
 */
export async function getBarsAtivos(
  supabase: SupabaseClient,
  barId?: number
): Promise<{ id: number; nome: string }[]> {
  const { data: todosOsBares, error } = await supabase
    .from('bars')
    .select('id, nome')
    .eq('ativo', true)
  
  if (error) {
    throw new Error(`Erro ao buscar bares: ${error.message}`)
  }
  
  if (!todosOsBares?.length) {
    throw new Error('Nenhum bar ativo encontrado')
  }
  
  return barId 
    ? todosOsBares.filter(b => b.id === barId)
    : todosOsBares
}

/**
 * Busca configuração de API para um sistema específico
 */
export async function getApiConfig(
  supabase: SupabaseClient,
  sistema: string,
  barId: number
): Promise<{ configuracoes: Record<string, unknown> } | null> {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('configuracoes')
    .eq('sistema', sistema)
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.warn(`Erro ao buscar config ${sistema} para bar ${barId}:`, error.message)
  }
  
  return data
}
