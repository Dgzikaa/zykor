import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getUserAuth } from '@/lib/auth-helper';

// Força runtime dinâmico para evitar erro de static generation
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    // Obter dados do usuário autenticado
    const user = await getUserAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { senhaAtual, novaSenha, confirmarSenha } = body;

    // Validações básicas
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      return NextResponse.json(
        { success: false, error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    if (novaSenha !== confirmarSenha) {
      return NextResponse.json(
        { success: false, error: 'Nova senha e confirmação não coincidem' },
        { status: 400 }
      );
    }

    if (novaSenha.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nova senha deve ter pelo menos 6 caracteres',
        },
        { status: 400 }
      );
    }

    // Usar cliente administrativo para operações com Auth
    const adminClient = await getAdminClient();

    // Dados vêm do token (resolver seguro): email + auth_id. Sem depender da tabela
    // legada usuarios_bar (onde usuários do schema atual nem existem -> dava 404).
    const email = user.email;
    const authUserId = user.user_id; // auth.users.id

    // Verificar senha atual fazendo login
    try {
      const { error: signInError } = await adminClient.auth.signInWithPassword({
        email,
        password: senhaAtual,
      });

      if (signInError) {
        return NextResponse.json(
          { success: false, error: 'Senha atual incorreta' },
          { status: 400 }
        );
      }
    } catch (authError) {
      console.error('❌ Erro na verificação da senha atual:', authError);
      return NextResponse.json(
        { success: false, error: 'Erro na verificação da senha atual' },
        { status: 500 }
      );
    }

    // Atualizar senha no Supabase Auth
    try {
      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(authUserId, {
          password: novaSenha,
          user_metadata: {
            senha_alterada_em: new Date().toISOString(),
            senha_alterada_pelo_usuario: true,
          },
        });

      if (updateError) {
        console.error('❌ Erro ao atualizar senha no Auth:', updateError);
        return NextResponse.json(
          { success: false, error: 'Erro ao atualizar senha' },
          { status: 500 }
        );
      }
    } catch (authUpdateError) {
      console.error('❌ Erro na atualização da senha:', authUpdateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar senha' },
        { status: 500 }
      );
    }

    // Marcar senha_redefinida + atividade no schema atual (auth_custom.usuarios = view de public.usuarios)
    const { error: dbUpdateError } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .update({
        senha_redefinida: true,
        ultima_atividade: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('auth_id', authUserId);

    if (dbUpdateError) {
      console.error(
        '❌ Erro ao atualizar flag senha_redefinida:',
        dbUpdateError
      );
      // Não falha aqui, pois a senha já foi alterada com sucesso
    }

    return NextResponse.json({
      success: true,
      message:
        'Senha alterada com sucesso! Por segurança, faça login novamente.',
      require_relogin: true,
    });
  } catch (error) {
    console.error('❌ Erro na API de trocar senha:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
