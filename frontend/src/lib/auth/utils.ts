/**
 * Utilitários para autenticação em API routes
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, getBarIdFromRequest, type AuthenticatedUser } from './get-user';

/**
 * Extrai bar_id do request (header x-selected-bar-id)
 * 
 * @deprecated Use getAuthenticatedUser() e getBarIdFromRequest() instead
 */
export function extractBarIdFromRequest(request: NextRequest): number | null {
  const barIdHeader = request.headers.get('x-selected-bar-id');
  if (!barIdHeader) return null;
  
  const barId = parseInt(barIdHeader, 10);
  return isNaN(barId) ? null : barId;
}

/**
 * Extrai user_id do request (DEPRECADO - usar getAuthenticatedUser)
 * 
 * @deprecated Use getAuthenticatedUser() instead
 */
export function extractUserIdFromRequest(request: NextRequest): number | null {
  console.warn('⚠️ extractUserIdFromRequest está deprecado - use getAuthenticatedUser()');
  const userIdHeader = request.headers.get('x-user-id');
  if (!userIdHeader) return null;
  
  const userId = parseInt(userIdHeader, 10);
  return isNaN(userId) ? null : userId;
}

/**
 * Helper para obter user e bar_id de uma vez
 * 
 * @example
 * const { user, barId } = await getUserAndBarId(request);
 * if (!user) return authErrorResponse();
 */
export async function getUserAndBarId(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  barId: number | null;
}> {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    return { user: null, barId: null };
  }
  
  const barId = getBarIdFromRequest(request, user);
  
  return { user, barId };
}
