import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApifyReview {
  reviewId: string
  name: string
  text: string | null
  textTranslated: string | null
  publishAt: string
  publishedAtDate: string
  likesCount: number
  stars: number
  reviewerId: string
  reviewerUrl: string
  reviewerPhotoUrl: string
  reviewerNumberOfReviews: number
  isLocalGuide: boolean
  reviewContext: Record<string, unknown> | null
  reviewDetailedRating: { Food?: number; Service?: number; Atmosphere?: number } | null
  reviewImageUrls: string[] | null
  responseFromOwnerText: string | null
  responseFromOwnerDate: string | null
  placeId: string
  title: string
  totalScore: number
  reviewsCount: number
  url: string
  // Campos extras
  reviewUrl: string | null
  reviewOrigin: string | null
  originalLanguage: string | null
  translatedLanguage: string | null
  address: string | null
  city: string | null
  neighborhood: string | null
  state: string | null
  countryCode: string | null
  location: { lat: number; lng: number } | null
}

// Configuração dos bares e seus Place IDs
const BAR_PLACE_IDS: Record<number, { placeId: string; name: string }> = {
  3: { 
    placeId: 'ChIJz3z3lJA7WpMRaC_nQ3vL700', 
    name: 'Ordinário Bar e Música' 
  }
  // Adicionar mais bares conforme necessário
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { bar_id, run_new_scrape = false } = body

    const apifyToken = Deno.env.get('APIFY_API_TOKEN')
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN não configurado')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Se bar_id específico, processar apenas esse bar
    const barsToProcess = bar_id 
      ? { [bar_id]: BAR_PLACE_IDS[bar_id] }
      : BAR_PLACE_IDS

    const results: Record<number, { success: boolean; message: string; count?: number }> = {}

    for (const [barIdStr, barConfig] of Object.entries(barsToProcess)) {
      const currentBarId = parseInt(barIdStr)
      
      if (!barConfig) {
        results[currentBarId] = { success: false, message: 'Bar não configurado com Place ID' }
        continue
      }

      try {
        let datasetId: string

        if (run_new_scrape) {
          // Executar nova coleta no Apify
          console.log(`Iniciando nova coleta para ${barConfig.name}...`)
          
          const runResponse = await fetch(
            `https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${apifyToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startUrls: [{
                  url: `https://www.google.com/maps/place/?q=place_id:${barConfig.placeId}`
                }],
                maxReviews: 100, // Limitar para coleta diária
                language: 'pt-BR',
                reviewsSort: 'newest',
                reviewsStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Últimos 7 dias
              })
            }
          )

          const runData = await runResponse.json()
          
          if (!runData.data?.id) {
            throw new Error('Falha ao iniciar scraping no Apify')
          }

          // Aguardar conclusão (polling simples)
          const runId = runData.data.id
          let status = 'RUNNING'
          let attempts = 0
          const maxAttempts = 60 // 5 minutos máximo

          while (status === 'RUNNING' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)) // 5 segundos
            
            const statusResponse = await fetch(
              `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
            )
            const statusData = await statusResponse.json()
            status = statusData.data?.status || 'FAILED'
            attempts++
          }

          if (status !== 'SUCCEEDED') {
            throw new Error(`Scraping falhou com status: ${status}`)
          }

          // Pegar dataset ID do run
          const runInfoResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
          )
          const runInfo = await runInfoResponse.json()
          datasetId = runInfo.data.defaultDatasetId

        } else {
          // Usar dataset existente (para importação inicial)
          // Dataset do run manual: TlNhKAtRRR6cKeaFj
          datasetId = Deno.env.get('APIFY_DEFAULT_DATASET_ID') || 'TlNhKAtRRR6cKeaFj'
        }

        // Buscar reviews do dataset
        console.log(`Buscando reviews do dataset ${datasetId}...`)
        
        let allReviews: ApifyReview[] = []
        let offset = 0
        const limit = 1000

        while (true) {
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&offset=${offset}&limit=${limit}`
          )
          
          if (!datasetResponse.ok) {
            throw new Error(`Erro ao buscar dataset: ${datasetResponse.status}`)
          }

          const reviews: ApifyReview[] = await datasetResponse.json()
          
          if (reviews.length === 0) break
          
          allReviews = allReviews.concat(reviews)
          offset += limit

          console.log(`Carregadas ${allReviews.length} reviews...`)

          // Safety limit
          if (allReviews.length > 10000) break
        }

        console.log(`Total de ${allReviews.length} reviews para processar`)

        // Processar e inserir reviews em batches
        const batchSize = 100
        let insertedCount = 0
        let updatedCount = 0

        for (let i = 0; i < allReviews.length; i += batchSize) {
          const batch = allReviews.slice(i, i + batchSize)
          
          const reviewsToUpsert = batch.map(review => {
            // Extrair ratings detalhados (vem como objeto: {Food: 5, Service: 5, Atmosphere: 5})
            const detailedRatings = review.reviewDetailedRating || {}

            // Parsear data de publicação
            let publishedDate: string | null = null
            if (review.publishedAtDate) {
              publishedDate = review.publishedAtDate
            }

            // Parsear data da resposta do dono
            let ownerResponseDate: string | null = null
            if (review.responseFromOwnerDate) {
              ownerResponseDate = review.responseFromOwnerDate
            }

            return {
              review_id: review.reviewId,
              bar_id: currentBarId,
              reviewer_name: review.name,
              reviewer_id: review.reviewerId,
              reviewer_url: review.reviewerUrl,
              reviewer_photo_url: review.reviewerPhotoUrl,
              reviewer_number_of_reviews: review.reviewerNumberOfReviews,
              is_local_guide: review.isLocalGuide || false,
              stars: review.stars,
              text: review.text,
              text_translated: review.textTranslated,
              publish_at: review.publishAt,
              published_at_date: publishedDate,
              likes_count: review.likesCount || 0,
              rating_food: detailedRatings.Food || null,
              rating_service: detailedRatings.Service || null,
              rating_atmosphere: detailedRatings.Atmosphere || null,
              review_context: review.reviewContext && Object.keys(review.reviewContext).length > 0 ? review.reviewContext : null,
              review_image_urls: review.reviewImageUrls && review.reviewImageUrls.length > 0 ? review.reviewImageUrls : null,
              response_from_owner_text: review.responseFromOwnerText,
              response_from_owner_date: ownerResponseDate,
              place_id: review.placeId,
              place_title: review.title,
              place_total_score: review.totalScore,
              place_reviews_count: review.reviewsCount,
              // Campos extras
              review_url: review.reviewUrl || null,
              review_origin: review.reviewOrigin || 'Google',
              original_language: review.originalLanguage || null,
              translated_language: review.translatedLanguage || null,
              address: review.address || null,
              city: review.city || null,
              neighborhood: review.neighborhood || null,
              state: review.state || null,
              country_code: review.countryCode || null,
              latitude: review.location?.lat || null,
              longitude: review.location?.lng || null,
              source: 'apify',
              scraped_at: new Date().toISOString()
            }
          })

          const { error, data } = await supabase
            .from('google_reviews')
            .upsert(reviewsToUpsert, { 
              onConflict: 'review_id',
              ignoreDuplicates: false 
            })
            .select('id')

          if (error) {
            console.error(`Erro no batch ${i}-${i + batchSize}:`, error)
          } else {
            insertedCount += data?.length || batch.length
          }
        }

        results[currentBarId] = {
          success: true,
          message: `Sincronizadas ${insertedCount} reviews para ${barConfig.name}`,
          count: insertedCount
        }

        // Atualizar estatísticas do bar
        const statsResult = await supabase
          .from('google_reviews')
          .select('stars')
          .eq('bar_id', currentBarId)

        if (statsResult.data) {
          const totalReviews = statsResult.data.length
          const avgRating = totalReviews > 0 
            ? statsResult.data.reduce((acc, r) => acc + r.stars, 0) / totalReviews 
            : 0

          console.log(`Bar ${currentBarId}: ${totalReviews} reviews, média ${avgRating.toFixed(2)}`)
        }

      } catch (barError) {
        console.error(`Erro processando bar ${currentBarId}:`, barError)
        results[currentBarId] = {
          success: false,
          message: barError.message || 'Erro desconhecido'
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Erro geral:', error)
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
