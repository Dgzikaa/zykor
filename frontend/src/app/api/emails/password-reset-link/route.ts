import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de email não configurado' },
        { status: 503 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { to, nome, email, resetLink, expiresIn } = await request.json();

    // Em desenvolvimento, forçar para email de teste
    const finalTo = process.env.NODE_ENV === 'development' 
      ? 'rodrigo@grupomenosemais.com.br'
      : to;

    // Template HTML profissional para link de reset de senha
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinir Senha - ZYKOR</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1f2937; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
        .subtitle { font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .reset-badge { background: #dbeafe; color: #1e40af; padding: 12px 20px; border-radius: 25px; display: inline-block; font-weight: 600; margin-bottom: 25px; border: 2px solid #3b82f6; }
        .action-box { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center; }
        .reset-button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white !important; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; margin: 20px 0; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); transition: transform 0.2s; }
        .reset-button:hover { transform: translateY(-2px); }
        .security-info { background: #fef7cd; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .security-item { margin: 8px 0; color: #92400e; }
        .footer { background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        .warning-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .warning-title { color: #dc2626; font-weight: 600; margin-bottom: 10px; }
        .warning-text { color: #991b1b; font-size: 14px; }
        .link-fallback { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-top: 20px; word-break: break-all; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔐 ZYKOR</div>
            <div class="subtitle">Sistema de Gestão de Bares</div>
        </div>
        
        <div class="content">
            <div class="reset-badge">🔑 Redefinição de Senha Solicitada</div>
            
            <h1 style="color: #1f2937; margin-bottom: 20px;">Olá, ${nome}!</h1>
            
            <p style="color: #4b5563; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>ZYKOR</strong>. 
                Clique no botão abaixo para criar uma nova senha:
            </p>

            <div class="action-box">
                <p style="color: #1e40af; font-weight: 600; margin-bottom: 15px; font-size: 16px;">
                    Clique no botão para definir sua nova senha:
                </p>
                <a href="${resetLink}" class="reset-button">
                    🔒 Redefinir Minha Senha
                </a>
                <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">
                    Este link expira em <strong>${expiresIn || '1 hora'}</strong>
                </p>
            </div>

            <div class="warning-box">
                <div class="warning-title">⚠️ Não solicitou esta redefinição?</div>
                <div class="warning-text">
                    Se você não solicitou a redefinição de senha, ignore este email. 
                    Sua senha atual permanecerá inalterada. Se suspeitar de atividade 
                    não autorizada, entre em contato conosco em <a href="mailto:suporte@zykor.com.br" style="color: #dc2626;">suporte@zykor.com.br</a>
                </div>
            </div>
            
            <div class="security-info">
                <h3 style="color: #92400e; margin-top: 0; margin-bottom: 15px;">🔐 Dicas de Segurança:</h3>
                <div class="security-item">• Escolha uma senha forte com letras, números e símbolos</div>
                <div class="security-item">• Não compartilhe sua senha com ninguém</div>
                <div class="security-item">• Nunca use a mesma senha em outros sites</div>
                <div class="security-item">• O link de redefinição só pode ser usado uma vez</div>
            </div>

            <div class="link-fallback">
                <strong>Botão não funciona?</strong> Copie e cole este link no seu navegador:<br><br>
                ${resetLink}
            </div>
        </div>
        
        <div class="footer">
            <p><strong>ZYKOR - Sistema de Gestão de Bares</strong></p>
            <p>Este é um email automático, não responda a esta mensagem.</p>
            <p>Para suporte, entre em contato: <a href="mailto:suporte@zykor.com.br" style="color: #3b82f6;">suporte@zykor.com.br</a></p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} ZYKOR. Todos os direitos reservados.
            </p>
        </div>
    </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: 'ZYKOR Sistema <sistema@send.zykor.com.br>',
      to: [finalTo],
      subject: process.env.NODE_ENV === 'development' 
        ? `[DEV] Redefinir Senha ZYKOR - ${email}` 
        : '🔒 Redefinir Senha - ZYKOR Sistema',
      html: htmlContent,
      headers: {
        'X-Priority': '1', // Máxima prioridade para reset de senha
        'X-Mailer': 'ZYKOR Sistema v2.0',
        'Reply-To': 'suporte@zykor.com.br',
      },
      tags: [
        { name: 'category', value: 'password-reset-link' },
        { name: 'environment', value: process.env.NODE_ENV || 'production' }
      ]
    });

    return NextResponse.json({
      success: true,
      message: 'Email de redefinição enviado com sucesso',
      emailId: result.data?.id
    });

  } catch (error) {
    console.error('❌ Erro ao enviar email de reset:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar email' },
      { status: 500 }
    );
  }
}






















