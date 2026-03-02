/**
 * Wrappers e helpers para facilitar migração de APIs
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthenticatedUser } from './types';
import { authenticateRequest, validateBarAccess } from './server';
import { logAuditEvent } from './audit';

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
    const user = await authenticateRequest(request);
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
    const hasAccess = await validateBarAccess(user, bar_id);
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
 * Wrapper para APIs que precisam de autenticação e logging automático
 */
export function withAuthAndLog(
  action: string,
  resource: string,
  handler: (
    request: NextRequest,
    user: AuthenticatedUser
  ) => Promise<Response>
) {
  return async (request: NextRequest, ...args: any[]) => {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Executar handler
    const response = await handler(request, user);

    // Logar se foi bem-sucedido (status 200-299)
    if (response.status >= 200 && response.status < 300) {
      await logAuditEvent({
        user_id: user.id,
        action,
        resource,
        ip_address: request.headers.get('x-forwarded-for') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
      });
    }

    return response;
  };
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
