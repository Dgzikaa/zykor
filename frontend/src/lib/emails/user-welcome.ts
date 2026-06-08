import { Resend } from 'resend';

// Envio do email de boas-vindas (credenciais) via Resend.
// Função compartilhada: chamada direto pela criação de usuário (sem fetch interno
// dependente de NEXT_PUBLIC_APP_URL) e pela rota /api/emails/user-welcome.

export interface UserWelcomeParams {
  to: string;
  nome: string;
  email: string;
  senha_temporaria: string;
  role: string;
  loginUrl?: string;
}

export type EnvioResultado =
  | { success: true; messageId?: string }
  | { success: false; error: string };

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador do Sistema',
  administrador: 'Administrador do Sistema',
  financeiro: 'Gestor Financeiro',
  operacional: 'Gestor Operacional',
  funcionario: 'Funcionário',
  gerente: 'Gerente',
};

function montarHtml(p: UserWelcomeParams, loginLink: string): string {
  const roleDescription = ROLE_LABEL[p.role] || 'Usuário do Sistema';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bem-vindo ao ZYKOR</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 40px 20px; text-align: center; color: white; }
  .logo { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
  .content { padding: 30px; }
  .credentials-box { background: #1f2937; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .credential-label { color: #9ca3af; font-size: 14px; }
  .credential-value { color: #fbbf24; font-family: monospace; font-size: 16px; font-weight: bold; margin-top: 4px; }
  .login-button { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; margin: 20px 0; }
  .security-info { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; color: #92400e; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  .role-badge { background: #3b82f6; color: white; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">🚀 ZYKOR</div><div>Sistema de Gestão de Bares</div></div>
    <div class="content">
      <h1 style="color:#1f2937;">Olá, ${p.nome}!</h1>
      <p style="color:#4b5563;line-height:1.6;">Sua conta foi criada como <span class="role-badge">${roleDescription}</span>. Abaixo estão suas credenciais de acesso.</p>
      <div class="credentials-box">
        <h3 style="color:#fbbf24;margin-top:0;">🔑 Credenciais de acesso</h3>
        <div class="credential-label">📧 Email</div>
        <div class="credential-value">${p.email}</div>
        <div class="credential-label" style="margin-top:14px;">🔒 Senha temporária</div>
        <div class="credential-value">${p.senha_temporaria}</div>
      </div>
      <div style="text-align:center;"><a href="${loginLink}" class="login-button">🚀 Acessar o sistema</a></div>
      <div class="security-info">
        <strong>Segurança:</strong> esta é uma senha temporária — o sistema vai pedir pra você criar uma nova no primeiro acesso. Nunca compartilhe suas credenciais.
      </div>
    </div>
    <div class="footer">
      <p><strong>ZYKOR — Sistema de Gestão de Bares</strong></p>
      <p>📧 suporte@zykor.com.br · 🌐 zykor.com.br</p>
    </div>
  </div>
</body>
</html>`;
}

export async function enviarEmailBoasVindas(p: UserWelcomeParams): Promise<EnvioResultado> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY não configurado' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!p.to || !emailRegex.test(p.to)) {
    return { success: false, error: 'Email de destino inválido' };
  }

  const loginLink = `${(p.loginUrl || 'https://zykor.com.br').replace(/\/$/, '')}/login`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: 'ZYKOR Sistema <sistema@send.zykor.com.br>',
      to: [p.to],
      subject: 'Bem-vindo ao ZYKOR - Suas credenciais de acesso',
      html: montarHtml(p, loginLink),
      headers: { 'Reply-To': 'suporte@zykor.com.br' },
      tags: [{ name: 'category', value: 'user-onboarding' }],
    });
    if ((result as any)?.error) {
      return { success: false, error: (result as any).error?.message || 'Resend recusou o envio' };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao enviar email' };
  }
}
