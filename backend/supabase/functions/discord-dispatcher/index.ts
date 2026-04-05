/**
 * 💬 Discord Dispatcher - Dispatcher Unificado para Discord
 * 
 * Centraliza todas as operações Discord (notificações, comandos, PDFs).
 * 
 * Actions disponíveis:
 * - notification: Envia notificação simples
 * - command: Processa comando do Discord
 * - pdf: Gera e envia PDF
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { validateFunctionEnv } from '../_shared/env-validator.ts';
import { getCorsHeaders } from '../_shared/cors.ts';



const ACTION_URLS: Record<string, string> = {
  // 'notification' é processado inline (não redireciona)
  'command': '/functions/v1/discord-commands',
  'pdf': '/functions/v1/relatorio-pdf',
};

interface DispatcherRequest {
  action: string;
  [key: string]: any;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  try {
    // Validar variáveis de ambiente obrigatórias
    validateFunctionEnv('discord-dispatcher', [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const body: DispatcherRequest = await req.json();
    const { action, ...params } = body;

    console.log(`💬 Discord Dispatcher - Action: ${action}`);

    const hbResult = await heartbeatStart(supabase, 'discord-dispatcher', null, action, 'pgcron');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    if (!action || (!ACTION_URLS[action] && action !== 'notification')) {
      await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, { error: 'action_invalida' });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action inválida: ${action}. Use: notification, command, pdf`,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Handler inline para notification (não redireciona)
    if (action === 'notification') {
      const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
      if (!webhookUrl) {
        await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, { error: 'webhook_url_missing' });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'DISCORD_WEBHOOK_URL não configurada',
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const { title, custom_message, webhook_type } = params;
      const discordPayload = {
        embeds: [{
          title: title || 'Notificação Zykor',
          description: custom_message || 'Sem detalhes',
          color: title?.includes('✅') ? 0x00ff00 : title?.includes('⚠️') ? 0xffa500 : 0x0099ff,
          timestamp: new Date().toISOString()
        }]
      };

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload)
      });

      await heartbeatEnd(supabase, heartbeatId, webhookResponse.ok ? 'success' : 'error', startTime, 1, { action, status: webhookResponse.status });

      return new Response(
        JSON.stringify({
          success: webhookResponse.ok,
          action: 'notification',
          webhook_status: webhookResponse.status,
          timestamp: new Date().toISOString(),
        }),
        { 
          status: webhookResponse.ok ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Para outras actions, redirecionar
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
    console.error('❌ Erro no discord dispatcher:', error);
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
