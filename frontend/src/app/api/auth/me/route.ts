/**
 * API para buscar dados do usuário autenticado
 * Fonte de verdade para dados do usuário no frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export const GET = requireAuth(async (request, user) => {
  // Verificar se há um bar selecionado no cookie
  const selectedBarCookie = request.cookies.get('sgb_bar_id')?.value;
  const selectedBarId = selectedBarCookie ? parseInt(selectedBarCookie) : user.bar_id;
  
  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      auth_id: user.auth_id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      bar_id: selectedBarId,
      modulos_permitidos: user.modulos_permitidos,
      ativo: user.ativo,
      senha_redefinida: user.senha_redefinida,
      setor: user.setor,
      telefone: user.telefone,
    },
  });
});
