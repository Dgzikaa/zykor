import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

interface UserWelcomeRequest {
  to: string;
  nome: string;
  email: string;
  senha_temporaria: string;
  role: string;
  loginUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurado');
      return NextResponse.json(
        { 
          error: 'Serviço de email não configurado',
          details: 'RESEND_API_KEY não está definido nas variáveis de ambiente'
        },
        { status: 503 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { to, nome, email, senha_temporaria, role, loginUrl } = await request.json() as UserWelcomeRequest;

    // Validações
    if (!to || !nome || !email || !senha_temporaria || !role) {
      return NextResponse.json(
        { error: 'Dados obrigatórios: to, nome, email, senha_temporaria, role' },
        { status: 400 }
      );
    }

    // SEGURANÇA: Verificar se é um email válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Definir URL de login baseada no ambiente
    const baseUrl = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://sgbv2.vercel.app';
    const loginLink = `${baseUrl}/login`;

    // Definir função baseada no role
    const roleDescriptions: { [key: string]: string } = {
      'administrador': 'Administrador do Sistema',
      'financeiro': 'Gestor Financeiro',
      'operacional': 'Gestor Operacional',
      'funcionario': 'Funcionário',
      'gerente': 'Gerente'
    };

    const roleDescription = roleDescriptions[role] || 'Usuário do Sistema';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bem-vindo ao ZYKOR - Suas Credenciais de Acesso</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
        .subtitle { font-size: 16px; opacity: 0.9; }
        .content { padding: 30px; }
        .welcome-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: 600; margin-bottom: 20px; }
        .credentials-box { background: #1f2937; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .credential-item { margin: 10px 0; }
        .credential-label { color: #9ca3af; font-size: 14px; }
        .credential-value { color: #fbbf24; font-family: monospace; font-size: 16px; font-weight: bold; margin-top: 4px; }
        .login-button { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; margin: 20px 0; }
        .security-info { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .security-item { margin: 8px 0; color: #92400e; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        .role-badge { background: #3b82f6; color: white; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀 ZYKOR</div>
            <div class="subtitle">Sistema de Gestão de Bares</div>
        </div>
        
        <div class="content">
            <div class="welcome-badge">✅ Conta Criada com Sucesso</div>
            
            <h1 style="color: #1f2937; margin-bottom: 20px;">Olá, ${nome}!</h1>
            
            <p style="color: #4b5563; line-height: 1.6;">
                Bem-vindo ao ZYKOR! Sua conta foi criada com sucesso e você foi cadastrado como <span class="role-badge">${roleDescription}</span>. Este email contém suas credenciais de acesso ao sistema.
            </p>
            
            <div class="credentials-box">
                <h3 style="color: #fbbf24; margin-top: 0; margin-bottom: 20px;">🔑 Suas Credenciais de Acesso:</h3>
                
                <div class="credential-item">
                    <div class="credential-label">📧 Email:</div>
                    <div class="credential-value">${email}</div>
                </div>
                
                <div class="credential-item">
                    <div class="credential-label">🔒 Senha Temporária:</div>
                    <div class="credential-value">${senha_temporaria}</div>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${loginLink}" class="login-button">
                    🚀 Acessar o Sistema
                </a>
            </div>
            
            <div class="security-info">
                <h3 style="color: #92400e; margin-top: 0;">🔐 Informações de Segurança:</h3>
                <div class="security-item">• Esta é uma senha temporária que deve ser alterada no primeiro acesso</div>
                <div class="security-item">• O sistema solicitará automaticamente a criação de uma nova senha</div>
                <div class="security-item">• Nunca compartilhe suas credenciais com terceiros</div>
                <div class="security-item">• Mantenha seus dados de acesso em local seguro</div>
            </div>
            
            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #1e40af; margin-top: 0;">📋 Próximos Passos:</h4>
                <ol style="color: #1e3a8a; line-height: 1.6; margin: 0;">
                    <li>Acesse o sistema usando o botão acima</li>
                    <li>Faça login com suas credenciais</li>
                    <li>Redefina sua senha quando solicitado</li>
                    <li>Explore as funcionalidades disponíveis para seu perfil</li>
                </ol>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                💡 <strong>Dúvidas?</strong> Entre em contato com o administrador do sistema ou responda este email.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>ZYKOR - Sistema de Gestão de Bares</strong></p>
            <p>Este é um email automático de criação de conta. Mantenha suas credenciais seguras.</p>
            <p>📧 suporte@zykor.com.br | 🌐 zykor.com.br</p>
        </div>
    </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: 'ZYKOR Sistema <sistema@send.zykor.com.br>',
      to: [to],
      subject: 'Bem-vindo ao ZYKOR - Suas Credenciais de Acesso',
      html: htmlContent,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'ZYKOR Sistema v2.0',
        'Reply-To': 'suporte@zykor.com.br',
      },
      tags: [
        { name: 'category', value: 'user-onboarding' },
        { name: 'environment', value: process.env.NODE_ENV || 'production' }
      ]
    });

    return NextResponse.json({
      success: true,
      messageId: result.data?.id,
      message: 'Email de boas-vindas enviado com sucesso'
    });

  } catch (error) {
    console.error('🚨 Erro ao enviar email de boas-vindas:', error);
    
    return NextResponse.json(
      { error: 'Erro ao enviar email de boas-vindas. Tente novamente.' },
      { status: 500 }
    );
  }
}
