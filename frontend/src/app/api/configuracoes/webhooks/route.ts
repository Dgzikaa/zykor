import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient();

export async function POST(request: NextRequest) {
  try {
    const { action, bar_id, webhooks } = await request.json();

    if (!action || !bar_id) {
      return NextResponse.json(
        {
          error: 'action e bar_id são obrigatórios',
        },
        { status: 400 }
      );
    }

    if (action === 'get') {
      // Buscar webhooks configurados
      const { data: webhooksData, error } = await supabase
        .from('discord_webhooks')
        .select('*')
        .eq('bar_id', bar_id)
        .order('webhook_type');

      if (error) {
        console.error('❌ Erro ao buscar webhooks:', error);
        return NextResponse.json(
          {
            error: 'Erro ao buscar webhooks',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        webhooks: webhooksData || [],
      });
    } else if (action === 'save') {
      // Salvar webhooks
      if (!webhooks || !Array.isArray(webhooks)) {
        return NextResponse.json(
          {
            error: 'webhooks deve ser um array',
          },
          { status: 400 }
        );
      }

      const results: Array<{
        webhook: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const webhook of webhooks) {
        if (webhook.webhook_url && webhook.enabled) {
          // Salvar webhook ativo
          const { error: upsertError } = await supabase
            .from('discord_webhooks')
            .upsert(
              {
                bar_id: parseInt(bar_id),
                webhook_type: webhook.id,
                webhook_url: webhook.webhook_url,
                enabled: webhook.enabled,
                name: webhook.name,
                category: webhook.category,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'bar_id,webhook_type',
              }
            );

          if (upsertError) {
            console.error(
              `❌ Erro ao salvar webhook ${webhook.id}:`,
              upsertError
            );
            results.push({
              webhook: webhook.id,
              success: false,
              error: upsertError.message,
            });
          } else {
            results.push({
              webhook: webhook.id,
              success: true,
            });
          }
        } else if (!webhook.enabled) {
          // Desabilitar webhook
          const { error: updateError } = await supabase
            .from('discord_webhooks')
            .update({
              enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq('bar_id', bar_id)
            .eq('webhook_type', webhook.id);

          if (updateError) {
            console.error(
              `❌ Erro ao desabilitar webhook ${webhook.id}:`,
              updateError
            );
            results.push({
              webhook: webhook.id,
              success: false,
              error: updateError.message,
            });
          } else {
            results.push({
              webhook: webhook.id,
              success: true,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Webhooks salvos com sucesso',
        results,
      });
    } else {
      return NextResponse.json(
        {
          error: 'Ação inválida. Use "get" ou "save"',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ Erro na API de webhooks:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
