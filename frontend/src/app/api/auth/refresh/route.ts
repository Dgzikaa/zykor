/**
 * API para renovar token JWT usando refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateRefreshToken, generateToken } from '@/lib/auth/jwt';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Pegar refresh token do cookie
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token não encontrado' },
        { status: 401 }
      );
    }

    // Validar refresh token
    const decoded = validateRefreshToken(refreshToken);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Refresh token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Buscar dados atualizados do usuário
    const adminClient = await getAdminClient();
    const { data: usuario, error } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('id', decoded.user_id)
      .eq('ativo', true)
      .single();

    if (error || !usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado ou inativo' },
        { status: 401 }
      );
    }

    // Normalizar modulos_permitidos
    let modulosPermitidos: string[] = [];
    if (Array.isArray(usuario.modulos_permitidos)) {
      modulosPermitidos = usuario.modulos_permitidos;
    } else if (typeof usuario.modulos_permitidos === 'object' && usuario.modulos_permitidos) {
      modulosPermitidos = Object.keys(usuario.modulos_permitidos).filter(
        k => usuario.modulos_permitidos[k]
      );
    }

    // Gerar novo token JWT
    const newToken = generateToken({
      user_id: usuario.id,
      auth_id: usuario.auth_id,
      email: usuario.email,
      bar_id: decoded.bar_id,
      role: usuario.role,
      modulos_permitidos: modulosPermitidos,
    });

    // Criar resposta
    const response = NextResponse.json({
      success: true,
      token: newToken,
    });

    // Configurações de cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
      httpOnly: true,
    };

    // Atualizar cookie de token
    response.cookies.set('auth_token', newToken, cookieOptions);

    return response;
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao renovar token' },
      { status: 500 }
    );
  }
}
