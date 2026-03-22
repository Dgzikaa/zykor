import { NextResponse } from 'next/server';
import { securityMonitor } from '@/lib/security-monitor';

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Registrar evento crítico que deve disparar o webhook
    await securityMonitor.logEvent({
      level: 'critical',
      category: 'injection',
      event_type: 'webhook_test_manual',
      ip_address: '203.0.113.199',
      user_agent: 'Webhook-Test-Bot/1.0 (Manual Test)',
      endpoint: '/api/configuracoes/security/test-webhook',
      details: {
        test_type: 'manual_webhook_test',
        message:
          '🧪 TESTE MANUAL DO WEBHOOK - Se você está vendo esta mensagem no Discord, o sistema está funcionando!',
        triggered_by: 'user_request',
        timestamp: new Date().toISOString(),
        purpose:
          'Verificar se o webhook do Discord está funcionando corretamente',
      },
      risk_score: 100,
    });

    return NextResponse.json({
      success: true,
      message: 'Teste do webhook executado! Verifique o Discord.',
      timestamp: new Date().toISOString(),
      details: {
        event_type: 'webhook_test_manual',
        risk_score: 100,
        should_trigger_discord: true,
      },
    });
  } catch (error) {
    console.error('❌ Erro no teste do webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
