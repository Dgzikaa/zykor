/**
 * 🌐 MÓDULO COMPARTILHADO - CORS HEADERS
 * 
 * Headers CORS com validação de origens permitidas.
 * 
 * SEGURANÇA:
 * - Lista de origens permitidas (whitelist)
 * - Validação de origin no request
 * - Fallback para primeira origem permitida
 * - Suporte a cron jobs (origin vazio com x-cron-secret)
 * - Suporte a webhooks externos (validação via secret próprio)
 * 
 * @version 3.0.0
 * @date 2026-04-04
 */

const ALLOWED_ORIGINS = [
  Deno.env.get('FRONTEND_URL') || 'https://zykor.vercel.app',
  'https://zykor.com.br',
  'http://localhost:3001',
  'http://localhost:3000',
];

/**
 * Gera headers CORS validando a origem do request
 * 
 * @param req - Request object
 * @returns Headers CORS com origin validado
 */
export function getCorsHeaders(req?: Request | null): Record<string, string> {
  // Defensivo: req pode ser undefined em chamadas mal-tipadas
  const origin = req?.headers?.get?.('Origin') || '';
  const cronSecret = req?.headers?.get?.('x-cron-secret');
  
  // Se é um cron job (sem origin mas com secret), permitir
  if (!origin && cronSecret) {
    return {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id, x-webhook-secret, x-inter-webhook-secret, x-api-key',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
      'Access-Control-Max-Age': '86400',
    };
  }
  
  // Verificar se origin está na lista de permitidos
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id, x-webhook-secret, x-inter-webhook-secret, x-api-key',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Headers CORS legados (DEPRECATED - use getCorsHeaders)
 * Mantido para compatibilidade temporária
 * 
 * @deprecated Use getCorsHeaders(req) para segurança adequada
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id',
};

/**
 * Resposta padrão para OPTIONS (preflight CORS)
 */
export function handleCorsOptions(req: Request): Response {
  return new Response('ok', { headers: getCorsHeaders(req) })
}

/**
 * Resposta de sucesso com JSON
 */
export function jsonResponse(data: unknown, req?: Request | null, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
    }
  )
}

/**
 * Resposta de erro com JSON
 */
export function errorResponse(message: string, req?: Request | null, details?: unknown, status: number = 500): Response {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      details: details?.toString() || undefined
    }),
    { 
      status,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
    }
  )
}
