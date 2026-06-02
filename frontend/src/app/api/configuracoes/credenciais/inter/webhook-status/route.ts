import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';

export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient();

export async function POST(request: NextRequest) {
  try {
    const { bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'Bar ID é obrigatório' },
        { status: 400 }
      );
    }

    // Obter credenciais do Inter (linha) e resolver (envelope, server-side)
    const { data: credRow } = await supabase
      .from('api_credentials')
      .select('id, client_id, empresa_nome, empresa_cnpj, configuracoes')
      .eq('bar_id', bar_id)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!credRow) {
      return NextResponse.json({
        error: 'Credenciais do Inter não encontradas',
        webhook: {
          url: '',
          status: 'inactive',
          events: [],
        },
      });
    }

    let resolved;
    try {
      resolved = await resolveInterCredential(credRow);
    } catch (e: any) {
      return NextResponse.json({
        error: e?.message || 'Falha ao resolver credencial',
        webhook: { url: '', status: 'error', events: [] },
      });
    }

    // Obter token de acesso
    const accessToken = await getInterAccessToken(
      resolved.clientId,
      resolved.clientSecret,
      'webhook.read webhook.write',
      resolved.mtls
    );
    if (!accessToken) {
      return NextResponse.json({
        error: 'Falha ao obter token de acesso',
        webhook: {
          url: '',
          status: 'error',
          events: [],
        },
      });
    }

    // Buscar logs recentes do webhook
    const { data: recentLogs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('provider', 'inter')
      .eq('bar_id', bar_id)
      .order('data_recebimento', { ascending: false })
      .limit(5);

    // Verificar se há logs recentes (últimas 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hasRecentActivity = recentLogs?.some(
      log => new Date(log.data_recebimento) > last24h
    );

    // Buscar último teste
    const lastTest = recentLogs?.find(
      log =>
        log.dados?.evento === 'PIX_RECEBIDO' &&
        log.dados?.data?.txid?.startsWith('test_')
    );

    // Determinar status baseado na atividade
    let status: 'active' | 'inactive' | 'error' = 'inactive';
    if (hasRecentActivity) {
      status = 'active';
    } else if (recentLogs?.some(log => log.erro)) {
      status = 'error';
    }

    // Lista de eventos suportados
    const supportedEvents = [
      'PIX_RECEBIDO',
      'PIX_ENVIADO',
      'BOLETO_VENCIDO',
      'BOLETO_PAGO',
    ];

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook-inter-banking`;

    return NextResponse.json({
      success: true,
      webhook: {
        url: webhookUrl,
        status,
        lastTest: lastTest?.data_recebimento,
        events: supportedEvents,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status do webhook:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        webhook: {
          url: '',
          status: 'error',
          events: [],
        },
      },
      { status: 500 }
    );
  }
}
