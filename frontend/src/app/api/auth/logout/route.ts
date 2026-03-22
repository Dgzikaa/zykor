/**
 * API de Logout
 * Remove cookies e invalida sessão
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export const POST = requireAuth(async (request, user) => {
  // Criar resposta
  const response = NextResponse.json({
    success: true,
    message: 'Logout realizado com sucesso',
  });

  // Remover cookies
  response.cookies.delete('auth_token');
  response.cookies.delete('sgb_user');
  response.cookies.delete('sgb_bar_id');
  response.cookies.delete('sgb_bar_nome');

  return response;
});
