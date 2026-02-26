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
  
  // Tempos e performance
  t_coz: number;
  t_bar: number;
  fat_19h: number;
  
  // Stockout
  percent_stockout: number;
  
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
        percent_stockout,
        t_coz,
        t_bar,
        fat_19h_percent,
        sympla_liquido,
        sympla_checkins,
        yuzer_liquido,
        yuzer_ingressos,
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

    const eventosFiltrados = eventos || [];

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
      const tCozGreen = (evento.t_coz || 0) <= 12;
      const tBarGreen = (evento.t_bar || 0) <= 4;
      const fat19hGreen = (evento.fat_19h_percent || 0) >= 40;

      // NOTE: Removed N+1 RPC calls for clientes_ativos and percent_clientes_novos 
      // as they were causing 10s+ load times and are not currently used in the Planning UI.
      const percClientesNovos: number | null = null;
      const clientesAtivos: number | null = null;
      
      const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');

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
        
        t_coz: evento.t_coz || 0,
        t_bar: evento.t_bar || 0,
        fat_19h: evento.fat_19h_percent || 0,
        
        percent_stockout: evento.percent_stockout || 0,
        
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
