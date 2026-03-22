/**
 * 🪝 Webhook Dispatcher - Dispatcher Unificado para Webhooks
 * 
 * Centraliza recebimento de webhooks externos (Umbler, Google Reviews).
 * 
 * Actions disponíveis:
 * - umbler: Webhook do Umbler
 * - google-reviews: Webhook do Google Reviews (Apify)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTION_URLS: Record<string, string> = {
  'umbler': '/functions/v1/umbler-webhook',
  'google-reviews': '/functions/v1/google-reviews-apify-sync',
};

interface DispatcherRequest {
  action: string;
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body: DispatcherRequest = await req.json();
    const { action, ...params } = body;

    console.log(`🪝 Webhook Dispatcher - Action: ${action}`);

    const hbResult = await heartbeatStart(supabase, 'webhook-dispatcher', null, action, 'pgcron');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    if (!action || !ACTION_URLS[action]) {
      await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, { error: 'action_invalida' });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action inválida: ${action}. Use: umbler, google-reviews`,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
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

    await heartbeatEnd(supabase, heartbeatId, response.ok ? 'success' : 'error', startTime, 1, { action, status: response.status });
    
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
    console.error('❌ Erro no webhook dispatcher:', error);
    await heartbeatError(supabase, heartbeatId, startTime, error instanceof Error ? error : String(error));
    
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
