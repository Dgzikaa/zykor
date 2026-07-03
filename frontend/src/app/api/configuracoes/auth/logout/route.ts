import { NextRequest, NextResponse } from 'next/server';
import { logLogout } from '@/lib/audit-logger';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'

// Interfaces TypeScript
interface UserInfo {
  id: string;
  email: string;
  nome: string;
  bar_id: number;
}

export async function POST(request: NextRequest) {
  try {
    // Capturar informações do cliente para logging
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded
      ? forwarded.split(',')[0]
      : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const sessionId =
      request.headers.get('x-session-id') || `session_${Date.now()}`;

    // Tentar obter dados do usuário do cookie antes de limpar
    let userInfo: UserInfo | null = null;
    try {
      const userCookie = request.cookies.get('sgb_user');
      if (userCookie?.value) {
        userInfo = JSON.parse(userCookie.value) as UserInfo;
      }
    } catch {
      // Ignorar erro do cookie
    }

    // encerra a sessão de acesso (auditoria) — best-effort
    const sid = request.cookies.get('zk_sid')?.value;
    if (sid) {
      try {
        const supabase = await getAdminClient();
        await (supabase as any).schema('system').rpc('session_end', { p_sid: sid, p_reason: 'logout' });
      } catch { /* noop */ }
    }

    // Log de logout
    await logLogout({
      userId: userInfo?.id,
      userEmail: userInfo?.email,
      userName: userInfo?.nome,
      barId: userInfo?.bar_id,
      ipAddress: clientIp,
      userAgent,
      sessionId,
    });

    // Criar response
    const response = NextResponse.json(
      { success: true, message: 'Logout realizado com sucesso' },
      { status: 200 }
    );

    // Limpar TODOS os cookies de autenticação
    // TODO(rodrigo/2026-05): Após migração completa, manter apenas auth_token e refresh_token
    const cookiesToDelete = ['auth_token', 'refresh_token', 'sgb_user', 'sgb_bar_id', 'sgb_bar_nome', 'zk_sid'];
    for (const name of cookiesToDelete) {
      response.cookies.set(name, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        expires: new Date(0),
      });
    }

    return response;
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
