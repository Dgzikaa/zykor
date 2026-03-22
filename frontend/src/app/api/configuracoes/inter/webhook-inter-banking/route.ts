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

    // Buscar pagamento pelo código de solicitação
    const { data: pagamentos, error: searchError } = await supabase
      .from('pagamentos_agendamento')
      .select('*')
      .eq('inter_aprovacao_id', codigoSolicitacao);

    if (searchError) {
      console.error('❌ Erro ao buscar pagamento:', searchError);
      return NextResponse.json(
        { error: 'Erro ao buscar pagamento' },
        { status: 500 }
      );
    }

    if (!pagamentos || pagamentos.length === 0) {
      console.warn(
        '⚠️ Pagamento não encontrado para código:',
        codigoSolicitacao
      );
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      );
    }

    const pagamento: PagamentoAgendamento = pagamentos[0];

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

    // Atualizar pagamento no banco
    const { error: updateError } = await supabase
      .from('pagamentos_agendamento')
      .update({
        status: novoStatus,
        inter_status: status,
        inter_data_hora: dataHora,
        inter_motivo_rejeicao: motivoRejeicao,
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
