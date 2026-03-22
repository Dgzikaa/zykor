import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Serviço de email não configurado' },
        { status: 503 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { to, memberName, amount, cardUrl } = await request.json()

    // Validações
    if (!to || !memberName || !amount || !cardUrl) {
      return NextResponse.json(
        { error: 'Dados obrigatórios: to, memberName, amount, cardUrl' },
        { status: 400 }
      )
    }

    // SEGURANÇA: Verificar se é um email válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pagamento Confirmado - ZYKOR</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 8px; }
        .subtitle { font-size: 16px; opacity: 0.9; }
        .content { padding: 30px; }
        .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: 600; margin-bottom: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; margin: 15px 0; }
        .card-button { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; margin: 20px 0; }
        .benefits { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .benefit-item { margin: 8px 0; color: #92400e; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🍻 ZYKOR</div>
            <div class="subtitle">Ordinário Bar e Música</div>
        </div>
        
        <div class="content">
            <div class="success-badge">✅ Pagamento Confirmado</div>
            
            <h1 style="color: #1f2937; margin-bottom: 20px;">Olá, ${memberName}!</h1>
            
            <p style="color: #4b5563; line-height: 1.6;">
                Seu pagamento foi processado com sucesso! Bem-vindo ao programa de fidelidade VIP do Ordinário Bar.
            </p>
            
            <div class="amount">💰 Valor: R$ ${amount.toFixed(2)}</div>
            
            <div class="benefits">
                <h3 style="color: #92400e; margin-top: 0;">🎉 Seus Benefícios VIP:</h3>
                <div class="benefit-item">💳 R$ 150,00 em créditos mensais</div>
                <div class="benefit-item">👑 Acesso VIP sem fila</div>
                <div class="benefit-item">🍹 Drink especial do mês</div>
                <div class="benefit-item">🎪 Convites para eventos exclusivos</div>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
                Seu cartão de fidelidade digital já está disponível. Use-o para aproveitar todos os benefícios:
            </p>
            
            <div style="text-align: center;">
                <a href="${cardUrl}" class="card-button">
                    📱 Acessar Meu Cartão VIP
                </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                💡 <strong>Dica:</strong> Salve o link do cartão nos favoritos do seu celular para acesso rápido!
            </p>
        </div>
        
        <div class="footer">
            <p>Este é um email automático. Em caso de dúvidas, entre em contato conosco.</p>
            <p>Ordinário Bar e Música | Programa de Fidelidade VIP</p>
        </div>
    </div>
</body>
</html>
    `

    const result = await resend.emails.send({
      from: 'ZYKOR <noreply@zykor.com.br>',
      to: [to],
      subject: '🎉 Pagamento Confirmado - Bem-vindo ao VIP!',
      html: htmlContent
    })

    return NextResponse.json({
      success: true,
      messageId: result.data?.id,
      message: 'Email de confirmação enviado'
    })

  } catch (error) {
    console.error('🚨 Erro ao enviar email:', error)
    
    return NextResponse.json(
      { error: 'Erro ao enviar email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
