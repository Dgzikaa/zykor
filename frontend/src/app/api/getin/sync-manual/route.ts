import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos

interface GetinReservation {
  id: string
  unit_id: string
  unit_name: string
  sector_id: string
  sector_name: string
  name: string
  email: string
  mobile: string
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
  custom_fields?: any
  monetize?: any
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

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

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

    // Parse request body for custom dates
    const body = await request.json()
    const startDate = body.start_date || ''
    const endDate = body.end_date || ''

    if (!startDate || !endDate) {
      throw new Error('start_date e end_date são obrigatórios')
    }

    let totalReservas = 0
    let totalSalvas = 0
    let totalErros = 0
    let currentPage = 1
    let hasMorePages = true

    while (hasMorePages) {
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

      totalReservas += data.data.length

      for (const reserva of data.data) {
        try {
          const reservaData = {
            bar_id: 3,
            reservation_id: reserva.id,
            unit_id: reserva.unit_id || null,
            sector_id: reserva.sector_id || null,
            sector_name: reserva.sector_name || null,
            customer_name: reserva.name || null,
            customer_email: reserva.email || null,
            customer_phone: reserva.mobile || null,
            reservation_date: reserva.date,
            reservation_time: reserva.time || null,
            people: reserva.people || 0,
            status: reserva.status || 'pending',
            discount: reserva.discount || 0,
            info: reserva.info || null,
            no_show: reserva.no_show || false,
            no_show_tax: reserva.no_show_tax || 0,
            no_show_hours: reserva.no_show_hours || 0,
            no_show_eligible: reserva.no_show_eligible || false,
            confirmation_sent: reserva.confirmation_sent || false,
            nps_answered: reserva.nps_answered || false,
            nps_url: reserva.nps_url || null,
            custom_fields: reserva.custom_fields || null,
            monetize: reserva.monetize || null,
            raw_data: reserva,
            synced_at: new Date().toISOString()
          }

          const { error: upsertError } = await supabase
            .from('bronze_getin_reservations')
            .upsert(reservaData, {
              onConflict: 'bar_id,reservation_id',
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
    const { error: syncError } = await supabase.rpc('sync_mesas_getin_to_eventos')

    if (syncError) {
      console.warn('⚠️ Erro ao sincronizar mesas:', syncError.message)
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

    return NextResponse.json({
      success: true,
      message: 'Sincronização GET IN concluída',
      stats: {
        total_encontrados: totalReservas,
        total_salvos: totalSalvas,
        total_erros: totalErros,
        periodo: `${startDate} a ${endDate}`
      }
    })

  } catch (error) {
    console.error('❌ Erro:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
