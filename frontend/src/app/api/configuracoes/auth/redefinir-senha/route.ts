import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

// Criar cliente Supabase com service role key (mesmo padrão das outras APIs)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, novaSenha, token } = await request.json();
    const emailNormalizado = String(email || '')
      .toLowerCase()
      .trim();

    if (!email || !novaSenha || !token) {
      return NextResponse.json(
        { success: false, error: 'Email, nova senha e token são obrigatórios' },
        { status: 400 }
      );
    }

    if (novaSenha.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuário pelo email e validar token
    // 1) Priorizar schema atual: usuarios
    const { data: usuariosData, error: usuariosError } = await supabase
      .from('usuarios')
      .select('id, auth_id, email, nome, reset_token, reset_token_expiry, ativo')
      .eq('email', emailNormalizado)
      .eq('ativo', true)
      .limit(1);

    // 2) Fallback schema legado: usuarios_bar
    const { data: usuariosBarData, error: usuariosBarError } = await supabase
      .from('usuarios_bar')
      .select('id, user_id, email, nome, reset_token, reset_token_expiry, ativo')
      .eq('email', emailNormalizado)
      .eq('ativo', true)
      .order('reset_token', { ascending: false, nullsFirst: false })
      .limit(1);

    const usuarioAtual = usuariosData?.[0];
    const usuarioLegado = usuariosBarData?.[0];

    if (
      (usuariosError && !usuarioAtual) &&
      (usuariosBarError && !usuarioLegado)
    ) {
      console.error('❌ Usuário não encontrado com email:', emailNormalizado);
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const resetTokenBanco = usuarioAtual?.reset_token || usuarioLegado?.reset_token;
    const resetTokenExpiryBanco =
      usuarioAtual?.reset_token_expiry || usuarioLegado?.reset_token_expiry;
    const authUserId = usuarioAtual?.auth_id || usuarioLegado?.user_id;

    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: 'Usuário sem vínculo de autenticação' },
        { status: 400 }
      );
    }

    // Verificar se o token corresponde
    if (!resetTokenBanco || resetTokenBanco !== token) {
      console.error('❌ Token não corresponde ou não existe');
      return NextResponse.json(
        { success: false, error: 'Token inválido. Solicite uma nova recuperação de senha.' },
        { status: 400 }
      );
    }

    // Verificar se o token não expirou
    if (resetTokenExpiryBanco) {
      const tokenExpiry = new Date(resetTokenExpiryBanco);
      if (tokenExpiry < new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token expirado. Solicite uma nova recuperação de senha',
          },
          { status: 400 }
        );
      }
    }

    // Atualizar senha no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        password: novaSenha,
        email_confirm: true,
      }
    );

    if (authError) {
      console.error('❌ Erro ao atualizar senha no Auth:', authError);
      console.error('❌ Código do erro:', authError.status);
      console.error('❌ Mensagem:', authError.message);
      console.error('❌ Detalhes completos:', JSON.stringify(authError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar senha: ' + authError.message },
        { status: 500 }
      );
    }

    if (!authData || !authData.user) {
      console.error('❌ Resposta do Auth não contém dados do usuário');
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar senha: resposta inválida do servidor' },
        { status: 500 }
      );
    }

    // Limpar token e marcar senha redefinida no schema atual
    const { error: updateUsuariosError } = await supabase
      .from('usuarios')
      .update({
        senha_redefinida: true,
        reset_token: null,
        reset_token_expiry: null,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_id', authUserId);

    if (updateUsuariosError) {
      console.error('⚠️ Erro ao atualizar usuarios:', updateUsuariosError);
    }

    // Compatibilidade com schema legado
    const { error: updateUsuariosBarError } = await supabase
      .from('usuarios_bar')
      .update({
        senha_redefinida: true,
        reset_token: null,
        reset_token_expiry: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('user_id', authUserId);

    if (updateUsuariosBarError) {
      console.error('⚠️ Erro ao atualizar usuarios_bar:', updateUsuariosBarError);
    }

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error) {
    console.error('🔥 Erro inesperado:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
