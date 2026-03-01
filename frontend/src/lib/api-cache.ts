/**
 * Configurações de Cache para APIs
 * 
 * Use estas constantes para configurar revalidation/cache nas APIs
 * 
 * @example
 * // Em route.ts:
 * import { CACHE_TIMES, createCacheHeaders } from '@/lib/api-cache';
 * 
 * export const revalidate = CACHE_TIMES.SHORT;
 * 
 * export async function GET() {
 *   // ... sua lógica
 *   return Response.json(data, {
 *     headers: createCacheHeaders('short')
 *   });
 * }
 */

// Tempos de cache em segundos
export const CACHE_TIMES = {
  /** Sem cache - dados em tempo real */
  NONE: 0,
  
  /** Cache muito curto (30 segundos) - dados que mudam frequentemente */
  VERY_SHORT: 30,
  
  /** Cache curto (2 minutos) - dashboards, métricas */
  SHORT: 120,
  
  /** Cache médio (5 minutos) - listas, relatórios */
  MEDIUM: 300,
  
  /** Cache longo (15 minutos) - configurações, dados estáticos */
  LONG: 900,
  
  /** Cache muito longo (1 hora) - dados raramente alterados */
  VERY_LONG: 3600,
  
  /** Cache de 1 dia - dados estáticos */
  DAY: 86400,
} as const;

// Headers de cache
export function createCacheHeaders(
  duration: keyof typeof CACHE_TIMES | number,
  options?: {
    /** Se deve revalidar em background */
    staleWhileRevalidate?: number;
    /** Se é privado (não pode ser cacheado por CDN) */
    private?: boolean;
  }
): Record<string, string> {
  const seconds = typeof duration === 'number' ? duration : CACHE_TIMES[duration];
  const swr = options?.staleWhileRevalidate ?? Math.floor(seconds * 0.5);
  const visibility = options?.private ? 'private' : 'public';
  
  if (seconds === 0) {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
  }
  
  return {
    'Cache-Control': `${visibility}, s-maxage=${seconds}, stale-while-revalidate=${swr}`,
    'CDN-Cache-Control': `max-age=${seconds}`,
    'Vercel-CDN-Cache-Control': `max-age=${seconds}`,
  };
}

// Configuração padrão para diferentes tipos de API
export const API_CACHE_CONFIG = {
  /** Configurações, credenciais - cache longo com revalidação */
  config: {
    revalidate: CACHE_TIMES.LONG,
    headers: () => createCacheHeaders('LONG', { private: true }),
  },
  
  /** Dashboards, métricas - cache curto */
  dashboard: {
    revalidate: CACHE_TIMES.SHORT,
    headers: () => createCacheHeaders('SHORT'),
  },
  
  /** Listas, tabelas - cache médio */
  list: {
    revalidate: CACHE_TIMES.MEDIUM,
    headers: () => createCacheHeaders('MEDIUM'),
  },
  
  /** Dados em tempo real - sem cache */
  realtime: {
    revalidate: CACHE_TIMES.NONE,
    headers: () => createCacheHeaders('NONE'),
  },
  
  /** Relatórios - cache médio/longo */
  report: {
    revalidate: CACHE_TIMES.MEDIUM,
    headers: () => createCacheHeaders('MEDIUM'),
  },
} as const;

/**
 * Helper para criar response com cache
 */
export function jsonWithCache<T>(
  data: T,
  cacheType: keyof typeof API_CACHE_CONFIG,
  status = 200
): Response {
  const config = API_CACHE_CONFIG[cacheType];
  return Response.json(data, {
    status,
    headers: config.headers(),
  });
}

/**
 * Helper para detectar se request deve usar cache
 * Retorna false se tem header de no-cache ou é POST/PUT/DELETE
 */
export function shouldUseCache(request: Request): boolean {
  // Métodos que modificam dados não devem usar cache
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return false;
  }
  
  // Verifica headers de no-cache
  const cacheControl = request.headers.get('Cache-Control');
  if (cacheControl?.includes('no-cache') || cacheControl?.includes('no-store')) {
    return false;
  }
  
  return true;
}

export default {
  CACHE_TIMES,
  API_CACHE_CONFIG,
  createCacheHeaders,
  jsonWithCache,
  shouldUseCache,
};

