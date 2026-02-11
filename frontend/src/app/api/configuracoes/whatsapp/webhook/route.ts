import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic'

// ========================================
// 📱 INTERFACES TYPESCRIPT
// ========================================

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}

interface WhatsAppEntry {
  changes?: WhatsAppChange[];
}

interface WhatsAppChange {
  value?: {
    metadata?: {
      phone_number_id?: string;
    };
    statuses?: WhatsAppStatus[];
    messages?: WhatsAppMessage[];
  };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  text?: {
    body: string;
  };
  type: string;
  timestamp: string;
}

interface WebhookLog {
  bar_id: number;
  webhook_type: string;
  payload: unknown;
  processado: boolean;
  ip_origem: string;
  user_agent: string | null;
  signature_verified: boolean;
  received_at: string;
}

interface MessageUpdateData {
  status: string;
  status_updated_at: string;
  enviado_em?: string;
  entregue_em?: string;
  lido_em?: string;
  error_code?: string;
  error_message?: string;
}

// Configuração do Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ========================================
// 📱 GET /api/configuracoes/whatsapp/webhook
// ========================================
// Verificação de webhook do WhatsApp (Meta API) - fallback para Umbler quando tabelas legado não existem
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode !== 'subscribe' || !challenge) {
      return new Response('Verificação inválida', { status: 400 });
    }

    // 1. Tentar whatsapp_configuracoes (tabela pode ter sido removida)
    try {
      const { data: configs } = await supabase
        .from('whatsapp_configuracoes')
        .select('webhook_verify_token, bar_id')
        .eq('ativo', true);

      const validConfig = configs?.find((c: any) => c.webhook_verify_token === token);
      if (validConfig) {
        return new Response(challenge, { status: 200 });
      }
    } catch (_e) {
      /* tabela não existe - continuar para fallback */
    }

    // 2. Fallback: umbler_config (webhook_secret como token)
    const { data: umblerConfigs } = await supabase
      .from('umbler_config')
      .select('bar_id, webhook_secret')
      .eq('ativo', true);

    const validUmbler = (umblerConfigs || []).find((c: any) => c.webhook_secret === token);
    if (validUmbler) {
      return new Response(challenge, { status: 200 });
    }

    // 3. Fallback: variável de ambiente (dev/legado)
    if (process.env.WEBHOOK_VERIFY_TOKEN && process.env.WEBHOOK_VERIFY_TOKEN === token) {
      return new Response(challenge, { status: 200 });
    }

    return new Response('Token inválido', { status: 403 });
  } catch (error) {
    console.error('Erro na verificação do webhook:', error);
    return new Response('Erro interno', { status: 500 });
  }
}

// ========================================
// 📱 POST /api/configuracoes/whatsapp/webhook
// ========================================
// Recebimento de webhooks do WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const userAgent = request.headers.get('user-agent');
    const ipOrigem =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(body) as WhatsAppWebhookPayload;
    } catch (error) {
      console.error('Payload JSON inválido:', error);
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Identificar bar_id (fallback para umbler_config se whatsapp_configuracoes não existir)
    let barId = await identifyBarFromWebhook(payload);
    if (!barId) {
      // Fallback: primeiro bar com Umbler ativo
      const { data: umbler } = await supabase
        .from('umbler_config')
        .select('bar_id')
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      barId = (umbler as any)?.bar_id || null;
    }

    if (!barId) {
      console.warn('Webhook: bar não identificado - sistema usa Umbler');
      return NextResponse.json({ success: true, processed: false }); // 200 para evitar retries do Meta
    }

    const isSignatureValid = await verifyWebhookSignature(body, signature, barId);

    let logEntry: { id?: number } | null = null;
    try {
      const { data } = await supabase
        .from('whatsapp_webhooks')
        .insert({
          bar_id: barId,
          webhook_type: payload.object || 'unknown',
          payload: payload,
          processado: false,
          ip_origem: ipOrigem,
          user_agent: userAgent,
          signature_verified: isSignatureValid,
          received_at: new Date().toISOString(),
        } as any)
        .select()
        .single();
      logEntry = data;
    } catch (_e) {
      /* whatsapp_webhooks pode não existir - continuar */
    }

    if (payload.object === 'whatsapp_business_account') {
      await processWhatsAppWebhook(payload, barId, logEntry?.id);
    }

    return NextResponse.json({ success: true, processed: true });
  } catch (error) {
    console.error('Erro no processamento do webhook:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ========================================
// 🔧 FUNÇÕES AUXILIARES
// ========================================

/**
 * Identifica o bar_id através do payload do webhook (Meta API)
 * Fallback: umbler_config quando whatsapp_configuracoes não existe
 */
async function identifyBarFromWebhook(
  payload: WhatsAppWebhookPayload
): Promise<number | null> {
  try {
    const phoneNumberId =
      payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (!phoneNumberId) return null;

    const { data: config } = await supabase
      .from('whatsapp_configuracoes')
      .select('bar_id')
      .eq('phone_number_id', phoneNumberId)
      .single();

    return (config as any)?.bar_id || null;
  } catch (_e) {
    /* tabela não existe - caller usa fallback umbler_config */
  }
  return null;
}

/**
 * Verifica assinatura do webhook WhatsApp
 */
async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  barId: number
): Promise<boolean> {
  try {
    if (!signature) return false;

    let secret: string | null = null;
    try {
      const { data } = await supabase
        .from('whatsapp_configuracoes')
        .select('webhook_verify_token')
        .eq('bar_id', barId)
        .single();
      secret = (data as any)?.webhook_verify_token || null;
    } catch (_e) {
      /* fallback umbler_config */
    }
    if (!secret) {
      const { data: uc } = await supabase
        .from('umbler_config')
        .select('webhook_secret')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .single();
      secret = (uc as any)?.webhook_secret || null;
    }
    if (!secret) return false;

    const expectedSignature =
      'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (_e) {
    return false;
  }
}

/**
 * Processa webhook do WhatsApp Business
 */
async function processWhatsAppWebhook(
  payload: WhatsAppWebhookPayload,
  barId: number,
  webhookLogId?: number
): Promise<void> {
  try {
    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value;

        if (!value) continue;

        // Processar atualizações de status de mensagem
        if (value.statuses) {
          await processMessageStatuses(
            value.statuses as WhatsAppStatus[],
            barId
          );
        }

        // Processar mensagens recebidas
        if (value.messages) {
          await processReceivedMessages(
            value.messages as WhatsAppMessage[],
            barId
          );
        }
      }
    }

    if (webhookLogId) {
      try {
        await supabase
          .from('whatsapp_webhooks')
          .update({ processado: true, processado_em: new Date().toISOString() })
          .eq('id', webhookLogId);
      } catch (_e) {
        /* tabela pode não existir */
      }
    }
  } catch (error: unknown) {
    console.warn('Erro ao processar webhook WhatsApp:', error);
    if (webhookLogId) {
      try {
        await supabase
          .from('whatsapp_webhooks')
          .update({
            processado: false,
            erro_processamento: error instanceof Error ? error.message : String(error),
          })
          .eq('id', webhookLogId);
      } catch (_e) {
        /* tabela pode não existir */
      }
    }
  }
}

/**
 * Processa atualizações de status de mensagens
 * Tabelas whatsapp_mensagens/whatsapp_contatos podem não existir - sistema usa Umbler
 */
async function processMessageStatuses(
  statuses: WhatsAppStatus[],
  barId: number
): Promise<void> {
  try {
  for (const status of statuses) {
    const messageId = status.id;
    const newStatus = status.status; // sent, delivered, read, failed
    const timestamp = status.timestamp;
    const errorCode = status.errors?.[0]?.code;
    const errorMessage = status.errors?.[0]?.message;

    // Atualizar status da mensagem no banco
    const updateData: MessageUpdateData = {
      status: newStatus,
      status_updated_at: new Date(parseInt(timestamp) * 1000).toISOString(),
    };

    // Campos específicos por status
    switch (newStatus) {
      case 'sent':
        updateData.enviado_em = updateData.status_updated_at;
        break;
      case 'delivered':
        updateData.entregue_em = updateData.status_updated_at;
        break;
      case 'read':
        updateData.lido_em = updateData.status_updated_at;
        break;
      case 'failed':
        updateData.error_code = errorCode;
        updateData.error_message = errorMessage;
        break;
    }

    // Atualizar mensagem
    const { data: updatedMessage } = await supabase
      .from('whatsapp_mensagens')
      .update(updateData)
      .eq('whatsapp_message_id', messageId)
      .eq('bar_id', barId)
      .select('contato_id')
      .single();

    // Atualizar estatísticas do contato se necessário (função/tabelas podem não existir - sistema usa Umbler)
    if (updatedMessage && ['delivered', 'read'].includes(newStatus)) {
      try {
        const incrementField =
          newStatus === 'delivered'
            ? 'total_mensagens_entregues'
            : 'total_mensagens_lidas';

        await supabase.rpc('increment_contact_stat', {
          contact_id: updatedMessage.contato_id,
          field_name: incrementField,
        });
      } catch (_e) {
        /* increment_contact_stat/whatsapp_contatos não existem - Umbler */
      }
    }
  }
  } catch (_e) {
    /* whatsapp_mensagens não existe - sistema usa Umbler */
  }
}

/**
 * Processa mensagens recebidas (respostas dos usuários)
 */
async function processReceivedMessages(
  messages: WhatsAppMessage[],
  barId: number
): Promise<void> {
  // Sistema usa Umbler (umbler-webhook Edge Function) - este webhook é legado Meta API
  // Mensagens recebidas são processadas pelo Umbler; ignorar silenciosamente se tabelas não existirem
  try {
    for (const message of messages) {
      const fromNumber = message.from?.replace(/\D/g, '') || '';
      const messageText = message.text?.body || message.type || '';
      const timestamp = message.timestamp ? parseInt(message.timestamp) * 1000 : Date.now();

      // Buscar conversa Umbler existente (channel_id obrigatório em umbler_mensagens)
      const { data: conversa } = await supabase
        .from('umbler_conversas')
        .select('id, channel_id')
        .eq('bar_id', barId)
        .eq('contato_telefone', fromNumber)
        .order('iniciada_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversa?.id && conversa?.channel_id) {
        await supabase.from('umbler_mensagens').insert({
          bar_id: barId,
          conversa_id: conversa.id,
          channel_id: conversa.channel_id,
          direcao: 'inbound',
          tipo_remetente: 'contact',
          contato_telefone: fromNumber,
          tipo_mensagem: 'text',
          conteudo: messageText,
          status: 'delivered',
          enviada_em: new Date(timestamp).toISOString(),
        });
      }
    }
  } catch (_e) {
    // Tabelas/formato podem diferir - Umbler Edge Function é o processador principal
  }
}

// ========================================
// 📊 FUNÇÃO PARA CRIAR RPC NO BANCO
// ========================================
/*
-- Executar no Supabase para criar função RPC
CREATE OR REPLACE FUNCTION increment_contact_stat(
  contact_id INTEGER,
  field_name TEXT
) RETURNS VOID AS $$
BEGIN
  IF field_name = 'total_mensagens_entregues' THEN
    UPDATE whatsapp_contatos 
    SET total_mensagens_entregues = total_mensagens_entregues + 1 
    WHERE id = contact_id;
  ELSIF field_name = 'total_mensagens_lidas' THEN
    UPDATE whatsapp_contatos 
    SET total_mensagens_lidas = total_mensagens_lidas + 1 
    WHERE id = contact_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
*/
