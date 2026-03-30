/**
 * API de Login - Versão Segura
 * Gera token JWT e retorna dados do usuário
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';
import { generateToken, generateRefreshToken } from '@/lib/auth/jwt';
import type { AuthenticatedUser } from '@/lib/auth/types';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Capturar informações do cliente
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = forwarded
    ? forwarded.split(',')[0]
    : request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const { email, password, senha } = await request.json();
    const userPassword = password || senha;

    if (!email || !userPassword) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Obter clientes Supabase
    const adminClient = await getAdminClient();
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Autenticar com Supabase Auth
    const { data: authData, error: authError } =
      await authClient.auth.signInWithPassword({
        email,
        password: userPassword,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || 'Email ou senha incorretos' },
        { status: 401 }
      );
    }

    // Buscar dados do usuário na tabela usuarios
    let { data: usuarios, error: dbError } = await adminClient
      .from('usuarios')
      .select('*')
      .eq('auth_id', authData.user.id)
      .eq('ativo', true);

    if (dbError || !usuarios || usuarios.length === 0) {
      // Tentar buscar por email e atualizar auth_id
      const { data: usuariosPorEmail } = await adminClient
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('ativo', true);

      if (usuariosPorEmail && usuariosPorEmail.length > 0) {
        const usuarioExistente = usuariosPorEmail[0];
        
        // Atualizar auth_id
        await adminClient
          .from('usuarios')
          .update({ auth_id: authData.user.id })
          .eq('email', email);

        usuarios = [{ ...usuarioExistente, auth_id: authData.user.id }];
      } else {
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado ou inativo' },
          { status: 401 }
        );
      }
    }

    if (!usuarios || usuarios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 401 }
      );
    }

    const usuarioPrincipal = usuarios[0];

    // Verificar se precisa redefinir senha
    if (!usuarioPrincipal.senha_redefinida) {
      const token = crypto.randomUUID();
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Persistir token no schema atual
      await adminClient
        .from('usuarios')
        .update({
          reset_token: token,
          reset_token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq('id', usuarioPrincipal.id);

      // Compatibilidade: tentar salvar também em usuarios_bar (schema legado)
      await adminClient
        .from('usuarios_bar')
        .update({
          reset_token: token,
          reset_token_expiry: tokenExpiry,
          atualizado_em: new Date().toISOString(),
        })
        .eq('email', usuarioPrincipal.email);

      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
      const baseUrl = host?.includes('localhost') 
        ? `http://${host}` 
        : `${protocol}://${host}`;

      return NextResponse.json({
        success: false,
        requirePasswordReset: true,
        redirectUrl: `${baseUrl}/usuarios/redefinir-senha?email=${encodeURIComponent(usuarioPrincipal.email)}&token=${token}`,
        user: {
          nome: usuarioPrincipal.nome,
          email: usuarioPrincipal.email,
        },
        message: 'É necessário redefinir sua senha no primeiro acesso',
      });
    }

    // Buscar bares do usuário
    const { data: usuariosBares } = await adminClient
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', usuarioPrincipal.auth_id);

    const barIds = usuariosBares?.map((ub: { bar_id: number }) => ub.bar_id) || [];

    // Buscar dados completos dos bares
    const { data: barsData } = await adminClient
      .from('bares')
      .select('id, nome')
      .in('id', barIds)
      .eq('ativo', true);

    // Normalizar modulos_permitidos como array
    let modulosPermitidos: string[] = [];
    if (Array.isArray(usuarioPrincipal.modulos_permitidos)) {
      modulosPermitidos = usuarioPrincipal.modulos_permitidos;
    } else if (typeof usuarioPrincipal.modulos_permitidos === 'object' && usuarioPrincipal.modulos_permitidos) {
      modulosPermitidos = Object.keys(usuarioPrincipal.modulos_permitidos).filter(
        k => usuarioPrincipal.modulos_permitidos[k]
      );
    }

    // Criar array de bares com permissões
    const baresComNome = barsData?.map((bar: { id: number; nome: string }) => ({
      bar_id: bar.id,
      id: bar.id,
      nome: bar.nome,
      role: usuarioPrincipal.role,
      modulos_permitidos: modulosPermitidos,
    })) || [];

    // Selecionar primeiro bar como padrão
    const selectedBar = baresComNome[0] || { bar_id: 0, id: 0, nome: 'Sem bar' };

    // Gerar token JWT (7 dias) e refresh token (30 dias)
    const token = generateToken({
      user_id: usuarioPrincipal.id,
      auth_id: usuarioPrincipal.auth_id,
      email: usuarioPrincipal.email,
      bar_id: selectedBar.bar_id,
      role: usuarioPrincipal.role,
      modulos_permitidos: modulosPermitidos,
    });

    const refreshToken = generateRefreshToken({
      user_id: usuarioPrincipal.id,
      auth_id: usuarioPrincipal.auth_id,
      email: usuarioPrincipal.email,
      bar_id: selectedBar.bar_id,
      role: usuarioPrincipal.role,
      modulos_permitidos: modulosPermitidos,
    });

    // Preparar dados do usuário
    const user: AuthenticatedUser = {
      id: usuarioPrincipal.id,
      auth_id: usuarioPrincipal.auth_id,
      email: usuarioPrincipal.email,
      nome: usuarioPrincipal.nome,
      role: usuarioPrincipal.role,
      bar_id: selectedBar.bar_id,
      modulos_permitidos: modulosPermitidos,
      ativo: usuarioPrincipal.ativo,
      senha_redefinida: usuarioPrincipal.senha_redefinida,
      setor: usuarioPrincipal.setor,
      telefone: usuarioPrincipal.telefone,
      created_at: usuarioPrincipal.created_at,
      updated_at: usuarioPrincipal.updated_at,
    };

    // Criar resposta com cookie
    const response = NextResponse.json({
      success: true,
      user,
      availableBars: baresComNome,
      token,
    });

    // Configurações de cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    };

    // Salvar token em cookie httpOnly (7 dias)
    response.cookies.set('auth_token', token, {
      ...cookieOptions,
      httpOnly: true,
    });

    // Salvar refresh token (30 dias)
    response.cookies.set('refresh_token', refreshToken, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });

    // Manter cookie sgb_user para compatibilidade (temporário)
    const userCookie = {
      id: usuarioPrincipal.id,
      auth_id: usuarioPrincipal.auth_id,
      email: usuarioPrincipal.email,
      nome: usuarioPrincipal.nome,
      role: usuarioPrincipal.role,
      bar_id: selectedBar.bar_id,
      modulos_permitidos: modulosPermitidos,
      ativo: usuarioPrincipal.ativo,
    };

    response.cookies.set('sgb_user', JSON.stringify(userCookie), {
      ...cookieOptions,
      httpOnly: false,
    });

    return response;
  } catch (error: unknown) {
    console.error('🔥 Erro fatal na API de login:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
