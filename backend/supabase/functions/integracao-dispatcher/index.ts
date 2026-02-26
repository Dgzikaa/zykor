/**
 * 🔗 Integração Dispatcher - Dispatcher Unificado para Integrações Externas
 * 
 * Centraliza chamadas para integrações externas (Yuzer, Sympla, NIBO, GetIn).
 * Mantém compatibilidade com funções existentes através de redirecionamento.
 * 
 * Actions disponíveis:
 * - yuzer: Sincronização Yuzer
 * - sympla: Sincronização Sympla
 * - nibo: Sincronização NIBO
 * - getin: Sincronização GetIn
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION_URLS: Record<string, string> = {
  'yuzer': '/functions/v1/yuzer-sync',
  'sympla': '/functions/v1/sympla-sync',
  'nibo': '/functions/v1/nibo-sync',
  'getin': '/functions/v1/getin-sync-continuous',
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

    console.log(`🔗 Integração Dispatcher - Action: ${action}`);

    if (!action || !ACTION_URLS[action]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action inválida: ${action}. Use: yuzer, sympla, nibo, getin`,
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
    console.error('❌ Erro no integração dispatcher:', error);
    
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
