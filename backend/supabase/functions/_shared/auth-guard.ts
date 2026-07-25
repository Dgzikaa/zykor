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
  // Import getCorsHeaders locally to avoid circular dependency
  const getCorsHeadersLocal = (r: Request): Record<string, string> => {
    const origin = r.headers.get('Origin') || '';
    const cronSecret = r.headers.get('x-cron-secret');
    const ALLOWED_ORIGINS = [
      Deno.env.get('FRONTEND_URL') || 'https://zykor.vercel.app',
      'https://zykor.com.br',
      'http://localhost:3001',
      'http://localhost:3000',
    ];
    
    if (!origin && cronSecret) {
      return {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id, x-webhook-secret, x-inter-webhook-secret, x-api-key',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
        'Access-Control-Max-Age': '86400',
      };
    }
    
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed);
    
    return {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id, x-webhook-secret, x-inter-webhook-secret, x-api-key',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
      'Access-Control-Max-Age': '86400',
    };
  };
  
  if (requireCronSecret) {
    // Exige cron secret (chamadas internas apenas)
    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing CRON_SECRET' }),
        { 
          status: 401, 
          headers: { ...getCorsHeadersLocal(req), 'Content-Type': 'application/json' } 
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
          headers: { ...getCorsHeadersLocal(req), 'Content-Type': 'application/json' } 
        }
      );
    }
  }
  
  return null; // Autenticado
}

/**
 * Guard ESTRITO para funcoes publicadas com `--no-verify-jwt`.
 *
 * Por que existe: quando verify_jwt=false, a plataforma NAO valida nada, e o `requireAuth`
 * padrao cai no `validateCronOrJWT`, que aceita QUALQUER header `Authorization: Bearer ...`
 * sem conferir o token. Na pratica isso deixava a funcao aberta pra internet inteira —
 * bastava mandar `Bearer qualquercoisa`.
 *
 * Aqui so passa quem prova ser interno:
 *   - x-cron-secret == CRON_SECRET            (pg_cron)
 *   - Authorization: Bearer <SERVICE_ROLE_KEY> (crons via net.http_post e as API routes do Next)
 *
 * Nao use isto em funcao chamada do NAVEGADOR (ex.: cmv-semanal-auto, recalcular-desempenho-v2,
 * que recebem a anon key do browser e tem verify_jwt=true) — essas continuam no requireAuth.
 *
 * @returns Response 401 se nao autenticado, null se ok
 */
export async function requireInternalAuth(req: Request): Promise<Response | null> {
  if (validateCronSecret(req)) return null;

  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');

  if (token && srk) {
    // caminho rapido: as API routes do Next mandam a mesma chave que existe aqui na env
    if (token === srk) return null;

    // Os crons mandam public.get_service_role_key() (Vault), que hoje esta no formato NOVO
    // (sb_secret_...), enquanto a env da function e' a JWT legada — sao strings diferentes e
    // ambas validas. Por isso a conferencia final e' no banco: segue a rotacao sem copia local.
    try {
      const r = await fetch(url + '/rest/v1/rpc/validar_chave_interna', {
        method: 'POST',
        headers: { apikey: srk, Authorization: 'Bearer ' + srk, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token }),
      });
      if (r.ok && (await r.json()) === true) return null;
    } catch (e) {
      console.error('[auth] falha ao validar chave no banco', e);
    }
  }

  console.warn('[auth] chamada interna rejeitada: sem CRON_SECRET e sem chave de servico valida');
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Middleware de autenticação para webhooks externos
 * 
 * @param req Request object
 * @param webhookType Tipo de webhook (inter, umbler, apify, etc)
 * @returns Response de erro se não autenticado, null se autenticado
 */
export function requireWebhookAuth(req: Request, webhookType: string): Response | null {
  // Import getCorsHeaders locally to avoid circular dependency
  const getCorsHeadersLocal = (r: Request): Record<string, string> => {
    const origin = r.headers.get('Origin') || '';
    const webhookSecret = r.headers.get('x-webhook-secret');
    const ALLOWED_ORIGINS = [
      Deno.env.get('FRONTEND_URL') || 'https://zykor.vercel.app',
      'https://zykor.com.br',
      'http://localhost:3001',
      'http://localhost:3000',
    ];
    
    if (!origin && webhookSecret) {
      return {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id, x-webhook-secret, x-inter-webhook-secret, x-api-key',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
        'Access-Control-Max-Age': '86400',
      };
    }
    
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed);
    
    return {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id, x-webhook-secret, x-inter-webhook-secret, x-api-key',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
      'Access-Control-Max-Age': '86400',
    };
  };
  
  if (!validateWebhookSecret(req, webhookType)) {
    return new Response(
      JSON.stringify({ 
        error: `Unauthorized: Invalid or missing ${webhookType.toUpperCase()}_WEBHOOK_SECRET` 
      }),
      { 
        status: 401, 
        headers: { ...getCorsHeadersLocal(req), 'Content-Type': 'application/json' } 
      }
    );
  }
  
  return null; // Autenticado
}
