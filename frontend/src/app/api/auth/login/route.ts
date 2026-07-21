/**
 * API de Login - Versão Segura
 * Gera token JWT e retorna dados do usuário
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';
import { generateToken, generateRefreshToken } from '@/lib/auth/jwt';
import { resolveEffectiveModulos } from '@/lib/auth/effective-modulos';
import type { AuthenticatedUser } from '@/lib/auth/types';
import crypto from 'crypto';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limiter-middleware';

export const dynamic = 'force-dynamic';

async function handleLogin(request: NextRequest) {
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
      // registra a tentativa falha (auditoria de segurança) — nunca quebra o fluxo
      try {
        await adminClient.schema('system').rpc('login_attempt', {
          p_email: email, p_ip: clientIp, p_ua: userAgent, p_sucesso: false,
          p_motivo: authError?.message || 'email ou senha incorretos',
        });
      } catch { /* noop */ }
      return NextResponse.json(
        { success: false, error: authError?.message || 'Email ou senha incorretos' },
        { status: 401 }
      );
    }

    // Buscar dados do usuário na tabela usuarios
    let { data: usuarios, error: dbError } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('auth_id', authData.user.id)
      .eq('ativo', true);

    if (dbError || !usuarios || usuarios.length === 0) {
      // Tentar buscar por email e atualizar auth_id
      const { data: usuariosPorEmail } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('ativo', true);

      if (usuariosPorEmail && usuariosPorEmail.length > 0) {
        const usuarioExistente = usuariosPorEmail[0];
        
        // Atualizar auth_id
        await adminClient
      .schema('auth_custom')
      .from('usuarios')
          .update({ auth_id: authData.user.id })
          .eq('email', email);

        usuarios = [{ ...usuarioExistente, auth_id: authData.user.id }];
      } else {
        try {
          await adminClient.schema('system').rpc('login_attempt', {
            p_email: email, p_ip: clientIp, p_ua: userAgent, p_sucesso: false, p_motivo: 'usuário não encontrado ou inativo',
          });
        } catch { /* noop */ }
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
      // REUSAR token ainda válido em vez de regenerar a cada login. Antes, cada
      // tentativa gerava um token novo -> se o usuário tivesse a aba de redefinição
      // aberta de uma tentativa anterior, ela ficava com token velho e dava
      // "Token inválido". Só gera novo se não existir ou já tiver expirado. TTL 24h
      // (era 60min) pra cobrir 1º acesso sem pressa.
      const agora = Date.now();
      const expiraExistente = usuarioPrincipal.reset_token_expiry
        ? new Date(usuarioPrincipal.reset_token_expiry).getTime()
        : 0;
      let token: string = usuarioPrincipal.reset_token || '';
      if (!token || expiraExistente <= agora) {
        token = crypto.randomUUID();
        const tokenExpiry = new Date(agora + 24 * 60 * 60 * 1000).toISOString();
        await adminClient
          .schema('auth_custom')
          .from('usuarios')
          .update({
            reset_token: token,
            reset_token_expiry: tokenExpiry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', usuarioPrincipal.id);
      }

      // URL RELATIVA: a navegacao acontece no mesmo origin que o usuario ja esta.
      // (Antes era absoluta, montada do header host -> na Vercel podia apontar pro
      //  dominio do deployment *.vercel.app e jogar o usuario num origin/ambiente
      //  diferente, causando o loop de "volta pro login" no primeiro acesso.)
      return NextResponse.json({
        success: false,
        requirePasswordReset: true,
        redirectUrl: `/usuarios/redefinir-senha?email=${encodeURIComponent(usuarioPrincipal.email)}&token=${token}`,
        user: {
          nome: usuarioPrincipal.nome,
          email: usuarioPrincipal.email,
        },
        message: 'É necessário redefinir sua senha no primeiro acesso',
      });
    }

    // Buscar bares do usuário
    const { data: usuariosBares } = await adminClient
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', usuarioPrincipal.auth_id);

    const barIds = usuariosBares?.map((ub: { bar_id: number }) => ub.bar_id) || [];

    // Buscar dados completos dos bares
    const { data: barsData } = await adminClient
      .schema('operations')
      .from('bares')
      .select('id, nome')
      .in('id', barIds)
      .eq('ativo', true);

    // Módulos EFETIVOS = do PERFIL (fonte da verdade) quando houver perfil_id e não for admin.
    // Admin/'todos' e usuários sem perfil mantêm os módulos próprios. Ver resolveEffectiveModulos.
    const modulosPermitidos: string[] = await resolveEffectiveModulos({
      role: usuarioPrincipal.role,
      perfil_id: usuarioPrincipal.perfil_id,
      modulos_permitidos: usuarioPrincipal.modulos_permitidos,
    });

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

    // Sessão + registro do login (auditoria de acessos) — best-effort, nunca quebra o login
    let sessionId: string | null = null;
    try {
      const { data: sid } = await adminClient.schema('system').rpc('session_start', {
        p_email: usuarioPrincipal.email, p_user_id: usuarioPrincipal.id,
        p_bar_id: selectedBar.bar_id, p_ip: clientIp, p_ua: userAgent,
      });
      sessionId = (sid as string) || null;
      await adminClient.schema('system').rpc('login_attempt', {
        p_email: usuarioPrincipal.email, p_ip: clientIp, p_ua: userAgent, p_sucesso: true, p_motivo: null,
      });
    } catch { /* noop */ }

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
    // TODO(rodrigo/2026-05): Remover sgb_user quando migração estiver completa
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
      httpOnly: false, // Não httpOnly para permitir leitura client-side (cache)
    });

    // id da sessão (auditoria de acessos) — httpOnly; o heartbeat lê do cookie no servidor
    if (sessionId) {
      response.cookies.set('zk_sid', sessionId, { ...cookieOptions, httpOnly: true });
    }

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

export const POST = withRateLimit(handleLogin, RATE_LIMIT_PRESETS.AUTH);
