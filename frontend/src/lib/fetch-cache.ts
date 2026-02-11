/**
 * Cache em memória para requisições fetch - reduz chamadas duplicadas e melhora performance
 */

const cache = new Map<string, { data: unknown; expires: number }>();

const DEFAULT_TTL = 60 * 1000; // 1 minuto
const MAX_ENTRIES = 100;

function pruneCache() {
  if (cache.size > MAX_ENTRIES) {
    const entries = Array.from(cache.entries()).sort(
      (a, b) => a[1].expires - b[1].expires
    );
    const toDelete = entries.slice(0, Math.floor(MAX_ENTRIES * 0.2));
    toDelete.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Fetch com cache opcional - útil para dados que não mudam frequentemente
 */
export async function fetchCached(
  url: string,
  options?: RequestInit,
  ttlMs: number = DEFAULT_TTL
): Promise<Response> {
  const cacheKey = `GET:${url}`;
  if (options?.method && options.method !== 'GET') {
    return fetch(url, options);
  }

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(url, options);
  if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const data = await res.clone().json();
    cache.set(cacheKey, { data, expires: Date.now() + ttlMs });
    pruneCache();
  }
  return res;
}

/**
 * Invalida cache por prefixo de URL (útil após mutations)
 */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}
