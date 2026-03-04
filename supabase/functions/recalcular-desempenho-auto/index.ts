import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("🔄 Recalcular Desempenho Auto - Processamento via pg_cron");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando recálculo automático de desempenho semanal...');
    console.log('🔑 Method:', req.method);
    console.log('🔑 Auth header presente:', !!req.headers.get('authorization'));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 Supabase URL:', supabaseUrl ? 'OK' : 'MISSING');
    console.log('🔧 Service Key:', supabaseServiceKey ? 'OK' : 'MISSING');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Garantir linha da semana atual para cada bar (3 e 4), evitando "sumiço" da semana nova
    const hoje = new Date();
    const anoAtual = hoje.getUTCFullYear();
    const semanaAtual = getISOWeek(hoje);
    const { start: semanaStart, end: semanaEnd } = getWeekDateRange(anoAtual, semanaAtual);

    for (const barId of [3, 4]) {
      const { data: semanaExistente, error: semanaExistenteError } = await supabase
        .from('desempenho_semanal')
        .select('id')
        .eq('bar_id', barId)
        .eq('ano', anoAtual)
        .eq('numero_semana', semanaAtual)
        .maybeSingle();

      if (semanaExistenteError) {
        throw semanaExistenteError;
      }

      if (!semanaExistente) {
        const { error: insertSemanaError } = await supabase
          .from('desempenho_semanal')
          .insert({
            bar_id: barId,
            ano: anoAtual,
            numero_semana: semanaAtual,
            data_inicio: semanaStart,
            data_fim: semanaEnd,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertSemanaError) {
          throw insertSemanaError;
        }
      }
    }

    // Buscar todas as semanas que precisam ser recalculadas
    // LÓGICA: Recalcular semana atual + últimas 3 semanas POR BAR
    const quarentaECincoDiasAtras = new Date(hoje)
    quarentaECincoDiasAtras.setDate(hoje.getDate() - 45)

    // Buscar 4 semanas para CADA bar (não 4 no total)
    const { data: semanasBar3, error: semanasError3 } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', 3)
      .gte('data_fim', quarentaECincoDiasAtras.toISOString().split('T')[0])
      .order('data_fim', { ascending: false })
      .limit(6)

    const { data: semanasBar4, error: semanasError4 } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', 4)
      .gte('data_fim', quarentaECincoDiasAtras.toISOString().split('T')[0])
      .order('data_fim', { ascending: false })
      .limit(6)

    if (semanasError3 || semanasError4) {
      throw semanasError3 || semanasError4
    }

    const semanas = [...(semanasBar3 || []), ...(semanasBar4 || [])]

    console.log(`📊 Encontradas ${semanas?.length || 0} semanas para recalcular (${semanasBar3?.length || 0} Ordinário + ${semanasBar4?.length || 0} Deboche)`)

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

        // Fonte canônica semanal: eventos_base (sem descontar conta_assinada novamente)
        const { data: eventosData } = await supabase
          .from('eventos_base')
          .select('real_r, cl_real, m1_r, res_tot, res_p, num_mesas_tot, num_mesas_presentes, faturamento_entrada, faturamento_bar, c_art')
          .eq('bar_id', barId)
          .gte('data_evento', startDate)
          .lte('data_evento', endDate)
          .eq('ativo', true)

        const faturamentoTotal = (eventosData || []).reduce((sum, item) => sum + (parseFloat(item.real_r) || 0), 0)
        const faturamentoEntrada = (eventosData || []).reduce((sum, item) => sum + (parseFloat(item.faturamento_entrada) || 0), 0)
        const faturamentoBar = (eventosData || []).reduce((sum, item) => sum + (parseFloat(item.faturamento_bar) || 0), 0)
        const clientesAtendidos = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.cl_real) || 0), 0)
        const ticketMedio = clientesAtendidos > 0 ? faturamentoTotal / clientesAtendidos : 0
        const tmEntrada = clientesAtendidos > 0 ? faturamentoEntrada / clientesAtendidos : 0
        const tmBar = clientesAtendidos > 0 ? faturamentoBar / clientesAtendidos : 0
        const metaSemanal = (eventosData || []).reduce((sum, item) => sum + (parseFloat(item.m1_r) || 0), 0)
        const reservasTotais = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.res_tot) || 0), 0)
        const reservasPresentes = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.res_p) || 0), 0)
        const mesasTotais = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.num_mesas_tot) || 0), 0)
        const mesasPresentes = (eventosData || []).reduce((sum, item) => sum + (parseInt(item.num_mesas_presentes) || 0), 0)
        const custoAtracao = (eventosData || []).reduce((sum, item) => sum + (parseFloat(item.c_art) || 0), 0)
        const custoAtracaoFaturamento = faturamentoTotal > 0 ? (custoAtracao / faturamentoTotal) * 100 : 0
        
        console.log(`💰 Faturamento Total (real_r): R$ ${faturamentoTotal.toFixed(2)} (${eventosData?.length || 0} dias)`)

        // Stockout semanal centralizado por categoria_mix (sem hardcoded de loc_desc)
        const { data: stockoutSemanalData, error: stockoutSemanalError } = await supabase
          .from('contahub_stockout')
          .select('categoria_mix, prd_venda')
          .eq('bar_id', barId)
          .gte('data_consulta', startDate)
          .lte('data_consulta', endDate)
          .eq('prd_ativo', 'S')
          .in('categoria_mix', ['BEBIDA', 'DRINK', 'COMIDA'])

        if (stockoutSemanalError) {
          throw stockoutSemanalError
        }

        const totalBebidas = (stockoutSemanalData || []).filter(item => item.categoria_mix === 'BEBIDA').length
        const stockoutBebidasCount = (stockoutSemanalData || []).filter(item => item.categoria_mix === 'BEBIDA' && item.prd_venda === 'N').length
        const stockoutBebidasPerc = totalBebidas > 0 ? (stockoutBebidasCount / totalBebidas) * 100 : 0

        const totalDrinks = (stockoutSemanalData || []).filter(item => item.categoria_mix === 'DRINK').length
        const stockoutDrinksCount = (stockoutSemanalData || []).filter(item => item.categoria_mix === 'DRINK' && item.prd_venda === 'N').length
        const stockoutDrinksPerc = totalDrinks > 0 ? (stockoutDrinksCount / totalDrinks) * 100 : 0

        const totalComidas = (stockoutSemanalData || []).filter(item => item.categoria_mix === 'COMIDA').length
        const stockoutComidasCount = (stockoutSemanalData || []).filter(item => item.categoria_mix === 'COMIDA' && item.prd_venda === 'N').length
        const stockoutComidasPerc = totalComidas > 0 ? (stockoutComidasCount / totalComidas) * 100 : 0

        console.log(`🍺 Bebidas: ${stockoutBebidasCount}/${totalBebidas} = ${stockoutBebidasPerc.toFixed(2)}%`)
        console.log(`🍹 Drinks: ${stockoutDrinksCount}/${totalDrinks} = ${stockoutDrinksPerc.toFixed(2)}%`)
        console.log(`🍽️ Comidas: ${stockoutComidasCount}/${totalComidas} = ${stockoutComidasPerc.toFixed(2)}%`)
        console.log(`👥 Clientes: ${clientesAtendidos}`)
        console.log(`🎫 Ticket Médio: R$ ${ticketMedio.toFixed(2)}`)

        // Mix semanal canônico por categoria_mix (não usa ponderação por real_r para evitar influência Yuzer/Sympla)
        const { data: mixRows } = await supabase
          .from('contahub_analitico')
          .select('valorfinal, categoria_mix, grp_desc')
          .eq('bar_id', barId)
          .gte('trn_dtgerencial', startDate)
          .lte('trn_dtgerencial', endDate)
          .in('tipo', ['venda integral', 'com desconto', '100% desconto'])
          // Regra canônica: semanas de Carnaval não entram no mix semanal
          .neq('trn_dtgerencial', '2026-02-13')
          .neq('trn_dtgerencial', '2026-02-14')
          .neq('trn_dtgerencial', '2026-02-15')
          .neq('trn_dtgerencial', '2026-02-16')
          .neq('trn_dtgerencial', '2026-02-17')
          .not('categoria_mix', 'is', null)

        let percBebidasPonderado = 0
        let percDrinksPonderado = 0
        let percComidaPonderado = 0
        let percHappyHourPonderado = 0

        if (mixRows && mixRows.length > 0) {
          const totalVendas = mixRows.reduce((sum, row) => sum + (parseFloat(row.valorfinal) || 0), 0)
          if (totalVendas > 0) {
            const bebidas = mixRows.reduce((sum, row) => sum + (row.categoria_mix === 'BEBIDA' ? (parseFloat(row.valorfinal) || 0) : 0), 0)
            const drinks = mixRows.reduce((sum, row) => sum + (row.categoria_mix === 'DRINK' ? (parseFloat(row.valorfinal) || 0) : 0), 0)
            const comidas = mixRows.reduce((sum, row) => sum + (row.categoria_mix === 'COMIDA' ? (parseFloat(row.valorfinal) || 0) : 0), 0)
            const happyHour = mixRows.reduce((sum, row) => sum + (row.grp_desc === 'Happy Hour' ? (parseFloat(row.valorfinal) || 0) : 0), 0)

            percBebidasPonderado = (bebidas / totalVendas) * 100
            percDrinksPonderado = (drinks / totalVendas) * 100
            percComidaPonderado = (comidas / totalVendas) * 100
            percHappyHourPonderado = (happyHour / totalVendas) * 100
          }
        }

        console.log(`🍺 Mix Semanal - Bebidas: ${percBebidasPonderado.toFixed(1)}%, Drinks: ${percDrinksPonderado.toFixed(1)}%, Comida: ${percComidaPonderado.toFixed(1)}%, Happy Hour: ${percHappyHourPonderado.toFixed(1)}%`)

        // Tempos/atrasos por semana (gravar tempos em minutos para a UI)
        const { data: tempoRows } = await supabase
          .from('contahub_tempo')
          .select('loc_desc, t0_t2, t0_t3')
          .eq('bar_id', barId)
          .gte('data', startDate)
          .lte('data', endDate)

        const barLocsOrdinario = ['Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos']
        const barLocsDeboche = ['Bar', 'Salao']
        const cozinhaLocs = ['Cozinha', 'Cozinha 1', 'Cozinha 2']

        const temposBarSeg: number[] = []
        const temposCozinhaSeg: number[] = []

        for (const row of tempoRows || []) {
          const loc = row.loc_desc || ''
          if (barId === 3 && barLocsOrdinario.includes(loc)) {
            const t = parseFloat(row.t0_t3)
            if (!Number.isNaN(t) && t > 0) temposBarSeg.push(t)
          } else if (barId === 4 && barLocsDeboche.includes(loc)) {
            const t = parseFloat(row.t0_t2)
            if (!Number.isNaN(t) && t > 0) temposBarSeg.push(t)
          }

          if (cozinhaLocs.includes(loc)) {
            const t = parseFloat(row.t0_t2)
            if (!Number.isNaN(t) && t > 0) temposCozinhaSeg.push(t)
          }
        }

        const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
        const tempoSaidaBar = avg(temposBarSeg) / 60
        const tempoSaidaCozinha = avg(temposCozinhaSeg) / 60

        const qtdeItensBar = temposBarSeg.length
        const qtdeItensCozinha = temposCozinhaSeg.length
        const atrasinhosBar = temposBarSeg.filter(t => t > 300 && t <= 600).length
        const atrasoBar = temposBarSeg.filter(t => t > 600 && t <= 1200).length
        const atrasosBar = temposBarSeg.filter(t => t > 1200).length
        const atrasinhosCozinha = temposCozinhaSeg.filter(t => t > 900 && t <= 1200).length
        const atrasoCozinha = temposCozinhaSeg.filter(t => t > 1200 && t <= 1800).length
        const atrasosCozinha = temposCozinhaSeg.filter(t => t > 1800).length
        const atrasosBarPerc = qtdeItensBar > 0 ? (atrasosBar / qtdeItensBar) * 100 : 0
        const atrasosCozinhaPerc = qtdeItensCozinha > 0 ? (atrasosCozinha / qtdeItensCozinha) * 100 : 0

        // Google Reviews semanal
        const { data: googleRows } = await supabase
          .from('google_reviews')
          .select('stars')
          .eq('bar_id', barId)
          .gte('published_at_date', startDate)
          .lte('published_at_date', endDate)

        const avaliacoes5 = (googleRows || []).filter(g => Number(g.stars) === 5).length
        const mediaGoogle = (googleRows && googleRows.length > 0)
          ? googleRows.reduce((sum, g) => sum + (Number(g.stars) || 0), 0) / googleRows.length
          : 0

        // NPS semanal (fonte canônica: nps_agregado_semanal)
        const { data: npsAgregado, error: npsError } = await supabase
          .from('nps_agregado_semanal')
          .select('nps_geral, nps_reservas')
          .eq('bar_id', barId)
          .eq('ano', String(semana.ano || new Date(startDate).getFullYear()))
          .eq('numero_semana', semana.numero_semana)
          .maybeSingle()

        if (npsError) {
          throw npsError
        }

        const npsGeral = npsAgregado?.nps_geral ?? null
        const npsReservas = npsAgregado?.nps_reservas ?? null

        console.log(`🎫 Mesas: ${mesasTotais}/${mesasPresentes} | Pessoas: ${reservasTotais}/${reservasPresentes}`)

        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('desempenho_semanal')
          .update({
            faturamento_total: faturamentoTotal,
            faturamento_entrada: faturamentoEntrada,
            faturamento_bar: faturamentoBar,
            clientes_atendidos: clientesAtendidos,
            ticket_medio: ticketMedio,
            tm_entrada: tmEntrada,
            tm_bar: tmBar,
            meta_semanal: metaSemanal,
            mesas_totais: mesasTotais,
            mesas_presentes: mesasPresentes,
            reservas_totais: reservasTotais,
            reservas_presentes: reservasPresentes,
            custo_atracao_faturamento: custoAtracaoFaturamento,
            stockout_bar: stockoutBebidasCount,
            stockout_bar_perc: stockoutBebidasPerc,
            stockout_drinks: stockoutDrinksCount,
            stockout_drinks_perc: stockoutDrinksPerc,
            stockout_comidas: stockoutComidasCount,
            stockout_comidas_perc: stockoutComidasPerc,
            perc_bebidas: percBebidasPonderado,
            perc_drinks: percDrinksPonderado,
            perc_comida: percComidaPonderado,
            perc_happy_hour: percHappyHourPonderado,
            tempo_saida_bar: tempoSaidaBar,
            tempo_saida_cozinha: tempoSaidaCozinha,
            qtde_itens_bar: qtdeItensBar,
            qtde_itens_cozinha: qtdeItensCozinha,
            atrasinhos_bar: atrasinhosBar,
            atrasinhos_cozinha: atrasinhosCozinha,
            atraso_bar: atrasoBar,
            atraso_cozinha: atrasoCozinha,
            atrasos_bar: atrasosBar,
            atrasos_cozinha: atrasosCozinha,
            atrasos_bar_perc: atrasosBarPerc,
            atrasos_cozinha_perc: atrasosCozinhaPerc,
            avaliacoes_5_google_trip: avaliacoes5,
            media_avaliacoes_google: mediaGoogle,
            nps_geral: npsGeral,
            nps_reservas: npsReservas,
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
