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
    let debugInfo = { accounts: null, locations: null, accountsError: null, locationsError: null }

    try {
      // Buscar accounts
      const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      })
      const accountsData = await accountsResponse.json()
      debugInfo.accounts = accountsData
      console.log('Accounts:', JSON.stringify(accountsData))

      if (accountsData.error) {
        debugInfo.accountsError = accountsData.error
      } else if (accountsData.accounts && accountsData.accounts.length > 0) {
        accountId = accountsData.accounts[0].name // ex: accounts/123456789
        
        // Buscar locations
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
          { headers: { 'Authorization': `Bearer ${tokens.access_token}` } }
        )
        const locationsData = await locationsResponse.json()
        debugInfo.locations = locationsData
        console.log('Locations:', JSON.stringify(locationsData))

        if (locationsData.error) {
          debugInfo.locationsError = locationsData.error
        } else if (locationsData.locations && locationsData.locations.length > 0) {
          locationId = locationsData.locations[0].name // ex: locations/987654321
        }
      }
    } catch (e) {
      console.error('Erro ao buscar account/location:', e)
      debugInfo.accountsError = e.message
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

    // Página de sucesso com debug info
    return new Response(
      `<html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .success { color: green; }
            .warning { color: orange; }
            .info { background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .debug { background: #ffe0e0; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1 class="${accountId ? 'success' : 'warning'}">✅ Autorização concluída!</h1>
          <div class="info">
            <p><strong>Bar ID:</strong> ${barId}</p>
            <p><strong>Account:</strong> ${accountId || 'Não encontrado'}</p>
            <p><strong>Location:</strong> ${locationId || 'Não encontrado'}</p>
            <p><strong>Expira em:</strong> ${expiresAt.toLocaleString('pt-BR')}</p>
          </div>
          ${!accountId ? `
          <h2>Debug Info (resposta das APIs Google):</h2>
          <div class="debug">
            <strong>Accounts API Response:</strong>
            ${JSON.stringify(debugInfo.accounts, null, 2)}
            
            <strong>Locations API Response:</strong>
            ${JSON.stringify(debugInfo.locations, null, 2)}
          </div>
          <p class="warning">⚠️ As APIs podem não estar habilitadas no Google Cloud Console. Habilite:</p>
          <ul>
            <li><a href="https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com" target="_blank">My Business Account Management API</a></li>
            <li><a href="https://console.cloud.google.com/apis/library/mybusinessbusinessinformation.googleapis.com" target="_blank">My Business Business Information API</a></li>
          </ul>
          ` : ''}
          <p>Você pode fechar esta janela. O Zykor agora pode sincronizar suas avaliações do Google!</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
    )

  } catch (error) {
    console.error('Erro no callback:', error)
    return new Response(
      `<html><body><h1>Erro</h1><p>${error.message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    )
  }
})
