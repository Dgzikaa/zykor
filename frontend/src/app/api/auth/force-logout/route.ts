/**
 * API de Logout Forçado
 * Remove cookies sem precisar de autenticação
 * Útil para resolver problemas de sessão corrompida
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));

  // Remover todos os cookies de autenticação
  response.cookies.delete('auth_token');
  response.cookies.delete('sgb_user');
  response.cookies.delete('sgb_bar_id');
  response.cookies.delete('sgb_bar_nome');
  response.cookies.delete('sgb_session');

  console.log('🔄 Force logout executado');

  return response;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logout forçado realizado com sucesso. Faça login novamente.',
  });

  // Remover todos os cookies de autenticação
  response.cookies.delete('auth_token');
  response.cookies.delete('sgb_user');
  response.cookies.delete('sgb_bar_id');
  response.cookies.delete('sgb_bar_nome');
  response.cookies.delete('sgb_session');

  return response;
}
