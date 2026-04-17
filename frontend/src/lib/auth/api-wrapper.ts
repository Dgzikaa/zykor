/**
 * Wrappers e helpers para facilitar migração de APIs
 * 
 * @deprecated Use helpers from '@/lib/auth' instead
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedUser } from './types';
import { getAuthenticatedUser } from './get-user';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * Wrapper simplificado para APIs que precisam de autenticação e bar_id
 * Extrai bar_id automaticamente e valida acesso
 */
export function withAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    bar_id: number
  ) => Promise<Response>
) {
  return async (request: NextRequest, ...args: any[]) => {
    // Autenticar
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Extrair bar_id (query param, body, ou user.bar_id)
    let bar_id: number;
    
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    
    if (barIdParam) {
      bar_id = parseInt(barIdParam);
    } else {
      // Tentar do body (POST/PUT)
      try {
        const body = await request.clone().json();
        bar_id = body.bar_id ? parseInt(body.bar_id) : user.bar_id;
      } catch {
        bar_id = user.bar_id;
      }
    }

    // Validar acesso ao bar
    const hasAccess = await validateBarAccessHelper(user.auth_id, bar_id, user.role);
    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sem acesso a este estabelecimento',
          code: 'BAR_ACCESS_DENIED',
        },
        { status: 403 }
      );
    }

    return handler(request, user, bar_id);
  };
}

/**
 * Helper interno para validar acesso ao bar
 */
async function validateBarAccessHelper(
  auth_id: string,
  bar_id: number,
  role: string
): Promise<boolean> {
  // Admin tem acesso a todos os bares
  if (role === 'admin') {
    return true;
  }
  
  // Verificar acesso específico ao bar
  const supabase = await getAdminClient();
  const { data } = await supabase
    .schema('auth_custom')
    .from('usuarios_bares')
    .select('bar_id')
    .eq('usuario_id', auth_id)
    .eq('bar_id', bar_id)
    .single();
  
  return !!data;
}

/**
 * Helper para extrair bar_id de request
 */
export async function extractBarId(request: NextRequest, user: AuthenticatedUser): Promise<number> {
  // 1. Query param
  const { searchParams } = new URL(request.url);
  const barIdParam = searchParams.get('bar_id');
  if (barIdParam) {
    return parseInt(barIdParam);
  }

  // 2. Body (POST/PUT)
  try {
    const body = await request.clone().json();
    if (body.bar_id) {
      return parseInt(body.bar_id);
    }
  } catch {
    // Não é JSON ou não tem bar_id
  }

  // 3. User bar_id padrão
  return user.bar_id;
}

/**
 * Helper para normalizar modulos_permitidos como array
 */
export function normalizeModulos(modulos: string[] | Record<string, any> | null | undefined): string[] {
  if (!modulos) return [];
  
  if (Array.isArray(modulos)) {
    return modulos;
  }
  
  if (typeof modulos === 'object') {
    return Object.keys(modulos).filter(k => modulos[k]);
  }
  
  return [];
}

/**
 * Helper para validar se usuário pode modificar outro usuário
 */
export function canModifyUser(
  currentUser: AuthenticatedUser,
  targetUserId: number
): boolean {
  // Admin pode modificar qualquer usuário
  if (currentUser.role === 'admin') {
    return true;
  }
  
  // Usuário só pode modificar a si mesmo
  return currentUser.id === targetUserId;
}
