import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')
    
    if (!clientId || !redirectUri) {
      throw new Error('Google OAuth credentials not configured')
    }

    const { bar_id } = await req.json()
    
    if (!bar_id) {
      throw new Error('bar_id is required')
    }

    // Scopes necessários para acessar reviews do Business Profile
    const scopes = [
      'https://www.googleapis.com/auth/business.manage'
    ].join(' ')

    // State para identificar o bar após callback
    const state = JSON.stringify({ bar_id })
    const encodedState = btoa(state)

    // Construir URL de autorização
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('access_type', 'offline') // Para obter refresh_token
    authUrl.searchParams.set('prompt', 'consent') // Força mostrar tela de consentimento
    authUrl.searchParams.set('state', encodedState)

    return new Response(
      JSON.stringify({
        success: true,
        auth_url: authUrl.toString(),
        message: 'Acesse a URL para autorizar o acesso ao Google Business Profile'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Erro:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
