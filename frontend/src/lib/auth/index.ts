/**
 * Sistema de Autenticação Unificado
 * 
 * HIERARQUIA DE AUTENTICAÇÃO:
 * 1. JWT via cookie httpOnly `auth_token` (PRIMÁRIO)
 * 2. Header `x-selected-bar-id` para multi-tenancy
 * 3. Fallback: cookie legado `sgb_user` (DEPRECADO - será removido)
 * 
 * COMO USAR:
 * 
 * 1. Em API routes que precisam de autenticação:
 * ```typescript
 * import { requireAuth } from '@/lib/auth';
 * 
 * export const GET = requireAuth(async (request, user) => {
 *   // user está autenticado
 *   const barId = getBarIdFromRequest(request, user);
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 * 
 * 2. Em API routes que precisam de permissão admin:
 * ```typescript
 * import { requireAdmin } from '@/lib/auth';
 * 
 * export const POST = requireAdmin(async (request, user) => {
 *   // user é admin
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 * 
 * 3. Em API routes que precisam de permissão específica:
 * ```typescript
 * import { requirePermission } from '@/lib/auth';
 * 
 * export const GET = requirePermission('eventos')(async (request, user) => {
 *   // user tem permissão para módulo 'eventos'
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 * 
 * 4. Para autenticação manual (casos especiais):
 * ```typescript
 * import { getAuthenticatedUser, getBarIdFromRequest } from '@/lib/auth';
 * 
 * export async function GET(request: NextRequest) {
 *   const user = await getAuthenticatedUser(request);
 *   if (!user) {
 *     return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
 *   }
 *   
 *   const barId = getBarIdFromRequest(request, user);
 *   // ...
 * }
 * ```
 */

// Core authentication
export {
  getAuthenticatedUser,
  getBarIdFromRequest,
  hasPermission,
  isAdmin,
  type AuthenticatedUser,
} from './get-user';

// Middleware helpers
export {
  requireAuth,
  requireAdmin,
  requirePermission,
  authErrorResponse,
  permissionErrorResponse,
} from './middleware';

// JWT utilities
export {
  generateToken,
  validateToken,
  decodeToken,
  isTokenExpired,
  generateRefreshToken,
  validateRefreshToken,
  getTokenTimeRemaining,
} from './jwt';

// Utility functions
export {
  extractBarIdFromRequest,
  extractUserIdFromRequest,
  getUserAndBarId,
} from './utils';

// Types
export type { AuthToken } from './types';

// Legacy exports (DEPRECADO - usar exports acima)
export {
  authenticateRequest,
} from './server';
