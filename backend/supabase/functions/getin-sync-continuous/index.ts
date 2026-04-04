import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  `, x-cron-secret`,
}

interface GetinReservation {
  id: string
  unit_id: string
  unit_name: string
  sector_id: string
  sector_name: string
  customer_name: string
  customer_email: string
  customer_phone: string
  date: string
  time: string
  people: number
  status: string
  discount: number
  no_show: boolean
  no_show_tax: number
  no_show_hours: number
  no_show_eligible: boolean
  confirmation_sent: boolean
  nps_answered: boolean
  nps_url: string
  info: string
  unit: {
    cover_image: string
    profile_image: string
    full_address: string
    zipcode: string
    cuisine_name: string
    city_name: string
    coordinates: {
      lat: number
      lng: number
    }
  }
}

interface GetinResponse {
  success: boolean
  data: GetinReservation[]
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;)
  }

  // 💓 Heartbeat: variáveis no escopo externo para acesso no catch
  let heartbeatId: number | null = null
  let startTime: number = Date.now()

  try {
    console.log('🚀 Iniciando sincronização contínua GET IN')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 💓 Heartbeat: registrar início da execução
    const hbResult = await heartbeatStart(supabase, 'getin-sync-continuous', 3, 'sync', 'pgcron')
    heartbeatId = hbResult.heartbeatId
    startTime = hbResult.startTime

    // Get Getin credentials from database
    const { data: credenciais, error: credError } = await supabase
      .from('api_credentials')
      .select('api_token')
      .eq('sistema', 'getin')
      .eq('ambiente', 'producao')
      .eq('ativo', true)
      .single()

    if (credError || !credenciais?.api_token) {
      throw new Error('Credenciais do Getin não encontradas')
    }

    const getinApiKey = credenciais.api_token
    console.log('✅ Credenciais carregadas')

    // Parse request body for custom dates (optional)
    let startDate: string
    let endDate: string
    
    try {
      const body = await req.json()
      startDate = body.start_date || ''
      endDate = body.end_date || ''
    } catch {
      // No body or invalid JSON, use defaults
      startDate = ''
      endDate = ''
    }

    // Calculate date range: custom or (today - 7) to (today + 60)
    if (!startDate || !endDate) {
      const hoje = new Date()
      const dataInicio = new Date(hoje)
      dataInicio.setDate(hoje.getDate() - 7) // Últimos 7 dias para capturar alterações retroativas
      
      const dataFim = new Date(hoje)
      dataFim.setDate(hoje.getDate() + 60)

      startDate = dataInicio.toISOString().split('T')[0]
      endDate = dataFim.toISOString().split('T')[0]
    }

    console.log(`📅 Período: ${startDate} a ${endDate}`)

    let totalReservas = 0
    let totalSalvas = 0
    let totalErros = 0
    let currentPage = 1
    let hasMorePages = true

    while (hasMorePages) {
      console.log(`📡 Página ${currentPage}...`)

      const getinUrl = new URL('https://api.getinapis.com/apis/v2/reservations')
      getinUrl.searchParams.set('start_date', startDate)
      getinUrl.searchParams.set('end_date', endDate)
      getinUrl.searchParams.set('page', currentPage.toString())
      getinUrl.searchParams.set('per_page', '50')

      const response = await fetch(getinUrl.toString(), {
        method: 'GET',
        headers: {
          'apiKey': getinApiKey,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Erro API Getin: ${response.status}`)
      }

      const data: GetinResponse = await response.json()
      
      if (!data.success || !data.data || data.data.length === 0) {
        break
      }

      console.log(`✅ ${data.data.length} reservas encontradas`)
      totalReservas += data.data.length

      for (const reserva of data.data) {
        try {
          const reservaData = {
            reservation_id: reserva.id,
            unit_id: reserva.unit_id,
            unit_name: reserva.unit_name,
            sector_id: reserva.sector_id,
            sector_name: reserva.sector_name,
            bar_id: 3,
            customer_name: reserva.customer_name,
            customer_email: reserva.customer_email,
            customer_phone: reserva.customer_phone,
            reservation_date: reserva.date,
            reservation_time: reserva.time,
            people: reserva.people,
            status: reserva.status,
            discount: reserva.discount || 0,
            no_show: reserva.no_show || false,
            no_show_tax: reserva.no_show_tax || 0,
            no_show_hours: reserva.no_show_hours || 0,
            no_show_eligible: reserva.no_show_eligible || false,
            confirmation_sent: reserva.confirmation_sent || false,
            nps_answered: reserva.nps_answered || false,
            nps_url: reserva.nps_url || '',
            info: reserva.info || '',
            unit_cover_image: reserva.unit?.cover_image || '',
            unit_profile_image: reserva.unit?.profile_image || '',
            unit_full_address: reserva.unit?.full_address || '',
            unit_zipcode: reserva.unit?.zipcode || '',
            unit_cuisine_name: reserva.unit?.cuisine_name || '',
            unit_city_name: reserva.unit?.city_name || '',
            unit_coordinates_lat: reserva.unit?.coordinates?.lat || 0,
            unit_coordinates_lng: reserva.unit?.coordinates?.lng || 0,
            raw_data: reserva,
            updated_at: new Date().toISOString()
          }

          const { error: upsertError } = await supabase
            .from('getin_reservations')
            .upsert(reservaData, {
              onConflict: 'reservation_id',
              ignoreDuplicates: false
            })

          if (upsertError) {
            console.error(`❌ Erro ${reserva.id}:`, upsertError.message)
            totalErros++
          } else {
            totalSalvas++
          }

        } catch (error) {
          console.error(`❌ Erro reserva ${reserva.id}:`, error)
          totalErros++
        }
      }

      // API v2 não retorna pagination, continua até não ter mais dados
      currentPage++
      hasMorePages = data.data.length === 50 // Se retornou 50, pode ter mais

      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Após sincronizar, atualizar eventos_base
    console.log('🔄 Sincronizando mesas para eventos_base...')
    const { error: syncError } = await supabase.rpc('sync_mesas_getin_to_eventos')
    
    if (syncError) {
      console.warn('⚠️ Erro ao sincronizar mesas:', syncError.message)
    } else {
      console.log('✅ Mesas sincronizadas com eventos_base')
    }

    // Log sync result
    try {
      await supabase
        .from('getin_sync_logs')
        .insert({
          status: 'sucesso',
          reservas_extraidas: totalReservas,
          reservas_novas: totalSalvas,
          reservas_atualizadas: 0,
          timestamp: new Date().toISOString(),
          detalhes: {
            periodo_inicio: startDate,
            periodo_fim: endDate,
            total_erros: totalErros
          }
        })
    } catch (logError) {
      console.warn('⚠️ Erro ao registrar log:', logError)
    }

    console.log('🎉 Sincronização concluída!')

    // 💓 Heartbeat: registrar sucesso
    await heartbeatEnd(
      supabase,
      heartbeatId,
      totalErros === 0 ? 'success' : 'partial',
      startTime,
      totalSalvas,
      {
        total_encontrados: totalReservas,
        total_salvos: totalSalvas,
        total_erros: totalErros,
        periodo: `${startDate} a ${endDate}`
      }
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização GET IN concluída',
        stats: {
          total_encontrados: totalReservas,
          total_salvos: totalSalvas,
          total_erros: totalErros,
          periodo: `${startDate} a ${endDate}`
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Erro:', error)
    
    // 💓 Heartbeat: registrar erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabaseForError = createClient(supabaseUrl, supabaseKey)
      await heartbeatError(supabaseForError, heartbeatId, startTime, error instanceof Error ? error : String(error))
    } catch (hbErr) {
      console.warn('⚠️ Erro ao registrar heartbeat de erro:', hbErr)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
