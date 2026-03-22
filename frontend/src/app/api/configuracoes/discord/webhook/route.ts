import { NextRequest, NextResponse } from 'next/server';
import { processDiscordCommand } from '@/lib/discord-bot-service';

export const dynamic = 'force-dynamic'

// Removido o schema DiscordWebhookSchema e o import z

// ========================================
// 🎮 POST /api/configuracoes/discord/webhook
// ========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verificar se é uma mensagem de usuário
    if (!body.content || body.content.trim() === '') {
      return NextResponse.json({ success: true, message: 'Sem conteúdo' });
    }

    // Ignorar mensagens de bots
    if (body.author?.bot || body.webhook_id) {
      return NextResponse.json({ success: true, message: 'Bot ignorado' });
    }

    const message = body.content.trim();
    const username = body.author?.username || 'Usuário Desconhecido';

    // Bar ID do Ordinário Bar
    const BAR_ID = 3; // Ordinário Bar

    // Processar comando com o bot inteligente
    const success = await processDiscordCommand(message, username, BAR_ID);

    return NextResponse.json({
      success,
      message: success
        ? 'Comando processado com sucesso'
        : 'Erro ao processar comando',
    });
  } catch (error) {
    console.error('❌ Erro no webhook Discord:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// ========================================
// 🧪 GET /api/configuracoes/discord/webhook (Teste)
// ========================================
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const testCommand = url.searchParams.get('test') || 'dashboard executivo';

  try {
    const success = await processDiscordCommand(
      testCommand,
      'Sistema de Teste',
      3
    );

    return NextResponse.json({
      success,
      message: `Teste executado: "${testCommand}"`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
