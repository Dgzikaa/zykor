/**
 * Middleware HTTP: garante que a request esta autenticada e
 * passa o usuario para o handler.
 *
 * @example
 *   export const GET = withAuth(async ({ user, request }) => {
 *     const data = await meuService(user.bar_id);
 *     return success(data);
 *   });
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, type AuthenticatedUser } from '@/middleware/auth';
import { UnauthorizedError } from '@/lib/errors';
import { handleError } from './responses';

export type AuthenticatedContext = {
  user: AuthenticatedUser;
  request: NextRequest;
};

export type AuthenticatedHandler = (
  ctx: AuthenticatedContext,
  routeContext?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const user = await authenticateUser(request);
      if (!user) {
        throw new UnauthorizedError('Usuario nao autenticado');
      }
      return await handler({ user, request }, routeContext);
    } catch (error) {
      return handleError(error);
    }
  };
}
