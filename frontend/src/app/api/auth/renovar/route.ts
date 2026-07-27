import { NextRequest, NextResponse } from 'next/server';
import { validateRefreshToken, generateToken } from '@/lib/auth/jwt';
import { getAdminClient } from '@/lib/supabase-admin';
import { resolveEffectiveModulos } from '@/lib/auth/effective-modulos';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/renovar?next=/rota/destino
 *
 * Renovação SILENCIOSA do auth_token, sem pedir senha.
 *
 * Toda mudança de permissão grava um corte em system.user_token_cutoff (trigger
 * fn_token_cutoff_on_perm_change). O middleware rejeita token com `iat < corte` — o que estava
 * certo do ponto de vista de segurança, mas na prática jogava a pessoa pro /login e obrigava a
 * digitar senha de novo só porque ganhou um módulo. Em bar, no meio do serviço, isso vira
 * "não consigo entrar" e alguém liga pro escritório.
 *
 * Aqui o middleware manda pra cá em vez do /login: se o refresh_token (30d) ainda vale, o
 * auth_token é reemitido com role e módulos FRESCOS do banco e a pessoa volta pro destino sem
 * perceber. Sem refresh válido, aí sim cai no login — o corte continua valendo.
 *
 * Segurança: NÃO afrouxa nada. O corte segue rejeitando o token velho; só trocamos "expulsa"
 * por "reemite com os dados de agora", que é justamente o que o corte quer garantir.
 */
export async function GET(request: NextRequest) {
  // `next` só pode ser caminho interno — senão vira open redirect (?next=https://site-falso).
  const bruto = request.nextUrl.searchParams.get('next') || '/home';
  const destino = bruto.startsWith('/') && !bruto.startsWith('//') ? bruto : '/home';
  const paraLogin = () => {
    const url = new URL('/login', request.url);
    url.searchParams.set('returnUrl', destino);
    return NextResponse.redirect(url);
  };

  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (!refreshToken) return paraLogin();

    const decoded = validateRefreshToken(refreshToken);
    if (!decoded) return paraLogin();

    const adminClient = await getAdminClient();
    const { data: usuario, error } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('id', decoded.user_id)
      .eq('ativo', true)
      .single();

    if (error || !usuario) return paraLogin();

    // Mesmo critério do login e do /api/auth/refresh: com perfil_id, quem manda é o PERFIL.
    const modulosPermitidos: string[] = await resolveEffectiveModulos({
      role: usuario.role,
      perfil_id: usuario.perfil_id,
      modulos_permitidos: usuario.modulos_permitidos,
    });

    const novoToken = generateToken({
      user_id: usuario.id,
      auth_id: usuario.auth_id,
      email: usuario.email,
      bar_id: decoded.bar_id,
      role: usuario.role,
      modulos_permitidos: modulosPermitidos,
    });

    const resposta = NextResponse.redirect(new URL(destino, request.url));
    resposta.cookies.set('auth_token', novoToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      httpOnly: true,
    });
    // no-store: sem isso o redirect pode ficar em cache e a renovação "gruda" numa resposta velha
    resposta.headers.set('Cache-Control', 'no-store');
    return resposta;
  } catch (e) {
    console.error('[auth/renovar] falhou, caindo pro login:', e);
    return paraLogin();
  }
}
