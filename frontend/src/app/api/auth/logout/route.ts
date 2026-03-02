/**
 * API de Logout
 * Remove cookies e invalida sessão
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export const POST = requireAuth(async (request, user) => {
  // Logar logout
  await logAuditEvent({
    user_id: user.id,
    action: 'LOGOUT',
    resource: 'auth',
    ip_address: request.headers.get('x-forwarded-for') || undefined,
    user_agent: request.headers.get('user-agent') || undefined,
  });

  console.log(`👋 Logout: ${user.nome} (${user.email})`);

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
