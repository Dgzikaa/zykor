/**
 * 🎯 Unified Dispatcher - Dispatcher Central do Zykor
 * 
 * Consolida os 4 dispatchers anteriores em um único ponto de entrada:
 * - integracao: yuzer, sympla, nibo, getin
 * - sync: eventos, clientes, conhecimento, marketing
 * - discord: notification, command, pdf
 * - webhook: umbler, google-reviews
 * 
 * Request format:
 * { "domain": "integracao", "action": "nibo", ...params }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';



const ACTION_URLS: Record<string, Record<string, string>> = {
  integracao: {
    'yuzer': '/functions/v1/yuzer-sync',
    'sympla': '/functions/v1/sympla-sync',
    'nibo': '/functions/v1/nibo-sync',
    'getin': '/functions/v1/getin-sync-continuous',
  },
  sync: {
    'eventos': '/functions/v1/sync-eventos',
    'clientes': '/functions/v1/sync-cliente-estatisticas',
    'conhecimento': '/functions/v1/sync-conhecimento',
    'marketing': '/functions/v1/sync-marketing-meta',
  },
  discord: {
    'notification': '/functions/v1/discord-notification',
    'command': '/functions/v1/discord-commands',
    'pdf': '/functions/v1/relatorio-pdf',
  },
  webhook: {
    'umbler': '/functions/v1/umbler-webhook',
    'google-reviews': '/functions/v1/google-reviews-apify-sync',
  },
};

interface UnifiedDispatcherRequest {
  domain: string;
  action: string;
  [key: string]: unknown;
}

function getAvailableActions(): string {
  const lines: string[] = [];
  for (const [domain, actions] of Object.entries(ACTION_URLS)) {
    lines.push(`  ${domain}: ${Object.keys(actions).join(', ')}`);
  }
  return lines.join('\n');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;);
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body: UnifiedDispatcherRequest = await req.json();
    const { domain, action, ...params } = body;

    console.log(`🎯 Unified Dispatcher - Domain: ${domain}, Action: ${action}`);

    const hbResult = await heartbeatStart(
      supabase, 
      'unified-dispatcher', 
      null, 
      `${domain}/${action}`, 
      'pgcron'
    );
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    // Validar domain
    if (!domain || !ACTION_URLS[domain]) {
      await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, { error: 'domain_invalido' });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Domain inválido: ${domain}. Domains disponíveis: ${Object.keys(ACTION_URLS).join(', ')}`,
          available_actions: getAvailableActions(),
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar action dentro do domain
    const domainActions = ACTION_URLS[domain];
    if (!action || !domainActions[action]) {
      await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, { error: 'action_invalida' });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action inválida: ${action}. Actions disponíveis para ${domain}: ${Object.keys(domainActions).join(', ')}`,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const targetUrl = `${supabaseUrl}${domainActions[action]}`;
    
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

    await heartbeatEnd(
      supabase, 
      heartbeatId, 
      response.ok ? 'success' : 'error', 
      startTime, 
      1, 
      { domain, action, status: response.status }
    );
    
    return new Response(
      JSON.stringify({
        success: response.ok,
        domain,
        action,
        dispatched_to: domainActions[action],
        result,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro no unified dispatcher:', error);
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
