import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 Iniciando recálculo automático de desempenho semanal...')

    // Buscar todas as semanas que precisam ser recalculadas
    // NOVA LÓGICA: Recalcular semana atual + últimas 3 semanas
    const hoje = new Date()
    const trintaDiasAtras = new Date(hoje)
    trintaDiasAtras.setDate(hoje.getDate() - 30)

    const { data: semanas, error: semanasError } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .gte('data_fim', trintaDiasAtras.toISOString().split('T')[0])
      .order('data_fim', { ascending: false })
      .limit(4) // Semana atual + últimas 3 semanas

    if (semanasError) {
      throw semanasError
    }

    console.log(`📊 Encontradas ${semanas?.length || 0} semanas para recalcular`)

    let sucessos = 0
    let erros = 0

    // Recalcular cada semana
    for (const semana of semanas || []) {
      try {
        console.log(`⚙️ Recalculando semana ${semana.numero_semana} (${semana.data_inicio} a ${semana.data_fim})`)

        // Chamar a API de recálculo (URL do frontend/API routes)
        const apiUrl = 'https://zykor.vercel.app/api/gestao/desempenho/recalcular'
        const recalcResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-data': JSON.stringify({ bar_id: semana.bar_id }),
          },
          body: JSON.stringify({
            semana_id: semana.id,
            recalcular_todas: false,
          }),
        })

        if (recalcResponse.ok) {
          sucessos++
          console.log(`✅ Semana ${semana.numero_semana} recalculada com sucesso`)
        } else {
          erros++
          console.error(`❌ Erro ao recalcular semana ${semana.numero_semana}:`, await recalcResponse.text())
        }
      } catch (error) {
        erros++
        console.error(`❌ Erro ao processar semana ${semana.numero_semana}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recálculo automático concluído: ${sucessos} sucessos, ${erros} erros`,
        sucessos,
        erros,
        total: semanas?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Erro no recálculo automático:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
