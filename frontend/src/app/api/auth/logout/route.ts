/**
 * API de Logout
 * Remove cookies e invalida sessão
 * Não requer auth pois deve funcionar mesmo com token expirado
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logout realizado com sucesso',
  });

  // Remover todos os cookies de sessão
  const cookiesToDelete = ['auth_token', 'refresh_token', 'sgb_user', 'sgb_bar_id', 'sgb_bar_nome'];
  for (const name of cookiesToDelete) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' });
  }

  return response;
}
