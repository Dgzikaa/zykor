// ===== SISTEMA DE CACHE PARA QUERIES FREQUENTES =====

export interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const queryCache = new Map<string, CacheEntry>();

export const CACHE_TTLS: Record<string, number> = {
  faturamento_ontem: 60,
  faturamento_semana: 30,
  faturamento_mes: 15,
  produtos_top: 60,
  clientes: 30,
  cmv: 60,
  meta: 60,
  default: 15
};

export function getCacheKey(intent: string, entities: Record<string, string>, barId: number): string {
  return `${intent}:${barId}:${JSON.stringify(entities)}`;
}

export function getFromCache(key: string): unknown | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    queryCache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCache(key: string, data: unknown, ttlKey: string): void {
  const ttl = (CACHE_TTLS[ttlKey] || CACHE_TTLS.default) * 60 * 1000;
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

export function cleanupCache(): void {
  if (queryCache.size > 100) {
    const entries = Array.from(queryCache.entries());
    const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = sorted.slice(0, 50);
    toDelete.forEach(([key]) => queryCache.delete(key));
  }
}
