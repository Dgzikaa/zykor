import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("🔄 Recalcular Desempenho Auto - Processamento via pg_cron");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando recálculo automático de desempenho semanal...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todas as semanas que precisam ser recalculadas
    // LÓGICA: Recalcular semana atual + últimas 3 semanas
    const hoje = new Date()
    const trintaDiasAtras = new Date(hoje)
    trintaDiasAtras.setDate(hoje.getDate() - 30)

    const { data: semanas, error: semanasError } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .gte('data_fim', trintaDiasAtras.toISOString().split('T')[0])
      .order('data_fim', { ascending: false })
      .limit(4)

    if (semanasError) {
      throw semanasError
    }

    console.log(`📊 Encontradas ${semanas?.length || 0} semanas para recalcular`)

    let sucessos = 0
    let erros = 0
    const detalhes: any[] = []

    // Recalcular cada semana DIRETAMENTE (sem chamar API externa)
    for (const semana of semanas || []) {
      try {
        console.log(`⚙️ Recalculando semana ${semana.numero_semana} (${semana.data_inicio} a ${semana.data_fim}) - Bar ${semana.bar_id}`)

        const startDate = semana.data_inicio
        const endDate = semana.data_fim
        const barId = semana.bar_id

        // Buscar dados consolidados de eventos_base (real_r já inclui ContaHub + Yuzer + Sympla)
        const { data: eventosData } = await supabase
          .from('eventos_base')
          .select('real_r, cl_real')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)
          .eq('ativo', true)

        const faturamentoTotal = (eventosData || []).reduce((sum, item) => sum + (parseFloat(item.real_r) || 0), 0)
        const clientesAtendidos = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.cl_real) || 0), 0)
        const ticketMedio = clientesAtendidos > 0 ? faturamentoTotal / clientesAtendidos : 0

        // Buscar meta semanal (soma de m1_r dos eventos)
        const { data: eventosMetaData } = await supabase
          .from('eventos_base')
          .select('m1_r')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)
          .eq('ativo', true)

        const metaSemanal = (eventosMetaData || []).reduce((sum, item) => sum + (parseFloat(item.m1_r) || 0), 0)

        // Buscar stockout de drinks (Zykor) - calcular percentual médio da semana
        const { data: stockoutDrinksData } = await supabase
          .from('contahub_stockout')
          .select('prd_venda')
          .eq('bar_id', barId)
          .gte('data_consulta', startDate)
          .lte('data_consulta', endDate)
          .eq('prd_ativo', 'S')
          .in('loc_desc', ['Pressh', 'Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos'])

        const totalDrinks = (stockoutDrinksData || []).length
        const stockoutDrinksCount = (stockoutDrinksData || []).filter(item => item.prd_venda === 'N').length
        const stockoutDrinksPerc = totalDrinks > 0 ? (stockoutDrinksCount / totalDrinks) * 100 : 0

        console.log(`🍹 Drinks: ${stockoutDrinksCount}/${totalDrinks} = ${stockoutDrinksPerc.toFixed(2)}%`)

        // Buscar stockout de comidas (Zykor) - calcular percentual médio da semana
        const { data: stockoutComidasData } = await supabase
          .from('contahub_stockout')
          .select('prd_venda')
          .eq('bar_id', barId)
          .gte('data_consulta', startDate)
          .lte('data_consulta', endDate)
          .eq('prd_ativo', 'S')
          .in('loc_desc', ['Cozinha', 'Cozinha 1', 'Cozinha 2'])

        const totalComidas = (stockoutComidasData || []).length
        const stockoutComidasCount = (stockoutComidasData || []).filter(item => item.prd_venda === 'N').length
        const stockoutComidasPerc = totalComidas > 0 ? (stockoutComidasCount / totalComidas) * 100 : 0

        console.log(`🍽️ Comidas: ${stockoutComidasCount}/${totalComidas} = ${stockoutComidasPerc.toFixed(2)}%`)
        console.log(`💰 Faturamento Total: R$ ${faturamentoTotal.toFixed(2)} (${eventosData?.length || 0} dias)`)
        console.log(`👥 Clientes: ${clientesAtendidos}`)
        console.log(`🎫 Ticket Médio: R$ ${ticketMedio.toFixed(2)}`)

        // Calcular percentuais de mix (bebidas/drinks/comida/happy hour) - média ponderada pelo faturamento
        const { data: eventosComPercentuais } = await supabase
          .from('eventos_base')
          .select('real_r, percent_b, percent_d, percent_c, percent_happy_hour')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)
          .eq('ativo', true)
          .not('real_r', 'is', null)
          .gt('real_r', 0)

        let percBebidasPonderado = 0
        let percDrinksPonderado = 0
        let percComidaPonderado = 0
        let percHappyHourPonderado = 0

        if (eventosComPercentuais && eventosComPercentuais.length > 0) {
          const faturamentoTotalComPerc = eventosComPercentuais.reduce((sum, e) => sum + parseFloat(e.real_r), 0)
          
          if (faturamentoTotalComPerc > 0) {
            const somaBebidasPonderada = eventosComPercentuais.reduce((sum, e) => sum + (parseFloat(e.real_r) * (parseFloat(e.percent_b) || 0) / 100), 0)
            const somaDrinksPonderada = eventosComPercentuais.reduce((sum, e) => sum + (parseFloat(e.real_r) * (parseFloat(e.percent_d) || 0) / 100), 0)
            const somaComidaPonderada = eventosComPercentuais.reduce((sum, e) => sum + (parseFloat(e.real_r) * (parseFloat(e.percent_c) || 0) / 100), 0)
            const somaHappyHourPonderada = eventosComPercentuais.reduce((sum, e) => sum + (parseFloat(e.real_r) * (parseFloat(e.percent_happy_hour) || 0) / 100), 0)
            
            percBebidasPonderado = (somaBebidasPonderada / faturamentoTotalComPerc) * 100
            percDrinksPonderado = (somaDrinksPonderada / faturamentoTotalComPerc) * 100
            percComidaPonderado = (somaComidaPonderada / faturamentoTotalComPerc) * 100
            percHappyHourPonderado = (somaHappyHourPonderada / faturamentoTotalComPerc) * 100
          }
        }

        console.log(`🍺 Mix Semanal - Bebidas: ${percBebidasPonderado.toFixed(1)}%, Drinks: ${percDrinksPonderado.toFixed(1)}%, Comida: ${percComidaPonderado.toFixed(1)}%, Happy Hour: ${percHappyHourPonderado.toFixed(1)}%`)

        // Calcular reservas (pessoas) e mesas (count de reservas)
        const { data: eventosReservas } = await supabase
          .from('eventos_base')
          .select('res_tot, res_p, num_mesas_tot, num_mesas_presentes')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)
          .eq('ativo', true)

        // res_tot e res_p = pessoas (SUM)
        const reservasTotais = (eventosReservas || []).reduce((sum, e) => sum + (parseInt(e.res_tot) || 0), 0)
        const reservasPresentes = (eventosReservas || []).reduce((sum, e) => sum + (parseInt(e.res_p) || 0), 0)
        
        // num_mesas_tot e num_mesas_presentes = mesas (COUNT)
        const mesasTotais = (eventosReservas || []).reduce((sum, e) => sum + (parseInt(e.num_mesas_tot) || 0), 0)
        const mesasPresentes = (eventosReservas || []).reduce((sum, e) => sum + (parseInt(e.num_mesas_presentes) || 0), 0)

        console.log(`🎫 Mesas: ${mesasTotais}/${mesasPresentes} | Pessoas: ${reservasTotais}/${reservasPresentes}`)

        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('desempenho_semanal')
          .update({
            faturamento_total: faturamentoTotal,
            clientes_atendidos: clientesAtendidos,
            ticket_medio: ticketMedio,
            meta_semanal: metaSemanal,
            mesas_totais: mesasTotais,
            mesas_presentes: mesasPresentes,
            reservas_totais: reservasTotais,
            reservas_presentes: reservasPresentes,
            stockout_drinks_perc: stockoutDrinksPerc,
            stockout_comidas_perc: stockoutComidasPerc,
            perc_bebidas: percBebidasPonderado,
            perc_drinks: percDrinksPonderado,
            perc_comida: percComidaPonderado,
            perc_happy_hour: percHappyHourPonderado,
            updated_at: new Date().toISOString(),
          })
          .eq('id', semana.id)
          .eq('bar_id', barId)

        if (updateError) {
          throw updateError
        }

        sucessos++
        detalhes.push({
          semana: semana.numero_semana,
          bar_id: barId,
          faturamento: faturamentoTotal,
          clientes: clientesAtendidos,
          status: 'sucesso'
        })
        console.log(`✅ Semana ${semana.numero_semana} atualizada com sucesso`)

      } catch (error: any) {
        erros++
        detalhes.push({
          semana: semana.numero_semana,
          bar_id: semana.bar_id,
          status: 'erro',
          erro: error.message
        })
        console.error(`❌ Erro ao processar semana ${semana.numero_semana}:`, error.message || error)
      }
    }

    const resultado = {
      success: sucessos > 0,
      message: `Recálculo automático concluído: ${sucessos} sucessos, ${erros} erros`,
      sucessos,
      erros,
      total: semanas?.length || 0,
      detalhes,
      timestamp: new Date().toISOString(),
    }

    console.log('📊 Resultado final:', JSON.stringify(resultado))

    return new Response(
      JSON.stringify(resultado),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
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
