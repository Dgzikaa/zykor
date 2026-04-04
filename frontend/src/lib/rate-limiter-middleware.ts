/**
 * Middleware/Helper para aplicar Rate Limiting em API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRequestIdentifier, RateLimitOptions } from './rate-limiter';

export type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Wrapper para aplicar rate limiting em uma route handler
 * 
 * @example
 * ```typescript
 * export const POST = withRateLimit(
 *   async (req) => {
 *     // sua lógica aqui
 *   },
 *   { maxRequests: 10, windowMs: 60000 }
 * );
 * ```
 */
export function withRateLimit(
  handler: RouteHandler,
  options: RateLimitOptions
): RouteHandler {
  return async (req: NextRequest) => {
    const identifier = getRequestIdentifier(req);
    const result = rateLimit(identifier, options);

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Muitas requisições. Tente novamente em alguns instantes.',
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(options.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000))
          }
        }
      );
    }

    // Adicionar headers de rate limit na resposta
    const response = await handler(req);
    
    response.headers.set('X-RateLimit-Limit', String(options.maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));

    return response;
  };
}

/**
 * Presets de rate limiting para diferentes tipos de rotas
 */
export const RATE_LIMIT_PRESETS = {
  /** Rotas de autenticação - 10 req/min (previne brute force) */
  AUTH: { maxRequests: 10, windowMs: 60 * 1000 },
  
  /** Rotas de IA/Agente - 20 req/min (previne abuso de IA) */
  AI: { maxRequests: 20, windowMs: 60 * 1000 },
  
  /** Rotas de integração - 30 req/min */
  INTEGRATION: { maxRequests: 30, windowMs: 60 * 1000 },
  
  /** Rotas públicas - 60 req/min */
  PUBLIC: { maxRequests: 60, windowMs: 60 * 1000 },
  
  /** Rotas administrativas - 100 req/min */
  ADMIN: { maxRequests: 100, windowMs: 60 * 1000 },
} as const;
