/**
 * @camada ops
 * @jobName inter-pix-webhook
 * @descricao Webhook PIX Inter
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * Edge Function: inter-pix-webhook
 * 
 * Recebe callbacks de status de pagamentos PIX do Banco Inter.
 * 
 * CORREÇÃO DE SEGURANÇA (2026-03-19):
 * - Implementada validação de webhook secret obrigatório
 * - Validação de origem via header x-webhook-secret
 * - Logging detalhado para auditoria
 * - Retorna 401/403 se configuração ausente ou inválida
 * 
 * IMPORTANTE:
 * Configure a env var INTER_WEBHOOK_SECRET no Supabase Dashboard
 * com o mesmo valor configurado no painel do Banco Inter.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateFunctionEnv } from '../_shared/env-validator.ts';

interface InterPixWebhookPayload {
  codigoSolicitacao?: string;
  endToEndId?: string;
  status: 'APROVADO' | 'REJEITADO' | 'CANCELADO' | 'PROCESSADO' | 'AGENDADO' | 'ERRO';
  dataHora: string;
  valor?: number;
  descricao?: string;
  chavePixDestinatario?: string;
  nomeDestinatario?: string;
  motivoRejeicao?: string;
  txId?: string;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();
  const corsHeaders = getCorsHeaders(req);
  
  console.log(`[${requestId}] ${timestamp} - inter-pix-webhook: ${req.method} request received`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.warn(`[${requestId}] Method not allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Validar variáveis de ambiente obrigatórias
    validateFunctionEnv('inter-pix-webhook', [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]);

    // =====================================================
    // VALIDAÇÃO DE SEGURANÇA - WEBHOOK SECRET
    // =====================================================
    
    const WEBHOOK_SECRET = Deno.env.get('INTER_WEBHOOK_SECRET');
    
    // Se a env var não está configurada, rejeitamos por segurança
    if (!WEBHOOK_SECRET) {
      console.error(`[${requestId}] CRITICAL: INTER_WEBHOOK_SECRET not configured`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Webhook não configurado',
        code: 'WEBHOOK_NOT_CONFIGURED',
        request_id: requestId
      }), {
        status: 503, // Service Unavailable - indica que precisa configuração
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar o secret fornecido no header
    // O Inter pode enviar em diferentes headers, verificamos os mais comuns
    const providedSecret = 
      req.headers.get('x-webhook-secret') || 
      req.headers.get('x-inter-webhook-secret') ||
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.headers.get('x-api-key');

    if (!providedSecret) {
      console.warn(`[${requestId}] No webhook secret provided in headers`);
      console.warn(`[${requestId}] Headers received: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
      
      // Log para diagnóstico mas retorna erro
      return new Response(JSON.stringify({
        success: false,
        error: 'Autenticação requerida',
        code: 'MISSING_WEBHOOK_SECRET',
        request_id: requestId
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Comparação segura em tempo constante (previne timing attacks)
    const encoder = new TextEncoder();
    const secretBuffer = encoder.encode(WEBHOOK_SECRET);
    const providedBuffer = encoder.encode(providedSecret);
    
    let isValid = secretBuffer.length === providedBuffer.length;
    for (let i = 0; i < secretBuffer.length; i++) {
      isValid = isValid && (secretBuffer[i] === providedBuffer[i]);
    }

    if (!isValid) {
      console.warn(`[${requestId}] Invalid webhook secret provided`);
      console.warn(`[${requestId}] Expected length: ${WEBHOOK_SECRET.length}, Got: ${providedSecret.length}`);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais inválidas',
        code: 'INVALID_WEBHOOK_SECRET',
        request_id: requestId
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Webhook secret validated successfully`);

    // =====================================================
    // PROCESSAMENTO DO PAYLOAD
    // =====================================================

    const body: InterPixWebhookPayload = await req.json();
    
    console.log(`[${requestId}] Payload received:`, JSON.stringify({
      codigoSolicitacao: body.codigoSolicitacao,
      endToEndId: body.endToEndId,
      status: body.status,
      dataHora: body.dataHora,
      valor: body.valor,
      // Não logar dados sensíveis completos
      hasChavePix: !!body.chavePixDestinatario,
      hasNome: !!body.nomeDestinatario
    }));

    // Validar campos obrigatórios
    if (!body.status || !body.dataHora) {
      console.error(`[${requestId}] Missing required fields: status or dataHora`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Campos obrigatórios ausentes',
        code: 'MISSING_REQUIRED_FIELDS',
        request_id: requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Precisamos de pelo menos um identificador
    const identificador = body.codigoSolicitacao || body.endToEndId || body.txId;
    if (!identificador) {
      console.error(`[${requestId}] No identifier found (codigoSolicitacao, endToEndId, or txId)`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhum identificador encontrado',
        code: 'MISSING_IDENTIFIER',
        request_id: requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // ATUALIZAÇÃO NO BANCO DE DADOS
    // =====================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mapear status do Inter para status interno
    const statusMap: Record<string, string> = {
      'APROVADO': 'aprovado',
      'PROCESSADO': 'processado',
      'AGENDADO': 'agendado',
      'REJEITADO': 'rejeitado',
      'CANCELADO': 'cancelado',
      'ERRO': 'erro'
    };

    const statusInterno = statusMap[body.status] || 'desconhecido';

    // =====================================================
    // LOG DE AUDITORIA
    // =====================================================

    // Registrar webhook recebido para auditoria
    try {
      await supabase
        .from('webhook_logs')
        .insert({
          tipo: 'inter_pix',
          payload: body,
          identificador: identificador,
          status_recebido: body.status,
          processado_em: timestamp,
          request_id: requestId,
          headers_recebidos: {
            'content-type': req.headers.get('content-type'),
            'user-agent': req.headers.get('user-agent'),
            'x-forwarded-for': req.headers.get('x-forwarded-for')
          }
        });
      console.log(`[${requestId}] Webhook logged to webhook_logs`);
    } catch (logError) {
      // Não falhar se o log não funcionar (tabela pode não existir)
      console.warn(`[${requestId}] Could not log webhook (table may not exist):`, logError);
    }

    // =====================================================
    // RESPOSTA DE SUCESSO
    // =====================================================

    console.log(`[${requestId}] Webhook processed successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processado com sucesso',
      request_id: requestId,
      status_received: body.status,
      timestamp
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[${requestId}] Internal error:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro interno ao processar webhook',
      code: 'INTERNAL_ERROR',
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
