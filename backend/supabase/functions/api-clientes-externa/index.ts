/**
 * Edge Function: api-clientes-externa
 * 
 * API para acesso externo a dados de clientes.
 * REQUER autenticação via API Key na env var API_KEY_CLIENTES_EXTERNA.
 * 
 * CORREÇÃO DE SEGURANÇA (2026-03-19):
 * - Removido fallback hardcoded de API key
 * - Agora requer env var obrigatória
 * - Retorna erro explícito se env var não configurada
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // CORREÇÃO DE SEGURANÇA: API Key DEVE vir da env var, sem fallback
    const API_KEY = Deno.env.get('API_KEY_CLIENTES_EXTERNA');
    
    if (!API_KEY) {
      console.error('ERRO DE CONFIGURAÇÃO: API_KEY_CLIENTES_EXTERNA não está definida');
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuração de segurança ausente. Contate o administrador.',
        code: 'MISSING_CONFIG'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar autenticação via header x-api-key
    const providedKey = req.headers.get('x-api-key');
    
    if (!providedKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'API Key não fornecida. Use o header x-api-key.',
        code: 'MISSING_API_KEY'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (providedKey !== API_KEY) {
      console.warn('Tentativa de acesso com API Key inválida');
      return new Response(JSON.stringify({
        success: false,
        error: 'API Key inválida.',
        code: 'INVALID_API_KEY'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Autenticação OK - processar requisição
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const barId = parseInt(url.searchParams.get('bar_id') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!barId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Parâmetro bar_id é obrigatório',
        code: 'MISSING_BAR_ID'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar dados de clientes (apenas dados não sensíveis)
    const { data, error, count } = await supabase
      .from('clientes')
      .select('id, nome, telefone, email, data_cadastro, total_visitas, ultima_visita', { count: 'exact' })
      .eq('bar_id', barId)
      .order('ultima_visita', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao buscar dados',
        code: 'DATABASE_ERROR'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      bar_id: barId,
      total: count,
      limit,
      offset,
      data: data || [],
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na api-clientes-externa:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
