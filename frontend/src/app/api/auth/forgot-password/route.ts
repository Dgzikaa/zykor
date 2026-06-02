import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limiter-middleware';

const supabase = createServiceRoleClient();

async function notifyResendFailure(ctx: { email: string; nome: string; erro: string | null }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  const payload = {
    username: 'Zykor Monitor',
    embeds: [{
      title: '🚨 Falha no envio de email (reset de senha)',
      description: `Usuário pediu reset, senha temporária foi gerada no Supabase Auth, **mas o email não foi enviado**. Conta está sem senha funcional até intervenção manual.`,
      color: 15158332,
      fields: [
        { name: 'Email', value: ctx.email, inline: true },
        { name: 'Nome', value: ctx.nome || '—', inline: true },
        { name: 'Erro Resend', value: (ctx.erro || 'desconhecido').substring(0, 1000) },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'forgot-password route' }
    }]
  };
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function handleForgotPassword(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Verificar se usuário existe na tabela usuarios_bar
    const { data: usuario, error: fetchError } = await supabase
      .from('usuarios_bar')
      .select('id, user_id, email, nome, role, ativo')
      .eq('email', email)
      .eq('ativo', true)
      .single();

    if (fetchError || !usuario) {
      // Por segurança, sempre retornar sucesso (não revelar se email existe)
      return NextResponse.json({
        success: true,
        message: 'Se o email existir em nossa base, você receberá instruções para redefinir sua senha.'
      });
    }

    // 2. Gerar nova senha temporária
    const senhaTemporaria = `Temp${Math.random().toString(36).substring(2, 8)}!`;
    
    // 3. Atualizar senha no Supabase Auth
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      usuario.user_id,
      { password: senhaTemporaria }
    );

    if (authUpdateError) {
      console.error('❌ Erro ao atualizar senha no Auth:', authUpdateError);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // 4. Marcar que precisa redefinir senha
    const { error: updateError } = await supabase
      .from('usuarios_bar')
      .update({ 
        senha_redefinida: false,
        ultima_atividade: new Date().toISOString()
      })
      .eq('id', usuario.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar flag senha_redefinida:', updateError);
    }

    // 5. Enviar email com nova senha temporária
    let emailEnviado = false;
    let emailErro: string | null = null;
    try {
      const baseUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://zykor.com.br');

      const emailResponse = await fetch(`${baseUrl}/api/emails/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          nome: usuario.nome,
          email,
          senha_temporaria: senhaTemporaria,
          role: usuario.role,
          loginUrl: baseUrl
        })
      });

      const contentType = emailResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const emailResult = await emailResponse.json();
        if (emailResponse.ok && emailResult?.success) {
          emailEnviado = true;
        } else {
          emailErro = emailResult?.error || emailResult?.details || `HTTP ${emailResponse.status}`;
        }
      } else {
        emailErro = `Resposta não-JSON HTTP ${emailResponse.status}: ${(await emailResponse.text()).substring(0, 200)}`;
      }
    } catch (e) {
      emailErro = e instanceof Error ? e.message : String(e);
    }

    if (!emailEnviado) {
      console.error('❌ Falha ao enviar email de reset:', { email, emailErro });
      await notifyResendFailure({ email, nome: usuario.nome, erro: emailErro }).catch(err =>
        console.error('❌ Falha também ao notificar Discord:', err)
      );
      return NextResponse.json(
        {
          error: 'Senha temporária gerada, mas houve falha ao enviar o email. Equipe foi notificada — tente novamente em alguns minutos ou contate suporte@zykor.com.br',
          email_falhou: true
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Se o email existir em nossa base, você receberá instruções para redefinir sua senha.'
    });

  } catch (error) {
    console.error('❌ Erro no reset de senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(handleForgotPassword, RATE_LIMIT_PRESETS.AUTH);
