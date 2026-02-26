/**
 * 🔄 Sync Dispatcher - Dispatcher Unificado para Sincronizações
 * 
 * Centraliza sincronizações diversas (eventos, clientes, conhecimento, marketing).
 * 
 * Actions disponíveis:
 * - eventos: Sincroniza eventos
 * - clientes: Sincroniza estatísticas de clientes
 * - conhecimento: Sincroniza base de conhecimento
 * - marketing: Sincroniza dados de marketing/Meta
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION_URLS: Record<string, string> = {
  'eventos': '/functions/v1/sync-eventos',
  'clientes': '/functions/v1/sync-cliente-estatisticas',
  'conhecimento': '/functions/v1/sync-conhecimento',
  'marketing': '/functions/v1/sync-marketing-meta',
};

interface DispatcherRequest {
  action: string;
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: DispatcherRequest = await req.json();
    const { action, ...params } = body;

    console.log(`🔄 Sync Dispatcher - Action: ${action}`);

    if (!action || !ACTION_URLS[action]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action inválida: ${action}. Use: eventos, clientes, conhecimento, marketing`,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const targetUrl = `${supabaseUrl}${ACTION_URLS[action]}`;
    
    console.log(`🔄 Redirecionando para: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(params),
    });
    
    const result = await response.json();
    
    return new Response(
      JSON.stringify({
        success: response.ok,
        action,
        dispatched_to: ACTION_URLS[action],
        result,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro no sync dispatcher:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
