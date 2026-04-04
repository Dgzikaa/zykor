import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limiter-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        
        if (!emailResponse.ok) {
          console.warn('⚠️ Falha ao enviar email de reset:', emailResult.error);
        }
      } else {
        const textResponse = await emailResponse.text();
        console.warn('⚠️ Resposta não-JSON da API de email:', textResponse.substring(0, 200));
      }
    } catch (emailError) {
      console.warn('⚠️ Erro ao enviar email de reset:', emailError);
      // Não falhar a operação por causa do email
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
