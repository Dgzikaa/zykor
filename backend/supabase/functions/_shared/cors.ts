/**
 * 🌐 MÓDULO COMPARTILHADO - CORS HEADERS
 * 
 * Headers CORS padrão para todas as Edge Functions.
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Resposta padrão para OPTIONS (preflight CORS)
 */
export function handleCorsOptions(): Response {
  return new Response('ok', { headers: corsHeaders })
}

/**
 * Resposta de sucesso com JSON
 */
export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

/**
 * Resposta de erro com JSON
 */
export function errorResponse(message: string, details?: unknown, status: number = 500): Response {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      details: details?.toString() || undefined
    }),
    { 
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}
