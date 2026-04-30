import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/umbler/send
 * Envia uma mensagem WhatsApp única via Umbler.
 * Modo bulk foi removido em 2026-04-27 (CUT Feature B - DIY-send nunca usado em prod).
 * Time dispara campanhas em massa direto pelo portal da Umbler.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, mode, to_phone, message } = body;

    if (!bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Backwards-compat: aceita mode='single' explicito ou ausente
    if (mode && mode !== 'single') {
      return NextResponse.json(
        { error: `mode "${mode}" não é mais suportado. Apenas "single" disponível.` },
        { status: 400 }
      );
    }

    if (!to_phone || !message) {
      return NextResponse.json(
        { error: 'to_phone e message são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('umbler_config')
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .eq('ativo', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Umbler não configurado para este bar' },
        { status: 400 }
      );
    }

    const result = await sendUmblerMessage(config, to_phone, message);

    if (result.success) {
      await supabase
        .from('umbler_mensagens')
        .insert({
          id: result.messageId || `single_${Date.now()}`,
          bar_id: parseInt(bar_id),
          channel_id: config.channel_id,
          direcao: 'saida',
          tipo_remetente: 'campanha',
          contato_telefone: normalizePhone(to_phone),
          tipo_mensagem: 'text',
          conteudo: message,
          status: 'enviada',
          enviada_em: new Date().toISOString()
        });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro na API Umbler Send:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

interface UmblerConfig {
  api_token: string;
  organization_id: string;
  phone_number: string;
  channel_id: string;
}

async function sendUmblerMessage(
  config: UmblerConfig,
  toPhone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://app-utalk.umbler.com/api/v1/messages/simplified/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ToPhone: normalizePhone(toPhone),
        FromPhone: normalizePhone(config.phone_number),
        OrganizationId: config.organization_id,
        Message: message
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Umbler API:', response.status, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.id || data.messageId || data.Id
    };

  } catch (error) {
    console.error('Erro ao enviar mensagem Umbler:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  } else if (normalized.length === 10) {
    normalized = '55' + normalized;
  }
  return normalized;
}
