import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');

    if (!barIdParam) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const barId = parseInt(barIdParam, 10);
    if (Number.isNaN(barId)) {
      return NextResponse.json(
        { success: false, error: 'bar_id inválido' },
        { status: 400 }
      );
    }

    const [{ data: umblerConfig }, { data: getinUnit }] = await Promise.all([
      supabase
        .from('umbler_config')
        .select('id')
        .eq('bar_id', barId)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('getin_units')
        .select('id')
        .eq('bar_id', barId)
        .limit(1)
        .maybeSingle(),
    ]);

    const integracoes = {
      umbler: !!umblerConfig,
      getin: !!getinUnit,
    };

    const faltantes = Object.entries(integracoes)
      .filter(([, configurado]) => !configurado)
      .map(([nome]) => nome);

    return NextResponse.json({
      success: true,
      bar_id: barId,
      integracoes,
      possui_alguma_integracao: Object.values(integracoes).some(Boolean),
      faltantes,
    });
  } catch (error: any) {
    console.error('Erro ao verificar status de integrações:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { bar_id } = await request.json();
    if (!bar_id) {
      return NextResponse.json(
        {
          error: 'bar_id é obrigatório',
        },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    // Buscar credenciais configuradas
    const { data: credentials, error: credentialsError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('ativo', true);

    if (credentialsError) {
      console.error('❌ Erro ao buscar credenciais:', credentialsError);
      return NextResponse.json(
        {
          error: 'Erro ao buscar credenciais',
        },
        { status: 500 }
      );
    }

    // Buscar webhooks do Discord configurados
    const { data: discordWebhooks, error: discordError } = await supabase
      .from('discord_webhooks')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('enabled', true);

    if (discordError) {
      console.error('❌ Erro ao buscar webhooks Discord:', discordError);
    }

    // Mapear status das integrações
    const integrations = {
      inter: {
        status: 'not-configured',
        hasCredentials: false,
        hasWebhook: false,
        lastActivity: null,
      },
      contaazul: {
        status: 'not-configured',
        hasCredentials: false,
        hasWebhook: false,
        lastActivity: null,
      },
      contahub: {
        status: 'not-configured',
        hasCredentials: false,
        hasWebhook: false,
        lastActivity: null,
      },
      discord: {
        status: 'not-configured',
        webhooks: [] as any[],
        totalWebhooks: 0,
        activeWebhooks: 0,
      },
      whatsapp: {
        status: 'not-configured',
        hasCredentials: false,
        lastActivity: null,
      },
    };

    // Verificar credenciais do Inter
    const interCreds = credentials?.find(c => c.sistema === 'inter');
    if (interCreds) {
      integrations.inter.hasCredentials = true;
      integrations.inter.status = 'active';
    }

    // Verificar credenciais do Conta Azul
    const contaazulCreds = credentials?.find(c => c.sistema === 'contaazul');
    if (contaazulCreds) {
      integrations.contaazul.hasCredentials = true;
      integrations.contaazul.status = 'active';
    }

    // Verificar credenciais do ContaHub
    const contahubCreds = credentials?.find(c => c.sistema === 'contahub');
    if (contahubCreds) {
      integrations.contahub.hasCredentials = true;
      integrations.contahub.status = 'active';
    }

    // Verificar credenciais do WhatsApp
    const whatsappCreds = credentials?.find(c => c.sistema === 'whatsapp');
    if (whatsappCreds) {
      integrations.whatsapp.hasCredentials = true;
      integrations.whatsapp.status = 'active';
    }

    // Configurar Discord
    if (discordWebhooks && discordWebhooks.length > 0) {
      integrations.discord.webhooks = discordWebhooks;
      integrations.discord.totalWebhooks = discordWebhooks.length;
      integrations.discord.activeWebhooks = discordWebhooks.filter(
        w => w.enabled
      ).length;
      integrations.discord.status =
        integrations.discord.activeWebhooks > 0 ? 'active' : 'inactive';
    }

    // Verificar webhooks específicos
    if (discordWebhooks) {
      const interWebhook = discordWebhooks.find(
        w =>
          w.webhook_type === 'pix_recebido' || w.webhook_type === 'pix_enviado'
      );
      if (interWebhook) {
        integrations.inter.hasWebhook = true;
      }

      const contaazulWebhook = discordWebhooks.find(w => w.webhook_type === 'contaazul');
      if (contaazulWebhook) {
        integrations.contaazul.hasWebhook = true;
      }

      const contahubWebhook = discordWebhooks.find(
        w => w.webhook_type === 'contahub'
      );
      if (contahubWebhook) {
        integrations.contahub.hasWebhook = true;
      }
    }

    return NextResponse.json({
      success: true,
      integrations,
      credentials: credentials || [],
      discordWebhooks: discordWebhooks || [],
    });
  } catch (error) {
    console.error('❌ Erro na API de status das integrações:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
