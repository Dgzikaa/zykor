/**
 * Módulo de retry com exponential backoff para integrações externas
 * 
 * Implementa retry automático com backoff exponencial e jitter para
 * lidar com falhas transientes (timeouts, rate limits, erros 5xx).
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: any) => boolean;
}

/**
 * Executa uma função com retry automático e exponential backoff
 * 
 * @param fn - Função assíncrona a ser executada
 * @param options - Opções de configuração do retry
 * @returns Promise com o resultado da função
 * 
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxRetries: 3,
 *     retryOn: (error) => error.status === 429 || error.status >= 500
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    baseDelayMs = 1000, 
    maxDelayMs = 30000, 
    retryOn 
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Se é a última tentativa, lançar o erro
      if (attempt === maxRetries) {
        console.error(`❌ Falha após ${maxRetries} tentativas:`, error);
        throw error;
      }

      // Se tem filtro de retry e o erro não é retriável, lançar imediatamente
      if (retryOn && !retryOn(error)) {
        console.error(`❌ Erro não retriável:`, error);
        throw error;
      }

      // Calcular delay com exponential backoff
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      
      // Adicionar jitter (10% de variação aleatória) para evitar thundering herd
      const jitter = cappedDelay * 0.1 * Math.random();
      const finalDelay = cappedDelay + jitter;

      console.warn(
        `⚠️ Tentativa ${attempt + 1}/${maxRetries + 1} falhou. ` +
        `Aguardando ${Math.round(finalDelay)}ms antes de tentar novamente...`
      );

      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  // Nunca deve chegar aqui, mas TypeScript precisa de um return
  throw new Error('Unreachable');
}

/**
 * Verifica se um erro é retriável (transiente)
 * 
 * Erros retriáveis incluem:
 * - Status 429 (Rate Limit)
 * - Status 502, 503, 504 (Bad Gateway, Service Unavailable, Gateway Timeout)
 * - Erros de timeout
 * - Erros de conexão (ECONNRESET, ETIMEDOUT, etc)
 * 
 * Erros NÃO retriáveis:
 * - Status 400 (Bad Request - erro de lógica)
 * - Status 401 (Unauthorized - credenciais inválidas)
 * - Status 403 (Forbidden - sem permissão)
 * - Status 404 (Not Found - recurso não existe)
 * 
 * @param error - Erro a ser verificado
 * @returns true se o erro é retriável, false caso contrário
 */
export function isRetriableError(error: any): boolean {
  // Extrair status code de diferentes formatos de erro
  const status = error?.status || error?.statusCode || error?.response?.status;
  
  // Erros HTTP retriáveis
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  // Erros de timeout/conexão (verificar mensagem)
  const message = error?.message?.toLowerCase() || '';
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('network')
  ) {
    return true;
  }

  // Erros explicitamente NÃO retriáveis (erros de lógica/autenticação)
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }

  // Por padrão, considerar outros erros 5xx como retriáveis
  if (status && status >= 500 && status < 600) {
    return true;
  }

  // Se não conseguiu identificar, não fazer retry (conservador)
  return false;
}
