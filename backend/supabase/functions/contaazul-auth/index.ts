/**
 * Edge Function: contaazul-auth
 * 
 * Gerencia o fluxo OAuth 2.0 do Conta Azul.
 * 
 * Actions:
 * - get_auth_url: Gera URL de autorizacao OAuth
 * - exchange_code: Troca code por tokens
 * - refresh_token: Renova access_token usando refresh_token
 * - status: Verifica status da conexao
 * - save_credentials: Salva client_id e client_secret
 * 
 * @version 1.0.0
 * @date 2026-03-24
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsOptions, jsonResponse, errorResponse } from '../_shared/cors.ts'

const CONTA_AZUL_AUTH_URL = 'https://auth.contaazul.com'
const REDIRECT_URI = 'https://zykor.com.br/api/financeiro/contaazul/oauth/callback'
const OAUTH_SCOPE = 'openid profile aws.cognito.signin.user.admin'

interface AuthRequest {
  action: 'get_auth_url' | 'exchange_code' | 'refresh_token' | 'status' | 'save_credentials'
  bar_id: number
  code?: string
  state?: string
  client_id?: string
  client_secret?: string
}

interface ApiCredentials {
  id?: number
  bar_id: number
  sistema: string
  provider: string
  client_id: string | null
  client_secret: string | null
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  scopes: string | null
  ativo: boolean
  created_at?: string
  updated_at?: string
}

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configuradas')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

async function getCredentials(supabase: SupabaseClient, barId: number): Promise<ApiCredentials | null> {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('*')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', barId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar credentials:', error)
    throw error
  }
  
  return data
}

async function upsertCredentials(
  supabase: SupabaseClient, 
  barId: number, 
  updates: Partial<ApiCredentials>
): Promise<void> {
  const existing = await getCredentials(supabase, barId)
  
  if (existing) {
    const { error } = await supabase
      .from('api_credentials')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    
    if (error) {
      console.error('Erro ao atualizar credentials:', error)
      throw error
    }
  } else {
    const { error } = await supabase
      .from('api_credentials')
      .insert({
        bar_id: barId,
        sistema: 'conta_azul',
        ativo: true,
        ...updates
      })
    
    if (error) {
      console.error('Erro ao inserir credentials:', error)
      throw error
    }
  }
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  const credentials = clientId + ':' + clientSecret
  return btoa(credentials)
}

async function handleGetAuthUrl(supabase: SupabaseClient, barId: number): Promise<Response> {
  let credentials = await getCredentials(supabase, barId)
  
  if (!credentials) {
    await upsertCredentials(supabase, barId, {
      client_id: null,
      client_secret: null,
      access_token: null,
      refresh_token: null
    })
    return errorResponse('Credenciais nao configuradas. Configure client_id e client_secret primeiro.', null, 400)
  }
  
  if (!credentials.client_id) {
    return errorResponse('client_id nao configurado. Use action=save_credentials primeiro.', null, 400)
  }
  
  const state = crypto.randomUUID()
  
  await upsertCredentials(supabase, barId, { scopes: state })
  
  const authUrl = new URL(CONTA_AZUL_AUTH_URL + '/login')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', credentials.client_id)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', OAUTH_SCOPE)
  
  console.log('[contaazul-auth] Auth URL gerada para bar_id=' + barId)
  
  return jsonResponse({
    success: true,
    auth_url: authUrl.toString(),
    state
  })
}

async function handleExchangeCode(
  supabase: SupabaseClient, 
  barId: number, 
  code: string, 
  state: string
): Promise<Response> {
  const credentials = await getCredentials(supabase, barId)
  
  if (!credentials) {
    return errorResponse('Credenciais nao encontradas', null, 404)
  }
  
  if (credentials.scopes !== state) {
    console.error('[contaazul-auth] State invalido. Esperado: ' + credentials.scopes + ', Recebido: ' + state)
    return errorResponse('State invalido. Possivel ataque CSRF.', null, 400)
  }
  
  if (!credentials.client_id || !credentials.client_secret) {
    return errorResponse('client_id ou client_secret nao configurados', null, 400)
  }
  
  const tokenUrl = CONTA_AZUL_AUTH_URL + '/oauth2/token'
  const basicAuth = encodeBasicAuth(credentials.client_id, credentials.client_secret)
  
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI
  })
  
  console.log('[contaazul-auth] Trocando code por tokens para bar_id=' + barId)
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    
    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('[contaazul-auth] Erro OAuth ' + response.status + ':', responseText)
      return errorResponse(
        'Erro ao trocar code: ' + response.status, 
        responseText, 
        response.status
      )
    }
    
    const tokenData = JSON.parse(responseText)
    
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600))
    
    await upsertCredentials(supabase, barId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      scopes: null
    })
    
    console.log('[contaazul-auth] Tokens salvos com sucesso para bar_id=' + barId)
    
    return jsonResponse({
      success: true,
      expires_in: tokenData.expires_in || 3600
    })
  } catch (err) {
    console.error('[contaazul-auth] Erro ao trocar code:', err)
    return errorResponse('Erro ao processar resposta OAuth', err, 500)
  }
}

async function handleRefreshToken(supabase: SupabaseClient, barId: number): Promise<Response> {
  const credentials = await getCredentials(supabase, barId)
  
  if (!credentials) {
    return errorResponse('Credenciais nao encontradas', null, 404)
  }
  
  if (!credentials.refresh_token) {
    return errorResponse('refresh_token nao disponivel. Reconecte via OAuth.', null, 400)
  }
  
  if (!credentials.client_id || !credentials.client_secret) {
    return errorResponse('client_id ou client_secret nao configurados', null, 400)
  }
  
  const tokenUrl = CONTA_AZUL_AUTH_URL + '/oauth2/token'
  const basicAuth = encodeBasicAuth(credentials.client_id, credentials.client_secret)
  
  const body = new URLSearchParams({
    refresh_token: credentials.refresh_token,
    grant_type: 'refresh_token'
  })
  
  console.log('[contaazul-auth] Renovando token para bar_id=' + barId)
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    
    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('[contaazul-auth] Erro refresh ' + response.status + ':', responseText)
      
      if (response.status === 400 || response.status === 401) {
        await upsertCredentials(supabase, barId, {
          access_token: null,
          refresh_token: null,
          expires_at: null
        })
        return errorResponse(
          'Refresh token invalido ou expirado. Reconecte via OAuth.', 
          responseText, 
          401
        )
      }
      
      return errorResponse(
        'Erro ao renovar token: ' + response.status, 
        responseText, 
        response.status
      )
    }
    
    const tokenData = JSON.parse(responseText)
    
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600))
    
    await upsertCredentials(supabase, barId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString()
    })
    
    console.log('[contaazul-auth] Token renovado com sucesso para bar_id=' + barId)
    
    return jsonResponse({
      success: true,
      expires_in: tokenData.expires_in || 3600
    })
  } catch (err) {
    console.error('[contaazul-auth] Erro ao renovar token:', err)
    return errorResponse('Erro ao processar renovacao de token', err, 500)
  }
}

async function handleStatus(supabase: SupabaseClient, barId: number): Promise<Response> {
  const credentials = await getCredentials(supabase, barId)
  
  if (!credentials) {
    return jsonResponse({
      connected: false,
      has_credentials: false,
      needs_refresh: false,
      expires_at: null
    })
  }
  
  const hasCredentials = !!(credentials.client_id && credentials.client_secret)
  const hasAccessToken = !!credentials.access_token
  const hasRefreshToken = !!credentials.refresh_token
  
  let isExpired = false
  let needsRefresh = false
  
  if (credentials.expires_at) {
    const expiresAt = new Date(credentials.expires_at)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
    
    isExpired = expiresAt <= now
    needsRefresh = expiresAt <= fiveMinutesFromNow
  }
  
  if (isExpired && hasRefreshToken) {
    console.log('[contaazul-auth] Token expirado para bar_id=' + barId + ', tentando renovar...')
    const refreshResult = await handleRefreshToken(supabase, barId)
    
    if (refreshResult.status === 200) {
      const updatedCredentials = await getCredentials(supabase, barId)
      return jsonResponse({
        connected: true,
        has_credentials: hasCredentials,
        needs_refresh: false,
        expires_at: updatedCredentials?.expires_at,
        auto_refreshed: true
      })
    }
  }
  
  return jsonResponse({
    connected: hasAccessToken && !isExpired,
    has_credentials: hasCredentials,
    needs_refresh: needsRefresh,
    expires_at: credentials.expires_at
  })
}

async function handleSaveCredentials(
  supabase: SupabaseClient, 
  barId: number, 
  clientId: string, 
  clientSecret: string
): Promise<Response> {
  if (!clientId || !clientSecret) {
    return errorResponse('client_id e client_secret sao obrigatorios', null, 400)
  }
  
  await upsertCredentials(supabase, barId, {
    client_id: clientId,
    client_secret: clientSecret
  })
  
  console.log('[contaazul-auth] Credenciais salvas para bar_id=' + barId)
  
  return jsonResponse({
    success: true
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions()
  }
  
  if (req.method !== 'POST') {
    return errorResponse('Metodo nao permitido. Use POST.', null, 405)
  }
  
  try {
    const body: AuthRequest = await req.json()
    
    if (!body.action) {
      return errorResponse('action e obrigatorio', null, 400)
    }
    
    if (!body.bar_id) {
      return errorResponse('bar_id e obrigatorio', null, 400)
    }
    
    const supabase = getSupabaseClient()
    
    switch (body.action) {
      case 'get_auth_url':
        return await handleGetAuthUrl(supabase, body.bar_id)
      
      case 'exchange_code':
        if (!body.code || !body.state) {
          return errorResponse('code e state sao obrigatorios para exchange_code', null, 400)
        }
        return await handleExchangeCode(supabase, body.bar_id, body.code, body.state)
      
      case 'refresh_token':
        return await handleRefreshToken(supabase, body.bar_id)
      
      case 'status':
        return await handleStatus(supabase, body.bar_id)
      
      case 'save_credentials':
        if (!body.client_id || !body.client_secret) {
          return errorResponse('client_id e client_secret sao obrigatorios para save_credentials', null, 400)
        }
        return await handleSaveCredentials(supabase, body.bar_id, body.client_id, body.client_secret)
      
      default:
        return errorResponse('Action desconhecida: ' + body.action, null, 400)
    }
  } catch (err) {
    console.error('[contaazul-auth] Erro nao tratado:', err)
    return errorResponse('Erro interno', err, 500)
  }
})