import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDiscordAlert } from '@/lib/discord/sendDiscordAlert';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InterWebhookPayload {
  codigoSolicitacao: string;
  status: 'APROVADO' | 'REJEITADO' | 'CANCELADO';
  dataHora: string;
  valor?: number;
  descricao?: string;
  destinatario?: {
    nome?: string;
    chave?: string;
  };
  motivoRejeicao?: string;
}

interface PagamentoAgendamento {
  id: string;
  inter_aprovacao_id: string;
  nome_beneficiario: string;
  valor: number;
  descricao: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: InterWebhookPayload = await request.json();
    const {
      codigoSolicitacao,
      status,
      dataHora,
      valor,
      descricao,
      destinatario,
      motivoRejeicao,
    } = body;

    // Validar dados obrigatórios
    if (!codigoSolicitacao || !status || !dataHora) {
      console.error('❌ Dados obrigatórios ausentes no webhook');
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes' },
        { status: 400 }
      );
    }

    // Buscar pagamento pelo código de solicitação em pix_enviados (campo txid)
    const { data: pixEnviados, error: searchError } = await supabase
      .from('pix_enviados')
      .select('*')
      .eq('txid', codigoSolicitacao)
      .limit(1);

    if (searchError) {
      // Retornar 200 mesmo em erro para evitar retentativas do Inter
      console.error('❌ Erro ao buscar pagamento PIX:', searchError);
      return NextResponse.json({ received: true, warning: 'Pagamento não localizado' });
    }

    // Se não encontrou, aceitar o webhook mesmo assim (evita retentativas)
    if (!pixEnviados || pixEnviados.length === 0) {
      console.warn('⚠️ Webhook Inter recebido sem pagamento correspondente:', codigoSolicitacao);
      return NextResponse.json({ received: true, warning: 'Código não encontrado no sistema' });
    }

    const pix = pixEnviados[0];
    const pagamento: PagamentoAgendamento = {
      id: pix.id,
      inter_aprovacao_id: codigoSolicitacao,
      nome_beneficiario: pix.beneficiario?.nome || destinatario?.nome || '',
      valor: Number(pix.valor) || valor || 0,
      descricao: descricao || '',
      status: pix.status || '',
      created_at: pix.created_at,
      updated_at: pix.updated_at || pix.created_at,
    };

    // Atualizar status do pagamento baseado na resposta do Inter
    let novoStatus: string;
    let mensagemDiscord: string;

    switch (status) {
      case 'APROVADO':
        novoStatus = 'aprovado';
        mensagemDiscord = `✅ **Pagamento PIX APROVADO!**
        
**Detalhes:**
• Código: \`${codigoSolicitacao}\`
• Beneficiário: ${destinatario?.nome || pagamento.nome_beneficiario}
• Valor: R$ ${valor?.toFixed(2) || pagamento.valor}
• Data/Hora: ${new Date(dataHora).toLocaleString('pt-BR')}
• Descrição: ${descricao || pagamento.descricao}

🎉 Pagamento foi aprovado pelo gestor e será processado!`;
        break;

      case 'REJEITADO':
        novoStatus = 'rejeitado';
        mensagemDiscord = `❌ **Pagamento PIX REJEITADO!**
        
**Detalhes:**
• Código: \`${codigoSolicitacao}\`
• Beneficiário: ${destinatario?.nome || pagamento.nome_beneficiario}
• Valor: R$ ${valor?.toFixed(2) || pagamento.valor}
• Data/Hora: ${new Date(dataHora).toLocaleString('pt-BR')}
• Motivo: ${motivoRejeicao || 'Não informado'}

⚠️ Pagamento foi rejeitado pelo gestor!`;
        break;

      case 'CANCELADO':
        novoStatus = 'cancelado';
        mensagemDiscord = `🚫 **Pagamento PIX CANCELADO!**
        
**Detalhes:**
• Código: \`${codigoSolicitacao}\`
• Beneficiário: ${destinatario?.nome || pagamento.nome_beneficiario}
• Valor: R$ ${valor?.toFixed(2) || pagamento.valor}
• Data/Hora: ${new Date(dataHora).toLocaleString('pt-BR')}

🔄 Pagamento foi cancelado pelo gestor!`;
        break;

      default:
        console.error('❌ Status desconhecido:', status);
        return NextResponse.json(
          { error: 'Status desconhecido' },
          { status: 400 }
        );
    }

    // Atualizar pagamento no banco (pix_enviados)
    const { error: updateError } = await supabase
      .from('pix_enviados')
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pagamento.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar pagamento:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar pagamento' },
        { status: 500 }
      );
    }

    // Enviar notificação Discord
    try {
      await sendDiscordAlert(mensagemDiscord);
    } catch (discordError) {
      console.error('❌ Erro ao enviar notificação Discord:', discordError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Erro interno no webhook:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET para verificar se o webhook está funcionando
export async function GET() {
  return NextResponse.json({
    message: 'Webhook Inter Banking está funcionando',
    timestamp: new Date().toISOString(),
  });
}
