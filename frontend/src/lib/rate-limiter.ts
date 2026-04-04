/**
 * Rate Limiter em Memória
 * 
 * NOTA: Funciona para instância única do Next.js.
 * Para múltiplas instâncias (produção escalada), usar Redis/Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

/**
 * Verifica se uma chave excedeu o rate limit
 * 
 * @param key - Identificador único (ex: IP, user_id, etc)
 * @param options - Configurações de limite
 * @returns Resultado indicando se a requisição pode prosseguir
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // Se não existe entrada ou expirou, criar nova
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { 
      success: true, 
      remaining: options.maxRequests - 1, 
      resetAt: now + options.windowMs 
    };
  }

  // Se excedeu o limite
  if (entry.count >= options.maxRequests) {
    return { 
      success: false, 
      remaining: 0, 
      resetAt: entry.resetAt 
    };
  }

  // Incrementar contador
  entry.count++;
  return { 
    success: true, 
    remaining: options.maxRequests - entry.count, 
    resetAt: entry.resetAt 
  };
}

/**
 * Limpar entradas expiradas a cada 5 minutos
 * Previne crescimento infinito do Map
 */
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  store.forEach((entry, key) => {
    if (now > entry.resetAt) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => store.delete(key));
}, 5 * 60 * 1000);

/**
 * Obter identificador único da requisição
 * Prioriza: x-forwarded-for > x-real-ip > fallback
 */
export function getRequestIdentifier(request: Request): string {
  const headers = request.headers;
  
  // Tentar pegar IP real do cliente
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback para user-agent + timestamp (menos confiável)
  const userAgent = headers.get('user-agent') || 'unknown';
  return `fallback-${userAgent}`;
}

/**
 * Limpar todo o store (útil para testes)
 */
export function clearRateLimitStore(): void {
  store.clear();
}
