import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const stateEncoded = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      return new Response(
        `<html><body><h1>Erro na autorização</h1><p>${error}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      )
    }

    if (!code || !stateEncoded) {
      return new Response(
        '<html><body><h1>Parâmetros inválidos</h1></body></html>',
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      )
    }

    // Decodificar state
    const state = JSON.parse(atob(stateEncoded))
    const barId = state.bar_id

    // Trocar code por tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code'
      })
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error('Erro ao obter tokens:', tokens)
      return new Response(
        `<html><body><h1>Erro ao obter tokens</h1><p>${tokens.error_description || tokens.error}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      )
    }

    // Calcular expiração
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

    // Buscar account e location IDs
    let accountId = null
    let locationId = null

    try {
      // Buscar accounts
      const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      })
      const accountsData = await accountsResponse.json()
      console.log('Accounts:', JSON.stringify(accountsData))

      if (accountsData.accounts && accountsData.accounts.length > 0) {
        accountId = accountsData.accounts[0].name // ex: accounts/123456789
        
        // Buscar locations
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
          { headers: { 'Authorization': `Bearer ${tokens.access_token}` } }
        )
        const locationsData = await locationsResponse.json()
        console.log('Locations:', JSON.stringify(locationsData))

        if (locationsData.locations && locationsData.locations.length > 0) {
          locationId = locationsData.locations[0].name // ex: locations/987654321
        }
      }
    } catch (e) {
      console.error('Erro ao buscar account/location:', e)
    }

    // Salvar no banco
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: dbError } = await supabase
      .from('google_oauth_tokens')
      .upsert({
        bar_id: barId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        account_id: accountId,
        location_id: locationId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'bar_id'
      })

    if (dbError) {
      console.error('Erro ao salvar tokens:', dbError)
      return new Response(
        `<html><body><h1>Erro ao salvar tokens</h1><p>${dbError.message}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      )
    }

    // Página de sucesso
    return new Response(
      `<html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: green; }
            .info { background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Autorização concluída!</h1>
          <div class="info">
            <p><strong>Bar ID:</strong> ${barId}</p>
            <p><strong>Account:</strong> ${accountId || 'Não encontrado'}</p>
            <p><strong>Location:</strong> ${locationId || 'Não encontrado'}</p>
            <p><strong>Expira em:</strong> ${expiresAt.toLocaleString('pt-BR')}</p>
          </div>
          <p>Você pode fechar esta janela. O Zykor agora pode sincronizar suas avaliações do Google!</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    )

  } catch (error) {
    console.error('Erro no callback:', error)
    return new Response(
      `<html><body><h1>Erro</h1><p>${error.message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    )
  }
})
