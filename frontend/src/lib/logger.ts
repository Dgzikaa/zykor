const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isVerboseLogging = process.env.NEXT_PUBLIC_VERBOSE_LOGS === 'true';

// ========================================
// 🔇 ERROS ESPERADOS (IGNORAR NO CONSOLE)
// ========================================

// Lista de códigos/mensagens de erro que são esperados e não devem poluir o console
const IGNORED_ERROR_CODES = [
  'ECONNRESET',      // Conexão resetada (usuário navegou para outra página)
  'ECONNABORTED',    // Conexão abortada
  'ERR_CANCELED',    // Requisição cancelada
  'ABORT_ERR',       // AbortController
];

const IGNORED_ERROR_MESSAGES = [
  'aborted',
  'canceled',
  'cancelled',
  'The user aborted a request',
  'signal is aborted',
  'Request was cancelled',
  'network request was cancelled',
  'fetch failed',    // Pode ser conexão perdida
];

/**
 * Verifica se um erro é "esperado" e deve ser ignorado no console
 * Erros esperados: conexões canceladas, requisições abortadas, etc.
 */
export function isExpectedError(error: unknown): boolean {
  if (!error) return false;
  
  // Verifica se é um Error com código
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; message?: string; name?: string };
    
    // Verifica código do erro
    if (err.code && IGNORED_ERROR_CODES.includes(err.code)) {
      return true;
    }
    
    // Verifica mensagem do erro
    const message = (err.message || '').toLowerCase();
    if (IGNORED_ERROR_MESSAGES.some(ignored => message.includes(ignored.toLowerCase()))) {
      return true;
    }
    
    // Verifica nome do erro
    if (err.name === 'AbortError') {
      return true;
    }
  }
  
  // Verifica se é uma string
  if (typeof error === 'string') {
    const lowerError = error.toLowerCase();
    if (IGNORED_ERROR_MESSAGES.some(ignored => lowerError.includes(ignored.toLowerCase()))) {
      return true;
    }
  }
  
  return false;
}

// ✅ Sistema de logs profissional para produção
export const logger = {
  log: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[${new Date().toISOString()}] ${message}`, ...args);
    }
  },
  error: (message: string, error?: unknown, ...args: unknown[]) => {
    // 🔇 Ignora erros esperados (conexão cancelada, etc.)
    if (isExpectedError(error)) {
      return; // Silenciosamente ignora
    }
    // ✅ Erros reais sempre logados, mesmo em produção (para Sentry)
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(`[${new Date().toISOString()}] WARN: ${message}`, ...args);
    } else if (isProduction) {
      // ✅ Warnings críticos em produção (vão para o Sentry)
      console.warn(`[PROD-WARN] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    // ✅ Info apenas em desenvolvimento (não vai para Sentry em produção)
    if (isDevelopment) {
      console.info(`[${new Date().toISOString()}] INFO: ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: unknown[]) => {
    // ✅ Debug apenas em desenvolvimento (não vai para Sentry em produção)
    if (isDevelopment) {
      console.debug(`[${new Date().toISOString()}] DEBUG: ${message}`, ...args);
    }
  },
  performance: (label: string, startTime: number) => {
    const duration = Date.now() - startTime;
    if (isDevelopment || duration > 1000) { // Log performance issues em prod
      console.log(`[PERF] ${label}: ${duration}ms`);
    }
  }
};

// ✅ Substituições seguras para produção
export const devLog = (isDevelopment && isVerboseLogging) ? console.log : () => {};
export const devError = isDevelopment ? console.error : logger.error;
export const devWarn = (isDevelopment && isVerboseLogging) ? console.warn : () => {};
export const devInfo = (isDevelopment && isVerboseLogging) ? console.info : () => {};
export const devDebug = (isDevelopment && isVerboseLogging) ? console.debug : () => {};

// ✅ Logs silenciosos para desenvolvimento normal
export const silentDevLog = () => {};
export const quietLogger = {
  log: (message: string, ...args: unknown[]) => {
    // Apenas erros críticos em desenvolvimento normal
    if (isProduction) return;
    if (message.includes('ERROR') || message.includes('CRITICAL')) {
      console.log(`[${new Date().toISOString()}] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    // Apenas informações importantes
    if (isProduction) return;
    if (message.includes('✅') || message.includes('❌') || message.includes('⚠️')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }
};

// ✅ Logger para APIs (sempre ativo para auditoria)
export const apiLogger = {
  request: (method: string, url: string, data?: unknown) => {
    if (isDevelopment && isVerboseLogging) {
      console.log(`[API-REQ] ${method} ${url}`, data);
    }
  },
  response: (method: string, url: string, status: number, duration: number) => {
    const level = status >= 400 ? 'ERROR' : status >= 300 ? 'WARN' : 'INFO';
    if (isDevelopment || status >= 400) {
      console.log(`[API-RES] ${level} ${method} ${url} - ${status} (${duration}ms)`);
    }
  },
  error: (method: string, url: string, error: unknown) => {
    // 🔇 Ignora erros esperados
    if (isExpectedError(error)) {
      return;
    }
    console.error(`[API-ERR] ${method} ${url}`, error);
  }
};

// ========================================
// 🔇 SAFE ERROR HANDLER PARA APIs
// ========================================

/**
 * Handler seguro para erros em APIs
 * Ignora erros esperados e loga apenas erros reais
 * 
 * @example
 * try {
 *   // código
 * } catch (error) {
 *   safeErrorLog('Nome da API', error);
 *   // ... tratamento
 * }
 */
export function safeErrorLog(context: string, error: unknown): void {
  if (isExpectedError(error)) {
    // Silenciosamente ignora erros esperados (conexão cancelada, etc.)
    return;
  }
  console.error(`❌ Erro em ${context}:`, error);
}

/**
 * Handler que retorna se o erro foi logado ou não
 * Útil para decidir se deve retornar erro 500 ou apenas ignorar
 */
export function handleApiError(context: string, error: unknown): { logged: boolean; isExpected: boolean } {
  if (isExpectedError(error)) {
    return { logged: false, isExpected: true };
  }
  console.error(`❌ Erro em ${context}:`, error);
  return { logged: true, isExpected: false };
}
