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
    const { to, nome, email, senha_temporaria, role, loginUrl } = await request.json();

    // Mapear roles para descrições amigáveis
    const roleDescriptions: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Gerente',
      funcionario: 'Funcionário',
      financeiro: 'Financeiro',
    };

    const roleDescription = roleDescriptions[role] || role;
    const loginLink = `${loginUrl}/login`;

    // Em desenvolvimento, forçar para email de teste
    const finalTo = process.env.NODE_ENV === 'development' 
      ? 'rodrigo@grupomenosemais.com.br'
      : to;

    // Template HTML profissional para reset de senha
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset de Senha - ZYKOR</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1f2937; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
        .subtitle { font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .reset-badge { background: #fef3c7; color: #92400e; padding: 12px 20px; border-radius: 25px; display: inline-block; font-weight: 600; margin-bottom: 25px; border: 2px solid #fbbf24; }
        .credentials-box { background: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 12px; padding: 25px; margin: 25px 0; }
        .credential-item { margin: 15px 0; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .credential-label { font-weight: 600; color: #374151; font-size: 14px; }
        .credential-value { font-size: 18px; font-weight: bold; color: #1f2937; font-family: 'Courier New', monospace; margin-top: 5px; }
        .role-badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .login-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; transition: transform 0.2s; }
        .login-button:hover { transform: translateY(-2px); }
        .security-info { background: #fef7cd; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .security-item { margin: 8px 0; color: #92400e; }
        .footer { background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        .warning-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .warning-title { color: #dc2626; font-weight: 600; margin-bottom: 10px; }
        .warning-text { color: #991b1b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔐 ZYKOR</div>
            <div class="subtitle">Sistema de Gestão de Bares</div>
        </div>
        
        <div class="content">
            <div class="reset-badge">🔄 Redefinição de Senha Solicitada</div>
            
            <h1 style="color: #1f2937; margin-bottom: 20px;">Olá, ${nome}!</h1>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
                Recebemos uma solicitação para redefinir a senha da sua conta no ZYKOR. Uma nova senha temporária foi gerada para você.
            </p>

            <div class="warning-box">
                <div class="warning-title">⚠️ Importante</div>
                <div class="warning-text">
                    Se você não solicitou esta redefinição de senha, entre em contato conosco imediatamente em suporte@zykor.com.br
                </div>
            </div>
            
            <div class="credentials-box">
                <h3 style="color: #fbbf24; margin-top: 0; margin-bottom: 20px;">🔑 Suas Novas Credenciais Temporárias:</h3>
                
                <div class="credential-item">
                    <div class="credential-label">📧 Email:</div>
                    <div class="credential-value">${email}</div>
                </div>
                
                <div class="credential-item">
                    <div class="credential-label">🔒 Senha Temporária:</div>
                    <div class="credential-value">${senha_temporaria}</div>
                </div>

                <div class="credential-item">
                    <div class="credential-label">👤 Função:</div>
                    <div class="credential-value"><span class="role-badge">${roleDescription}</span></div>
                </div>
                
                <a href="${loginLink}" class="login-button">
                    🚀 Acessar o Sistema
                </a>
            </div>
            
            <div class="security-info">
                <h3 style="color: #92400e; margin-top: 0;">🔐 Informações de Segurança:</h3>
                <div class="security-item">• Esta é uma senha temporária que DEVE ser alterada no primeiro acesso</div>
                <div class="security-item">• O sistema solicitará automaticamente a criação de uma nova senha</div>
                <div class="security-item">• Esta senha temporária expira em 24 horas</div>
                <div class="security-item">• Nunca compartilhe suas credenciais com terceiros</div>
            </div>
            
            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #1e40af; margin-top: 0;">📋 Próximos Passos:</h4>
                <ol style="color: #1e3a8a; line-height: 1.6; margin: 0;">
                    <li>Acesse o sistema usando o botão acima</li>
                    <li>Faça login com a senha temporária</li>
                    <li>O sistema solicitará a criação de uma nova senha</li>
                    <li>Escolha uma senha forte e segura</li>
                    <li>Confirme a nova senha</li>
                </ol>
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
        ? `[DEV] Reset de Senha ZYKOR - ${email}` 
        : 'Reset de Senha - ZYKOR Sistema',
      html: htmlContent,
      headers: {
        'X-Priority': '2', // Alta prioridade para reset de senha
        'X-Mailer': 'ZYKOR Sistema v2.0',
        'Reply-To': 'suporte@zykor.com.br',
      },
      tags: [
        { name: 'category', value: 'password-reset' },
        { name: 'environment', value: process.env.NODE_ENV || 'production' }
      ]
    });

    return NextResponse.json({
      success: true,
      message: 'Email de reset enviado com sucesso',
      emailId: result.data?.id
    });

  } catch (error) {
    console.error('❌ Erro ao enviar email de reset:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    return NextResponse.json(
      { 
        error: 'Erro ao enviar email',
        details: errorMessage,
        // Em desenvolvimento, incluir mais detalhes
        ...(process.env.NODE_ENV === 'development' && { stack: errorDetails })
      },
      { status: 500 }
    );
  }
}
