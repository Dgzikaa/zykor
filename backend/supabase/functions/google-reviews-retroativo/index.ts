import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuração dos bares e seus Place IDs
const BAR_PLACE_IDS: Record<number, { placeId: string; name: string }> = {
  3: { 
    placeId: 'ChIJz3z3lJA7WpMRaC_nQ3vL700', 
    name: 'Ordinário Bar e Música' 
  },
  4: {
    placeId: 'ChIJt50cXnQ7WpMRjlTp98nT91o',
    name: 'Deboche! Bar'
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json().catch(() => ({}))
    const { bar_id, action = 'start' } = body

    const apifyToken = Deno.env.get('APIFY_API_TOKEN')
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN não configurado')
    }

    // ACTION: START - Inicia o scraping retroativo
    if (action === 'start') {
      const barsToProcess = bar_id 
        ? { [bar_id]: BAR_PLACE_IDS[bar_id] }
        : BAR_PLACE_IDS

      const results: Record<number, { success: boolean; runId?: string; message: string }> = {}

      for (const [barIdStr, barConfig] of Object.entries(barsToProcess)) {
        const currentBarId = parseInt(barIdStr)
        
        if (!barConfig) {
          results[currentBarId] = { success: false, message: 'Bar não configurado' }
          continue
        }

        try {
          console.log(`🔄 Iniciando scraping retroativo para ${barConfig.name}...`)
          
          // Webhook para receber notificação quando terminar
          const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-reviews-retroativo`
          
          const runResponse = await fetch(
            `https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${apifyToken}&waitForFinish=0`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startUrls: [{
                  url: `https://www.google.com/maps/place/?q=place_id:${barConfig.placeId}`
                }],
                maxReviews: 50000,
                language: 'pt-BR',
                reviewsSort: 'newest'
                // Sem reviewsStartDate = busca TODO o histórico
              })
            }
          )

          const runData = await runResponse.json()
          
          if (!runData.data?.id) {
            throw new Error('Falha ao iniciar scraping')
          }

          const runId = runData.data.id
          
          // Salvar o run na tabela para monitoramento
          await supabase.from('google_reviews_imports').upsert({
            bar_id: currentBarId,
            apify_run_id: runId,
            status: 'running',
            started_at: new Date().toISOString()
          }, { onConflict: 'bar_id' })

          results[currentBarId] = {
            success: true,
            runId,
            message: `Scraping iniciado para ${barConfig.name}. Run ID: ${runId}`
          }

          console.log(`✅ Run iniciado: ${runId}`)
          
        } catch (error) {
          results[currentBarId] = { success: false, message: error.message }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Jobs iniciados! Use action=status para verificar o progresso.',
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ACTION: STATUS - Verifica status dos jobs em andamento
    if (action === 'status') {
      const { data: imports } = await supabase
        .from('google_reviews_imports')
        .select('*')
        .order('started_at', { ascending: false })

      if (!imports || imports.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'Nenhum job em andamento', imports: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const results = []
      
      for (const imp of imports) {
        if (imp.status === 'running' && imp.apify_run_id) {
          // Verificar status no Apify
          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${imp.apify_run_id}?token=${apifyToken}`
          )
          const statusData = await statusResponse.json()
          const apifyStatus = statusData.data?.status
          
          if (apifyStatus === 'SUCCEEDED') {
            const datasetId = statusData.data?.defaultDatasetId
            
            // Importar o dataset
            console.log(`📥 Importando dataset ${datasetId} para bar ${imp.bar_id}...`)
            
            const importResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-reviews-apify-sync`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                },
                body: JSON.stringify({
                  bar_id: imp.bar_id,
                  dataset_id: datasetId
                })
              }
            )
            
            const importResult = await importResponse.json()
            
            await supabase.from('google_reviews_imports').update({
              status: 'completed',
              dataset_id: datasetId,
              records_imported: importResult.results?.[imp.bar_id]?.count || 0,
              finished_at: new Date().toISOString()
            }).eq('bar_id', imp.bar_id)

            results.push({
              bar_id: imp.bar_id,
              status: 'completed',
              records: importResult.results?.[imp.bar_id]?.count || 0
            })
            
          } else if (apifyStatus === 'FAILED' || apifyStatus === 'ABORTED') {
            await supabase.from('google_reviews_imports').update({
              status: 'failed',
              finished_at: new Date().toISOString()
            }).eq('bar_id', imp.bar_id)
            
            results.push({ bar_id: imp.bar_id, status: 'failed', apifyStatus })
            
          } else {
            results.push({ bar_id: imp.bar_id, status: 'running', apifyStatus })
          }
        } else {
          results.push({ bar_id: imp.bar_id, status: imp.status })
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use action=start ou action=status' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('Erro:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
