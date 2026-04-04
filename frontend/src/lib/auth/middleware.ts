/**
 * Middleware helpers para autenticação em API routes
 * 
 * Wrappers de conveniência que usam getAuthenticatedUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasPermission, isAdmin, type AuthenticatedUser } from './get-user';

/**
 * Tipo para handlers autenticados
 */
type AuthenticatedHandler = (
  request: NextRequest,
  user: AuthenticatedUser,
  ...args: any[]
) => Promise<Response>;

/**
 * Require Authentication
 * Wrapper para APIs que precisam de autenticação
 * 
 * @example
 * export const GET = requireAuth(async (request, user) => {
 *   // user está autenticado
 *   return NextResponse.json({ data: ... });
 * });
 */
export function requireAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, ...args: any[]) => {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não autorizado',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    
    return handler(request, user, ...args);
  };
}

/**
 * Require Admin
 * Wrapper para APIs que só admin pode acessar
 * 
 * @example
 * export const POST = requireAdmin(async (request, user) => {
 *   // user é admin
 *   return NextResponse.json({ data: ... });
 * });
 */
export function requireAdmin(handler: AuthenticatedHandler) {
  return requireAuth(async (request, user, ...args) => {
    if (!isAdmin(user)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Acesso negado - apenas administradores',
          code: 'ADMIN_REQUIRED',
        },
        { status: 403 }
      );
    }
    
    return handler(request, user, ...args);
  });
}

/**
 * Require Permission
 * Wrapper para APIs que precisam de permissão específica
 * 
 * @example
 * export const GET = requirePermission('eventos')(async (request, user) => {
 *   // user tem permissão para módulo 'eventos'
 *   return NextResponse.json({ data: ... });
 * });
 */
export function requirePermission(module: string) {
  return function (handler: AuthenticatedHandler) {
    return requireAuth(async (request, user, ...args) => {
      // Admin tem todas as permissões
      if (isAdmin(user)) {
        return handler(request, user, ...args);
      }
      
      // Verificar se tem o módulo ou 'todos'
      if (!hasPermission(user, module)) {
        return NextResponse.json(
          {
            success: false,
            error: `Sem permissão para o módulo: ${module}`,
            code: 'PERMISSION_DENIED',
            required_module: module,
          },
          { status: 403 }
        );
      }
      
      return handler(request, user, ...args);
    });
  };
}

/**
 * Respostas de erro padronizadas
 */
export function authErrorResponse(
  message: string = 'Não autorizado',
  status: number = 401
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'AUTH_ERROR',
    },
    { status }
  );
}

export function permissionErrorResponse(
  message: string = 'Permissão negada',
  status: number = 403
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'PERMISSION_DENIED',
    },
    { status }
  );
}
