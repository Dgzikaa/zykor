/**
 * Auth Guard - Validação de autenticação para Edge Functions
 * 
 * Valida se a requisição é autenticada via:
 * 1. JWT válido (verify_jwt: true no deno.json)
 * 2. Cron secret válido (para chamadas internas do pg_cron)
 * 3. Webhook secret válido (para webhooks externos)
 */

/**
 * Valida se a requisição vem de um cron job interno
 * @param req Request object
 * @returns true se o cron secret é válido
 */
export function validateCronSecret(req: Request): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  const envSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || !envSecret) {
    return false;
  }
  
  return cronSecret === envSecret;
}

/**
 * Valida se a requisição vem de um webhook externo válido
 * @param req Request object
 * @param webhookType Tipo de webhook (inter, umbler, apify, etc)
 * @returns true se o webhook secret é válido
 */
export function validateWebhookSecret(req: Request, webhookType: string): boolean {
  const webhookSecret = req.headers.get('x-webhook-secret');
  const envSecretKey = `${webhookType.toUpperCase()}_WEBHOOK_SECRET`;
  const envSecret = Deno.env.get(envSecretKey);
  
  if (!webhookSecret || !envSecret) {
    return false;
  }
  
  return webhookSecret === envSecret;
}

/**
 * Valida se a requisição é autenticada (JWT ou Cron Secret)
 * 
 * Quando verify_jwt: true no deno.json, o Supabase já valida o JWT automaticamente.
 * Esta função adiciona validação alternativa para cron jobs internos.
 * 
 * @param req Request object
 * @returns true se autenticado (JWT válido OU cron secret válido)
 */
export function validateCronOrJWT(req: Request): boolean {
  // Se tem cron secret válido, autoriza
  if (validateCronSecret(req)) {
    console.log('✅ Autenticado via CRON_SECRET');
    return true;
  }
  
  // Se não tem cron secret, assume que o JWT já foi validado pelo Supabase
  // (verify_jwt: true no deno.json)
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('✅ Autenticado via JWT (validado pelo Supabase)');
    return true;
  }
  
  console.warn('❌ Requisição não autenticada (sem JWT e sem CRON_SECRET)');
  return false;
}

/**
 * Middleware de autenticação para Edge Functions
 * Retorna Response de erro se não autenticado
 * 
 * @param req Request object
 * @param requireCronSecret Se true, exige cron secret (não aceita JWT)
 * @returns Response de erro se não autenticado, null se autenticado
 */
export function requireAuth(req: Request, requireCronSecret = false): Response | null {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };
  
  if (requireCronSecret) {
    // Exige cron secret (chamadas internas apenas)
    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing CRON_SECRET' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } else {
    // Aceita JWT ou cron secret
    if (!validateCronOrJWT(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  }
  
  return null; // Autenticado
}

/**
 * Middleware de autenticação para webhooks externos
 * 
 * @param req Request object
 * @param webhookType Tipo de webhook (inter, umbler, apify, etc)
 * @returns Response de erro se não autenticado, null se autenticado
 */
export function requireWebhookAuth(req: Request, webhookType: string): Response | null {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  };
  
  if (!validateWebhookSecret(req, webhookType)) {
    return new Response(
      JSON.stringify({ 
        error: `Unauthorized: Invalid or missing ${webhookType.toUpperCase()}_WEBHOOK_SECRET` 
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  return null; // Autenticado
}
