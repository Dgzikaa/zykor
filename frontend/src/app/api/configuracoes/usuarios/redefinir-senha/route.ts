import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeEmail } from '@/lib/email-utils';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Enviar link de redefinição de senha para o usuário
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userAuthId, email } = body;

    if (!userId && !userAuthId && !email) {
      return NextResponse.json(
        { error: 'Identificador do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Buscar dados do usuário no schema atual com fallback
    const usuariosQuery = () =>
      supabase.from('usuarios').select('id, auth_id, email, nome, role').limit(1);

    let usuario: any = null;
    let fetchError: any = null;

    if (userId !== undefined && userId !== null) {
      const rawUserId = String(userId).trim();
      if (rawUserId) {
        console.log('🔍 Tentando encontrar usuário por userId:', rawUserId);

        if (/^\d+$/.test(rawUserId)) {
          const byNumericId = await usuariosQuery().eq('id', Number(rawUserId));
          usuario = byNumericId.data?.[0] || null;
          fetchError = byNumericId.error;
        }

        if (!usuario) {
          const byStringId = await usuariosQuery().eq('id', rawUserId);
          usuario = byStringId.data?.[0] || null;
          fetchError = byStringId.error;
        }

        if (!usuario) {
          const byAuthId = await usuariosQuery().eq('auth_id', rawUserId);
          usuario = byAuthId.data?.[0] || null;
          fetchError = byAuthId.error;
        }
      }
    }

    if (!usuario && userAuthId) {
      const rawAuthId = String(userAuthId).trim();
      if (rawAuthId) {
        console.log('🔍 Tentando encontrar usuário por auth_id:', rawAuthId);
        const byAuthId = await usuariosQuery().eq('auth_id', rawAuthId);
        usuario = byAuthId.data?.[0] || null;
        fetchError = byAuthId.error;
      }
    }

    if (!usuario && email) {
      const normalizedEmail = normalizeEmail(String(email));
      if (normalizedEmail) {
        console.log('🔍 Tentando encontrar usuário por email:', normalizedEmail);
        const byEmail = await usuariosQuery().eq('email', normalizedEmail);
        usuario = byEmail.data?.[0] || null;
        fetchError = byEmail.error;
      }
    }

    if (fetchError || !usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    if (!usuario.auth_id) {
      return NextResponse.json(
        { error: 'Usuário não possui conta de autenticação vinculada' },
        { status: 400 }
      );
    }

    // 2. Gerar senha temporária (método mais direto para admin)
    const senhaTemporaria = `Temp${Math.random().toString(36).substring(2, 8)}!`;
    
    console.log('🔑 Gerando senha temporária para:', usuario.email);
    console.log('👤 Auth ID:', usuario.auth_id);
    console.log('🔐 Senha temporária gerada:', senhaTemporaria);
    
    // 3. Atualizar senha no Supabase Auth
    console.log('🔄 Atualizando senha no Supabase Auth...');
    const { data: authData, error: authUpdateError } = await supabase.auth.admin.updateUserById(
      usuario.auth_id,
      { 
        password: senhaTemporaria,
        email_confirm: true, // Garantir que email está confirmado
      }
    );

    if (authUpdateError) {
      console.error('❌ Erro ao atualizar senha no Auth:', authUpdateError);
      console.error('❌ Código do erro:', authUpdateError.status);
      console.error('❌ Mensagem:', authUpdateError.message);
      return NextResponse.json(
        { 
          error: 'Erro ao atualizar senha no Auth',
          details: authUpdateError.message 
        },
        { status: 500 }
      );
    }

    if (!authData || !authData.user) {
      console.error('❌ Resposta do Auth não contém dados do usuário');
      return NextResponse.json(
        { 
          error: 'Erro ao atualizar senha: resposta inválida do servidor',
        },
        { status: 500 }
      );
    }

    console.log('✅ Senha atualizada no Auth com sucesso');
    console.log('✅ User ID confirmado:', authData.user.id);
    console.log('✅ Email confirmado:', authData.user.email);

    // 4. Buscar email REAL do Auth (pode ser diferente do banco)
    console.log('🔍 Verificando email real no Supabase Auth...');
    const { data: authUserCheck } = await supabase.auth.admin.getUserById(usuario.auth_id);
    
    let emailParaLogin = normalizeEmail(usuario.email);
    if (authUserCheck?.user?.email) {
      const emailNoAuth = normalizeEmail(authUserCheck.user.email);
      console.log('📧 Email no banco:', emailParaLogin);
      console.log('📧 Email no Auth:', emailNoAuth);
      
      if (emailNoAuth !== emailParaLogin) {
        console.warn('⚠️ ATENÇÃO: Email no Auth é diferente! Usando email do Auth para login.');
        emailParaLogin = emailNoAuth;
      }
    }

    // 5. TESTAR LOGIN para garantir que a senha funciona
    console.log('🧪 Testando login com a senha temporária...');
    console.log('📧 Email usado no teste:', emailParaLogin);
    console.log('🔐 Senha usada no teste:', senhaTemporaria);
    
    const { data: testLogin, error: testError } = await supabase.auth.signInWithPassword({
      email: emailParaLogin,
      password: senhaTemporaria,
    });

    if (testError || !testLogin.user) {
      console.error('❌ ERRO CRÍTICO: Senha atualizada mas login falhou!');
      console.error('❌ Erro do teste:', testError?.message);
      console.error('❌ Código do erro:', testError?.status);
      console.error('❌ Email usado no teste:', emailParaLogin);
      console.error('❌ Auth ID:', usuario.auth_id);
      
      // Retornar erro para o admin saber que não funcionou
      return NextResponse.json({
        success: false,
        error: 'Senha atualizada mas login de teste falhou',
        details: testError?.message || 'Erro desconhecido',
        emailUsadoNoTeste: emailParaLogin,
        emailNoBanco: usuario.email,
        senhaTemporaria: senhaTemporaria,
        aviso: 'A senha foi atualizada no Auth, mas o login de teste falhou. Verifique se o email está correto.'
      }, { status: 500 });
    } else {
      console.log('✅ Login de teste bem-sucedido! Senha está funcionando.');
      // Fazer sign out do teste
      await supabase.auth.signOut();
    }

    // 4. Gerar token único de redefinição (para link alternativo)
    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Expira em 1 hora

    // 5. Salvar token no banco e marcar que precisa redefinir senha
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString(),
        senha_redefinida: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuario.id);

    if (updateError) {
      console.error('❌ Erro ao salvar token de reset:', updateError);
      // Não falhar, a senha já foi atualizada
    }

    // 4. Gerar URL de redefinição
    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NODE_ENV === 'development'
      ? `${requestUrl.protocol}//${requestUrl.host}`
      : 'https://zykor.com.br';
    
    const resetLink = `${baseUrl}/usuarios/redefinir-senha?email=${encodeURIComponent(usuario.email)}&token=${resetToken}`;

    // 5. Tentar enviar email com link de redefinição
    let emailSent = false;
    let emailError: string | null = null;
    
    try {
      const internalBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      
      const emailResponse = await fetch(`${internalBaseUrl}/api/emails/password-reset-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: usuario.email,
          nome: usuario.nome,
          email: usuario.email,
          resetLink: resetLink,
          expiresIn: '1 hora'
        })
      });

      if (emailResponse.ok) {
        emailSent = true;
        console.log('✅ Email de redefinição (link) enviado para:', usuario.email);
      } else {
        const errorData = await emailResponse.json().catch(() => ({}));
        emailError = errorData.error || 'Falha ao enviar email';
        console.warn('⚠️ Falha ao enviar email de redefinição:', emailError);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Erro desconhecido';
      console.warn('⚠️ Erro ao enviar email:', err);
    }

    // 6. Retornar resultado com senha temporária
    // NOTA: Removido envio duplicado de email com senha temporária
    // O email com link (password-reset-link) já foi enviado acima
    return NextResponse.json({ 
      success: true,
      message: emailSent
        ? `✅ Email enviado para ${usuario.email}` 
        : `⚠️ Não foi possível enviar o email: ${emailError || 'Erro desconhecido'}`,
      emailSent: emailSent,
      emailError: emailError || undefined,
      // Sempre fornecer a senha temporária para o admin
      resetData: {
        email: usuario.email,
        emailParaLogin: emailParaLogin, // Email que deve ser usado no login
        nome: usuario.nome,
        temporaryPassword: senhaTemporaria, // 🔑 SENHA TEMPORÁRIA
        resetLink: resetLink,
        expiresAt: resetTokenExpiry.toISOString(),
        message: emailSent
          ? '📧 Email enviado! Senha temporária abaixo para compartilhar com o usuário:' 
          : '⚠️ Email não enviado! Use a senha temporária abaixo para compartilhar com o usuário:',
        avisoEmail: emailParaLogin !== usuario.email.toLowerCase().trim() 
          ? `⚠️ IMPORTANTE: Use o email "${emailParaLogin}" para fazer login (email no Auth é diferente do banco)`
          : undefined
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar link de redefinição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
