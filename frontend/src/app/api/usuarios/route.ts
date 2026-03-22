import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { normalizeEmail } from '@/lib/email-utils';

export const dynamic = 'force-dynamic'

// ========================================
// 👥 API PARA GERENCIAMENTO DE USUÁRIOS
// ========================================

interface UsuarioInput {
  bar_id: string | number;
  email: string;
  nome: string;
  password: string;
  role?: string;
  modulos_permitidos?: string[] | Record<string, any>;
}

interface AuthUser {
  user: {
    id: string;
  };
}

// ========================================
// 👥 GET /api/usuarios
// ========================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Usar cliente administrativo para operações de usuários
    let adminClient;
    try {
      adminClient = await getAdminClient();
    } catch (adminError) {
      console.error('❌ Erro ao obter cliente administrativo:', adminError);
      throw new Error('Configuração administrativa não disponível');
    }

    // Buscar usuários do bar
    const { data: usuarios, error } = await adminClient
      .from('usuarios_bar')
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw new Error('Erro ao buscar usuários');
    }

    return NextResponse.json({
      success: true,
      usuarios: usuarios || [],
    });
  } catch (error) {
    console.error('❌ Erro na API de usuários:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ========================================
// 👥 POST /api/usuarios
// ========================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UsuarioInput;
    const { bar_id, nome, password, role, modulos_permitidos } = body;
    const email = normalizeEmail(body.email); // ✅ Normaliza email

    if (!bar_id || !email || !nome || !password) {
      return NextResponse.json(
        { success: false, error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // PASSO 1: Obter cliente administrativo
    let adminClient;
    try {
      adminClient = await getAdminClient();
    } catch (adminError) {
      console.error('❌ Erro ao obter cliente administrativo:', adminError);
      return NextResponse.json(
        {
          success: false,
          error:
            'Configuração administrativa não disponível - verifique secrets',
        },
        { status: 500 }
      );
    }

    // Verificar se usuário já existe no bar
    const { data: usuarioExistente } = await adminClient
      .from('usuarios_bar')
      .select('id')
      .eq('email', email)
      .eq('bar_id', bar_id)
      .single();

    if (usuarioExistente) {
      return NextResponse.json(
        { success: false, error: 'Usuário já existe neste bar' },
        { status: 400 }
      );
    }

    const { data: authUser, error: authError } =
      (await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          role,
          bar_id: parseInt(bar_id as string),
        },
      })) as { data: AuthUser; error: { message: string } | null };

    if (authError) {
      console.error('❌ Erro ao criar usuário no Auth:', authError);
      return NextResponse.json(
        { success: false, error: `Erro de autenticação: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authUser.user) {
      return NextResponse.json(
        { success: false, error: 'Falha ao criar usuário de autenticação' },
        { status: 500 }
      );
    }

    // PASSO 2: Criar usuário na tabela usuarios_bar
    const { data: novoUsuario, error } = await adminClient
      .from('usuarios_bar')
      .insert([
        {
          bar_id: parseInt(bar_id as string),
          user_id: authUser.user.id,
          email,
          nome,
          role: role || 'funcionario',
          modulos_permitidos: modulos_permitidos || ['terminal_producao'],
          ativo: true,
          senha_redefinida: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar usuário na tabela:', error);

      // Se falhou ao criar na tabela, remover do Auth também
      await adminClient.auth.admin.deleteUser(authUser.user.id);

      return NextResponse.json(
        { success: false, error: 'Erro ao criar usuário no sistema' },
        { status: 500 }
      );
    }

    // 3. Enviar email de boas-vindas com credenciais
    try {
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://sgbv2.vercel.app'}/api/emails/user-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          nome,
          email,
          senha_temporaria: password,
          role: role || 'funcionario',
          loginUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://sgbv2.vercel.app'
        })
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok) {
        console.warn('⚠️ Falha ao enviar email de boas-vindas:', emailResult.error);
      }
    } catch (emailError) {
      console.warn('⚠️ Erro ao enviar email de boas-vindas:', emailError);
      // Não falhar o cadastro por causa do email
    }

    return NextResponse.json({
      success: true,
      usuario: novoUsuario,
      message: 'Usuário criado com sucesso! Email com credenciais de acesso foi enviado.',
      emailSent: true
    });
  } catch (error) {
    console.error('❌ Erro na API de criação de usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
