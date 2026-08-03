import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'

// Criar cliente Supabase com service role key (mesmo padrão das outras APIs)
const supabase = createServiceRoleClient();

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

    if (novaSenha.length < 8 || !/[A-Za-z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 8 caracteres, com letras e números' },
        { status: 400 }
      );
    }

    // Buscar usuário pelo email e validar token.
    // IMPORTANTE: match case-INSENSITIVE (ilike). O email pode ter sido salvo com
    // maiúsculas em cadastros antigos, enquanto o Supabase Auth guarda minúsculo.
    // Com .eq (case-sensitive) a linha não era encontrada e caía no erro enganoso
    // "Usuário sem vínculo de autenticação" (o vínculo existe; só não bateu o email).
    // 1) Priorizar schema atual: usuarios
    const { data: usuariosData, error: usuariosError } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('id, auth_id, email, nome, reset_token, reset_token_expiry, ativo')
      .ilike('email', emailNormalizado)
      .eq('ativo', true)
      .limit(1);

    // O fallback pro schema legado (`usuarios_bar`) foi removido em 03/08/2026: a tabela não
    // existe mais, então a consulta só devolvia PGRST205 e o resultado era sempre vazio —
    // código morto que ainda poluía o log de erro a cada redefinição de senha.
    const usuarioAtual = usuariosData?.[0];

    // Nenhuma linha encontrada → usuário não existe (não é falta de vínculo).
    if (!usuarioAtual) {
      console.error('❌ Usuário não encontrado com email:', emailNormalizado);
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const resetTokenBanco = usuarioAtual?.reset_token;
    const resetTokenExpiryBanco = usuarioAtual?.reset_token_expiry;
    const authUserId = usuarioAtual?.auth_id;

    // Linha existe mas sem auth_id/user_id → aí sim é falta de vínculo de autenticação real.
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
      .schema('auth_custom')
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

    // (o UPDATE espelho no schema legado `usuarios_bar` foi removido — tabela inexistente,
    // só gerava "⚠️ Erro ao atualizar usuarios_bar: PGRST205" a cada redefinição de senha)

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
