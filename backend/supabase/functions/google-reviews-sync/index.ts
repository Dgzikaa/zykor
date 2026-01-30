import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para renovar access token usando refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string, expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'refresh_token'
    })
  })

  const data = await response.json()
  if (data.error) {
    console.error('Erro ao renovar token:', data)
    return null
  }
  return data
}

// Converter rating do Google para número
function ratingToNumber(rating: string): number {
  const ratingMap: Record<string, number> = {
    'ONE': 1,
    'TWO': 2,
    'THREE': 3,
    'FOUR': 4,
    'FIVE': 5
  }
  return ratingMap[rating] || 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bar_id, start_date, end_date } = await req.json()

    if (!bar_id) {
      throw new Error('bar_id is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar tokens do bar
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('bar_id', bar_id)
      .single()

    if (tokenError || !tokenData) {
      throw new Error('Token não encontrado. Execute a autorização primeiro.')
    }

    let accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token
    const accountId = tokenData.account_id
    const locationId = tokenData.location_id

    if (!accountId || !locationId) {
      throw new Error('Account ou Location não configurados. Reautorize.')
    }

    // Verificar se token expirou
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt < new Date()) {
      console.log('Token expirado, renovando...')
      const newTokens = await refreshAccessToken(refreshToken)
      if (!newTokens) {
        throw new Error('Falha ao renovar token. Reautorize.')
      }
      accessToken = newTokens.access_token
      
      // Atualizar no banco
      await supabase
        .from('google_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('bar_id', bar_id)
    }

    // Buscar reviews
    // Nota: A API v4 do My Business foi descontinuada para alguns endpoints
    // Usando a API mais recente
    const reviewsUrl = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews`
    
    console.log(`Buscando reviews de: ${reviewsUrl}`)
    
    const reviewsResponse = await fetch(reviewsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    const reviewsData = await reviewsResponse.json()
    console.log('Reviews response:', JSON.stringify(reviewsData).substring(0, 500))

    if (reviewsData.error) {
      // Tentar endpoint alternativo
      const altUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${accountId}`
      console.log('Tentando endpoint alternativo:', altUrl)
      
      throw new Error(`Erro da API Google: ${reviewsData.error.message || JSON.stringify(reviewsData.error)}`)
    }

    const reviews = reviewsData.reviews || []
    console.log(`Encontradas ${reviews.length} reviews`)

    // Processar e salvar reviews
    const processedReviews = []
    let count5Stars = 0
    let totalRating = 0

    for (const review of reviews) {
      const rating = ratingToNumber(review.starRating)
      if (rating === 5) count5Stars++
      totalRating += rating

      const reviewDate = review.createTime ? new Date(review.createTime).toISOString().split('T')[0] : null

      // Filtrar por data se especificado
      if (start_date && reviewDate && reviewDate < start_date) continue
      if (end_date && reviewDate && reviewDate > end_date) continue

      processedReviews.push({
        review_id: review.reviewId || review.name,
        bar_id: bar_id,
        date: reviewDate,
        star_rating: review.starRating,
        star_rating_number: rating,
        reviewer_name: review.reviewer?.displayName || 'Anônimo',
        comment: review.comment || null,
        reply: review.reviewReply?.comment || null,
        create_time: review.createTime,
        update_time: review.updateTime,
        source: 'google_business_api'
      })
    }

    // Salvar na tabela google_reviews (criar se não existir)
    if (processedReviews.length > 0) {
      // Primeiro, verificar se tabela existe
      const { error: tableError } = await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS google_reviews (
          id SERIAL PRIMARY KEY,
          review_id TEXT UNIQUE,
          bar_id INTEGER,
          date DATE,
          star_rating TEXT,
          star_rating_number INTEGER,
          reviewer_name TEXT,
          comment TEXT,
          reply TEXT,
          create_time TIMESTAMPTZ,
          update_time TIMESTAMPTZ,
          source TEXT DEFAULT 'google_business_api',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`
      })

      // Upsert reviews
      const { error: insertError } = await supabase
        .from('google_reviews')
        .upsert(processedReviews, { onConflict: 'review_id' })

      if (insertError) {
        console.error('Erro ao salvar reviews:', insertError)
      }
    }

    const avgRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(2) : null

    return new Response(
      JSON.stringify({
        success: true,
        bar_id,
        total_reviews: reviews.length,
        reviews_5_stars: count5Stars,
        average_rating: avgRating,
        processed: processedReviews.length,
        message: `Sincronizadas ${processedReviews.length} reviews`
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
