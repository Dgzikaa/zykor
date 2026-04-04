/**
 * Autenticação server-side
 * Usar em TODAS as APIs que precisam de autenticação
 * 
 * @deprecated Use getAuthenticatedUser from '@/lib/auth/get-user' instead
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from './get-user';
import type { AuthenticatedUser } from './types';

/**
 * FUNÇÃO PRINCIPAL: Autenticar request
 * 
 * @deprecated Use getAuthenticatedUser from '@/lib/auth/get-user' instead
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  // Redirecionar para o novo helper unificado
  return getAuthenticatedUser(request);
}

// Re-exportar helpers do novo sistema unificado
export {
  requireAuth,
  requireAdmin,
  requirePermission,
  authErrorResponse,
  permissionErrorResponse,
} from './middleware';

export {
  getBarIdFromRequest,
  hasPermission,
  isAdmin,
} from './get-user';

// Re-exportar tipo
export type { AuthenticatedUser } from './types';
