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

        // Buscar dados do ContaHub
        const { data: contahubData } = await supabase
          .from('contahub_pagamentos')
          .select('liquido')
          .eq('bar_id', barId)
          .gte('dt_gerencial', startDate)
          .lte('dt_gerencial', endDate)

        const faturamentoContahub = (contahubData || []).reduce((sum, item) => sum + (parseFloat(item.liquido) || 0), 0)

        // Buscar dados do Yuzer
        const { data: yuzerData } = await supabase
          .from('yuzer_pagamento')
          .select('valor_liquido')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)

        const faturamentoYuzer = (yuzerData || []).reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0)

        // Buscar dados do Sympla
        const { data: symplaData } = await supabase
          .from('sympla_pedidos')
          .select('valor_liquido')
          .gte('data_pedido', startDate)
          .lte('data_pedido', endDate)

        const faturamenteSympla = (symplaData || []).reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0)

        const faturamentoTotal = faturamentoContahub + faturamentoYuzer + faturamenteSympla

        // Buscar clientes atendidos (visitas) do eventos_base
        const { data: eventosData } = await supabase
          .from('eventos_base')
          .select('cl_real')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)

        const clientesAtendidos = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.cl_real) || 0), 0)

        const ticketMedio = clientesAtendidos > 0 ? faturamentoTotal / clientesAtendidos : 0

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

        console.log(`💰 Faturamento: R$ ${faturamentoTotal.toFixed(2)} (CH: ${faturamentoContahub.toFixed(2)}, Yuzer: ${faturamentoYuzer.toFixed(2)}, Sympla: ${faturamenteSympla.toFixed(2)})`)
        console.log(`👥 Clientes: ${clientesAtendidos}`)
        console.log(`🎫 Ticket Médio: R$ ${ticketMedio.toFixed(2)}`)

        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('desempenho_semanal')
          .update({
            faturamento_total: faturamentoTotal,
            clientes_atendidos: clientesAtendidos,
            ticket_medio: ticketMedio,
            stockout_drinks_perc: stockoutDrinksPerc,
            stockout_comidas_perc: stockoutComidasPerc,
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
