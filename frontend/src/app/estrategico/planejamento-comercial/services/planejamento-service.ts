import { SupabaseClient } from '@supabase/supabase-js';

export interface PlanejamentoData {
  evento_id: number;
  data_evento: string;
  dia_semana: string;
  evento_nome: string;
  dia: number;
  mes: number;
  ano: number;
  dia_formatado: string;
  data_curta: string;
  
  // Dados financeiros
  real_receita: number;
  m1_receita: number;
  contahub_bruto?: number;
  conta_assinada?: number;
  contahub_liquido?: number;
  yuzer_entrada?: number;
  yuzer_bar?: number;
  yuzer_descontos?: number;
  yuzer_liquido?: number;
  sympla_liquido?: number;
  faturamento_total_detalhado?: number;
  
  // Dados de público
  clientes_plan: number;
  clientes_real: number;
  res_tot: number;
  res_p: number;
  lot_max: number;
  
  // Tickets
  te_plan: number;
  te_real: number;
  tb_plan: number;
  tb_real: number;
  t_medio: number;
  
  // Custos
  c_art: number;
  c_prod: number;
  percent_art_fat: number;
  
  // Percentuais
  percent_b: number;
  percent_d: number;
  percent_c: number;
  percent_happy_hour: number;
  
  // Tempos e performance
  t_coz: number;
  t_bar: number;
  atrasinho_cozinha: number;
  atrasinho_bar: number;
  atrasao_cozinha: number;
  atrasao_bar: number;
  fat_19h: number;
  
  // Stockout separado por área
  percent_stockout: number;
  stockout_drinks_perc: number;
  stockout_comidas_perc: number;
  
  // Couvert (gerado: te_real * cl_real) — legado / manual
  faturamento_couvert: number;
  /** Soma de vr_couvert no contahub_periodo (fonte correta para $ Couvert na tela) */
  couvert_vr_contahub?: number | null;
  
  // Segmentação de clientes
  percent_clientes_novos: number | null;
  clientes_ativos: number | null;
  
  // Campos manuais para domingos
  faturamento_couvert_manual?: number;
  faturamento_bar_manual?: number;
  
  // Flags de performance
  real_vs_m1_green: boolean;
  ci_real_vs_plan_green: boolean;
  te_real_vs_plan_green: boolean;
  tb_real_vs_plan_green: boolean;
  t_medio_green: boolean;
  percent_art_fat_green: boolean;
  t_coz_green: boolean;
  t_bar_green: boolean;
  fat_19h_green: boolean;
}

export async function getPlanejamentoComercial(
  supabase: SupabaseClient, 
  barId: number, 
  mes: number, 
  ano: number
): Promise<PlanejamentoData[]> {
  try {
    interface YuzerPagamentoResumo {
      data_evento: string;
      total_descontos: number | null;
    }

    // Calcular período
    const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
    const dataFinalConsulta = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${(mes + 1).toString().padStart(2, '0')}-01`;

    // Buscar dados APENAS da tabela eventos_base
    const { data: eventos, error } = await supabase
      .from('eventos_base')
      .select(`
        id,
        data_evento,
        nome,
        dia_semana,
        bar_id,
        m1_r,
        cl_plan,
        te_plan,
        tb_plan,
        c_artistico_plan,
        observacoes,
        real_r,
        cl_real,
        lot_max,
        te_real,
        tb_real,
        t_medio,
        c_art,
        c_prod,
        percent_art_fat,
        percent_b,
        percent_d,
        percent_c,
        percent_happy_hour,
        percent_stockout,
        stockout_drinks_perc,
        stockout_comidas_perc,
        faturamento_couvert,
        couvert_vr_contahub,
        t_coz,
        t_bar,
        atrasinho_cozinha,
        atrasinho_bar,
        atrasao_cozinha,
        atrasao_bar,
        fat_19h_percent,
        sympla_liquido,
        sympla_checkins,
        yuzer_liquido,
        yuzer_ingressos,
        conta_assinada,
        faturamento_entrada_yuzer,
        faturamento_bar_yuzer,
        res_tot,
        res_p,
        faturamento_couvert_manual,
        faturamento_bar_manual,
        calculado_em,
        precisa_recalculo,
        versao_calculo
      `)
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lt('data_evento', dataFinalConsulta)
      .eq('ativo', true)
      .order('data_evento', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar eventos:', error);
      return [];
    }

    // CRITICAL FIX: Filtrar eventos para garantir APENAS o mês/ano solicitado
    // (evitar problemas de timezone ou dados incorretos no banco)
    const eventosFiltrados = (eventos || []).filter(evento => {
      const [anoEvento, mesEvento] = evento.data_evento.split('-').map(Number);
      return mesEvento === mes && anoEvento === ano;
    });
    const datasEventos = Array.from(new Set(eventosFiltrados.map(e => e.data_evento)));

    let descontosYuzerPorData = new Map<string, number>();
    if (datasEventos.length > 0) {
      const { data: yuzerPagamentos } = await supabase
        .from('yuzer_pagamento')
        .select('data_evento,total_descontos')
        .eq('bar_id', barId)
        .in('data_evento', datasEventos);

      descontosYuzerPorData = (yuzerPagamentos || []).reduce((acc: Map<string, number>, row: YuzerPagamentoResumo) => {
        acc.set(row.data_evento, Number(row.total_descontos || 0));
        return acc;
      }, new Map<string, number>());
    }

    // Trigger recálculo (mas não bloqueante e sem log excessivo no server component)
    const eventosParaRecalcular = eventosFiltrados.filter(e => 
        e.precisa_recalculo && 
        (e.versao_calculo !== 999) && 
        (e.real_r === 0 || e.real_r === null)
    );
      
    if (eventosParaRecalcular.length > 0) {
        // Disparar recálculo em "background" (sem await)
        // Nota: Em Server Components, isso pode não terminar se o runtime morrer, 
        // mas é melhor do que bloquear o render.
        // O ideal seria usar uma Task Queue, mas aqui vamos apenas tentar.
        Promise.all(eventosParaRecalcular.map(evento => 
            supabase.rpc('calculate_evento_metrics', { evento_id: evento.id })
        )).catch(err => console.error('Erro no recálculo background:', err));
    }

    // Processar dados (Paralelo)
    const dadosProcessados = await Promise.all(eventosFiltrados.map(async (evento) => {
      // Flags de performance
      const realVsM1Green = (evento.real_r || 0) >= (evento.m1_r || 0);
      const ciRealVsPlanGreen = (evento.cl_real || 0) >= (evento.cl_plan || 0);
      const teRealVsPlanGreen = (evento.te_real || 0) >= (evento.te_plan || 0);
      const tbRealVsPlanGreen = (evento.tb_real || 0) >= (evento.tb_plan || 0);
      const tMedioGreen = (evento.t_medio || 0) >= 93;
      const percentArtFatGreen = (evento.percent_art_fat || 0) <= 15;
      // t_coz e t_bar são médias de tempo em segundos
      // Verde se média <= 12min (720s) coz, <= 4min (240s) bar
      const tCozGreen = (evento.t_coz || 0) <= 720;
      const tBarGreen = (evento.t_bar || 0) <= 240;
      const fat19hGreen = (evento.fat_19h_percent || 0) >= 40;

      // NOTE: Removed N+1 RPC calls for clientes_ativos and percent_clientes_novos 
      // as they were causing 10s+ load times and are not currently used in the Planning UI.
      const percClientesNovos: number | null = null;
      const clientesAtivos: number | null = null;
      
      const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');
      const valorYuzerLiquido = Number(evento.yuzer_liquido || 0);
      const valorSymplaLiquido = Number(evento.sympla_liquido || 0);
      const valorContaAssinada = Number(evento.conta_assinada || 0);
      const valorContahubLiquido = Number(evento.real_r || 0) - valorYuzerLiquido - valorSymplaLiquido;
      const valorContahubBruto = valorContahubLiquido + valorContaAssinada;
      const valorYuzerDescontos = descontosYuzerPorData.get(evento.data_evento) || 0;

      return {
        evento_id: evento.id,
        data_evento: evento.data_evento,
        dia_semana: evento.dia_semana || '',
        evento_nome: evento.nome || '',
        dia: dataEvento.getUTCDate(),
        mes: dataEvento.getUTCMonth() + 1,
        ano: dataEvento.getUTCFullYear(),
        dia_formatado: dataEvento.getUTCDate().toString().padStart(2, '0'),
        data_curta: `${dataEvento.getUTCDate().toString().padStart(2, '0')}/${(dataEvento.getUTCMonth() + 1).toString().padStart(2, '0')}`,

        // real_r JÁ INCLUI ContaHub + Sympla + Yuzer (calculado pela função calculate_evento_metrics)
        real_receita: evento.real_r || 0,
        m1_receita: evento.m1_r || 0,
        contahub_bruto: valorContahubBruto,
        conta_assinada: valorContaAssinada,
        contahub_liquido: valorContahubLiquido,
        yuzer_entrada: Number(evento.faturamento_entrada_yuzer || 0),
        yuzer_bar: Number(evento.faturamento_bar_yuzer || 0),
        yuzer_descontos: valorYuzerDescontos,
        yuzer_liquido: valorYuzerLiquido,
        sympla_liquido: valorSymplaLiquido,
        faturamento_total_detalhado: valorContahubLiquido + valorYuzerLiquido + valorSymplaLiquido,
        
        clientes_plan: evento.cl_plan || 0,
        clientes_real: evento.cl_real || 0,
        res_tot: evento.res_tot || 0,
        res_p: evento.res_p || 0,
        lot_max: evento.lot_max || 0,
        
        te_plan: evento.te_plan || 0,
        te_real: evento.te_real || 0,
        tb_plan: evento.tb_plan || 0,
        tb_real: evento.tb_real || 0,
        t_medio: evento.t_medio || 0,
        
        c_art: evento.c_art || 0,
        c_prod: evento.c_prod || 0,
        percent_art_fat: evento.percent_art_fat || 0,
        
        percent_b: evento.percent_b || 0,
        percent_d: evento.percent_d || 0,
        percent_c: evento.percent_c || 0,
        percent_happy_hour: evento.percent_happy_hour || 0,
        
        t_coz: evento.t_coz || 0,
        t_bar: evento.t_bar || 0,
        atrasinho_cozinha: evento.atrasinho_cozinha || 0,
        atrasinho_bar: evento.atrasinho_bar || 0,
        atrasao_cozinha: evento.atrasao_cozinha || 0,
        atrasao_bar: evento.atrasao_bar || 0,
        fat_19h: evento.fat_19h_percent || 0,
        
        percent_stockout: evento.percent_stockout || 0,
        stockout_drinks_perc: evento.stockout_drinks_perc || 0,
        stockout_comidas_perc: evento.stockout_comidas_perc || 0,
        faturamento_couvert: evento.faturamento_couvert || 0,
        couvert_vr_contahub:
          evento.couvert_vr_contahub !== null && evento.couvert_vr_contahub !== undefined
            ? Number(evento.couvert_vr_contahub)
            : null,
        
        percent_clientes_novos: percClientesNovos,
        clientes_ativos: clientesAtivos,
        
        faturamento_couvert_manual: evento.faturamento_couvert_manual,
        faturamento_bar_manual: evento.faturamento_bar_manual,
        
        real_vs_m1_green: realVsM1Green,
        ci_real_vs_plan_green: ciRealVsPlanGreen,
        te_real_vs_plan_green: teRealVsPlanGreen,
        tb_real_vs_plan_green: tbRealVsPlanGreen,
        t_medio_green: tMedioGreen,
        percent_art_fat_green: percentArtFatGreen,
        t_coz_green: tCozGreen,
        t_bar_green: tBarGreen,
        fat_19h_green: fat19hGreen
      };
    }));

    return dadosProcessados;
  } catch (error) {
    console.error('❌ Erro no serviço de planejamento:', error);
    return [];
  }
}
