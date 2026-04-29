import { SupabaseClient } from '@supabase/supabase-js';

const DIAS_SEMANA = [
  'DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA',
  'QUINTA', 'SEXTA', 'SÁBADO'
];

/**
 * Metas / thresholds vindos de operations.config_metas_planejamento.
 * Substituem os números hardcoded que estavam neste service (linhas 198–202)
 * e em PlanejamentoClient.tsx (linhas 990, 1045, 1053, 1061, 1069).
 * Ver docs/planning/06-auditoria-planejamento.md.
 */
export interface MetasPlanejamento {
  t_medio_meta: number;
  percent_art_fat_meta: number;
  t_coz_meta: number;
  t_bar_meta: number;
  fat_19h_meta: number;
  couvert_c_art_ratio_meta: number;
  atrasao_cozinha_meta: number;
  atrasao_bar_meta: number;
  stockout_drinks_green: number;
  stockout_drinks_yellow: number;
  stockout_comidas_green: number;
  stockout_comidas_yellow: number;
}

/**
 * Fallback defensivo — usado APENAS quando a row da config ainda não existe
 * (ex: migração 2026-04-23-config-metas-planejamento.sql não rodou no ambiente).
 * Emite console.warn para que o gap fique visível em observabilidade.
 * Remover após 2 sprints de migração em produção.
 */
const METAS_FALLBACK: MetasPlanejamento = {
  t_medio_meta: 93,
  percent_art_fat_meta: 15,
  t_coz_meta: 720,
  t_bar_meta: 240,
  fat_19h_meta: 40,
  couvert_c_art_ratio_meta: 1.0,
  atrasao_cozinha_meta: 10,
  atrasao_bar_meta: 50,
  stockout_drinks_green: 10,
  stockout_drinks_yellow: 25,
  stockout_comidas_green: 10,
  stockout_comidas_yellow: 25,
};

export type StockoutStatus = 'green' | 'yellow' | 'red';

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
  /** Soma de vr_couvert no bronze_contahub_vendas_periodo (fonte correta para $ Couvert na tela) */
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

  // Flags vindas da config (Etapa 6 — ver docs/planning/06-auditoria-planejamento.md)
  /** Couvert >= ratio * c_art (usado apenas no Deboche, bar_id=4) */
  couvert_c_art_green: boolean;
  atrasao_cozinha_green: boolean;
  atrasao_bar_green: boolean;
  stockout_drinks_status: StockoutStatus;
  stockout_comidas_status: StockoutStatus;
}

export async function getPlanejamentoComercial(
  supabase: SupabaseClient,
  barId: number,
  mes: number,
  ano: number
): Promise<PlanejamentoData[]> {
  // NOTA: removido try/catch externo que mascarava erros como [].
  // Erros agora propagam para o error boundary (error.tsx), assim falhas
  // de schema/conexão ficam visíveis em vez de virarem "Nenhum evento encontrado".
  interface YuzerPagamentoResumo {
    data_evento: string;
    total_descontos: number | null;
  }

  // Calcular período
  const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
  const dataFinalConsulta =
    mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${(mes + 1).toString().padStart(2, '0')}-01`;

  // REFACTOR 2026-04-20: Migrado para gold.planejamento
  // Gold ja tem consolidacao de ContaHub + Yuzer + Sympla, eliminando
  // bug de double-counting (L268 subtraia quando real_r ja era consolidado)
  // REFACTOR 2026-04-23 (Etapa 6): lê também operations.config_metas_planejamento
  // para eliminar thresholds hardcoded. Ver docs/planning/06-auditoria-planejamento.md
  const [{ data: eventosGold, error }, { data: eventosManuais }, { data: configMetas }] = await Promise.all([
    supabase
      .schema('gold' as never)
      .from('planejamento')
      .select(`
        id, data_evento, nome, dia_semana, bar_id,
        m1_r, cl_plan, te_plan, tb_plan, c_artistico_plan, lot_max,
        real_r, faturamento_total_consolidado, cl_real, publico_real_consolidado,
        te_real_calculado, tb_real_calculado, t_medio, percent_art_fat,
        percent_b, percent_d, percent_c, percent_happy_hour,
        percent_stockout, stockout_drinks_perc, stockout_comidas_perc,
        faturamento_couvert, couvert_vr_contahub,
        t_coz, t_bar, atrasinho_cozinha, atrasinho_bar, atrasao_cozinha, atrasao_bar,
        fat_19h_percent, sympla_liquido, sympla_checkins,
        yuzer_liquido, yuzer_ingressos, yuzer_pedidos,
        conta_assinada, faturamento_entrada_yuzer, faturamento_bar_yuzer,
        res_tot, res_p, cl_com_telefone, pct_cadastro_telefone
      `)
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lt('data_evento', dataFinalConsulta)
      .eq('ativo', true)
      .order('data_evento', { ascending: true }),

    // LEFT JOIN eventos_base SOMENTE para campos manuais editaveis
    supabase
      .schema('operations' as never)
      .from('eventos_base')
      .select('data_evento, observacoes, c_art, c_prod, faturamento_couvert_manual, faturamento_bar_manual, precisa_recalculo, versao_calculo')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lt('data_evento', dataFinalConsulta),

    // Config de thresholds por (bar, ano) — fallback defensivo se row não existir
    supabase
      .schema('operations' as never)
      .from('config_metas_planejamento')
      .select('t_medio_meta, percent_art_fat_meta, t_coz_meta, t_bar_meta, fat_19h_meta, couvert_c_art_ratio_meta, atrasao_cozinha_meta, atrasao_bar_meta, stockout_drinks_green, stockout_drinks_yellow, stockout_comidas_green, stockout_comidas_yellow')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .maybeSingle()
  ]);

  // Resolve metas — usa fallback SOMENTE quando config não existe ainda (migration pendente)
  const metas: MetasPlanejamento = (configMetas as MetasPlanejamento | null) ?? (() => {
    console.warn(
      '[planejamento-service] config_metas_planejamento ausente para bar_id=%s ano=%s. Usando fallback. Rode a migration 2026-04-23-config-metas-planejamento.sql.',
      barId,
      ano
    );
    return METAS_FALLBACK;
  })();

  if (error) {
    console.error('❌ Erro ao buscar Gold planejamento:', {
      message: error.message,
      code: error.code,
      barId,
      mes,
      ano,
    });
    throw new Error(`Erro ao carregar planejamento comercial: ${error.message}`);
  }

  // Merge campos manuais de eventos_base
  const manuaisMap = new Map(
    (eventosManuais || []).map((m: any) => [m.data_evento, m])
  );

  const eventosFiltrados = (eventosGold || []).filter(evento => {
    const [anoEvento, mesEvento] = evento.data_evento.split('-').map(Number);
    return mesEvento === mes && anoEvento === ano;
  });

  // Trigger recalculo (checando eventos_base para flag precisa_recalculo)
  const eventosParaRecalcular = eventosFiltrados.filter((e: any) => {
    const manual = manuaisMap.get(e.data_evento);
    return manual?.precisa_recalculo && manual?.versao_calculo !== 999 && (e.real_r === 0 || e.real_r === null);
  });

  if (eventosParaRecalcular.length > 0) {
    Promise.all(
      eventosParaRecalcular.map((evento: any) =>
        supabase.rpc('calculate_evento_metrics', { evento_id: evento.id })
      )
    ).catch(err => console.error('Erro no recalculo background:', err));
  }

  // Processar dados (uso direto da Gold, sem calculos JS)
  const dadosProcessados = eventosFiltrados.map((evento: any) => {
    const manual = manuaisMap.get(evento.data_evento);
    
    // Flags de performance (mantidas no service, sao apresentacao)
    const realVsM1Green = (evento.faturamento_total_consolidado || 0) >= (evento.m1_r || 0);
    const ciRealVsPlanGreen = (evento.publico_real_consolidado || 0) >= (evento.cl_plan || 0);
    const teRealVsPlanGreen = (evento.te_real_calculado || 0) >= (evento.te_plan || 0);
    const tbRealVsPlanGreen = (evento.tb_real_calculado || 0) >= (evento.tb_plan || 0);
    // Etapa 6: thresholds vêm de metas (config_metas_planejamento), não mais hardcoded
    const tMedioGreen = (evento.t_medio || 0) >= metas.t_medio_meta;
    const percentArtFatGreen = (evento.percent_art_fat || 0) <= metas.percent_art_fat_meta;
    const tCozGreen = (evento.t_coz || 0) <= metas.t_coz_meta;
    const tBarGreen = (evento.t_bar || 0) <= metas.t_bar_meta;
    const fat19hGreen = (evento.fat_19h_percent || 0) >= metas.fat_19h_meta;

    // Flags extras migradas de PlanejamentoClient.tsx (Etapa 6)
    const cArt = Number(manual?.c_art) || 0;
    const couvertContahub = evento.couvert_vr_contahub !== null && evento.couvert_vr_contahub !== undefined
      ? Number(evento.couvert_vr_contahub)
      : 0;
    // c_art / couvert <= 1.0 = green (couvert cobre o custo artistico)
    const couvertCArtGreen = cArt > 0 && couvertContahub > 0
      && (cArt / couvertContahub) <= metas.couvert_c_art_ratio_meta;

    const atrasaoCozinhaGreen = (evento.atrasao_cozinha || 0) <= metas.atrasao_cozinha_meta;
    const atrasaoBarGreen = (evento.atrasao_bar || 0) <= metas.atrasao_bar_meta;

    const stockoutDrinksPerc = evento.stockout_drinks_perc || 0;
    const stockoutDrinksStatus: StockoutStatus =
      stockoutDrinksPerc <= metas.stockout_drinks_green ? 'green'
      : stockoutDrinksPerc <= metas.stockout_drinks_yellow ? 'yellow'
      : 'red';

    const stockoutComidasPerc = evento.stockout_comidas_perc || 0;
    const stockoutComidasStatus: StockoutStatus =
      stockoutComidasPerc <= metas.stockout_comidas_green ? 'green'
      : stockoutComidasPerc <= metas.stockout_comidas_yellow ? 'yellow'
      : 'red';

    const percClientesNovos: number | null = null;
    const clientesAtivos: number | null = null;

    const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');
    
    // Gold ja tem faturamento_total_consolidado (ContaHub + Yuzer + Sympla)
    // real_r na Gold = ContaHub puro (nao mais consolidado)
    const valorContahubLiquido = Number(evento.real_r || 0);
    const valorContahubBruto = valorContahubLiquido + Number(evento.conta_assinada || 0);

    return {
      evento_id: evento.id,
      data_evento: evento.data_evento,
      dia_semana: typeof evento.dia_semana === 'number' 
        ? DIAS_SEMANA[evento.dia_semana] 
        : String(evento.dia_semana || ''),
      evento_nome: evento.nome || '',
      dia: dataEvento.getUTCDate(),
      mes: dataEvento.getUTCMonth() + 1,
      ano: dataEvento.getUTCFullYear(),
      dia_formatado: dataEvento.getUTCDate().toString().padStart(2, '0'),
      data_curta: `${dataEvento.getUTCDate().toString().padStart(2, '0')}/${(dataEvento.getUTCMonth() + 1).toString().padStart(2, '0')}`,

      real_receita: evento.faturamento_total_consolidado || 0,
      m1_receita: evento.m1_r || 0,
      contahub_bruto: valorContahubBruto,
      conta_assinada: Number(evento.conta_assinada || 0),
      contahub_liquido: valorContahubLiquido,
      yuzer_entrada: Number(evento.faturamento_entrada_yuzer || 0),
      yuzer_bar: Number(evento.faturamento_bar_yuzer || 0),
      yuzer_descontos: 0,
      yuzer_liquido: Number(evento.yuzer_liquido || 0),
      sympla_liquido: Number(evento.sympla_liquido || 0),
      faturamento_total_detalhado: evento.faturamento_total_consolidado || 0,

      clientes_plan: evento.cl_plan || 0,
      clientes_real: evento.publico_real_consolidado || 0,
      res_tot: evento.res_tot || 0,
      res_p: evento.res_p || 0,
      lot_max: evento.lot_max || 0,

      te_plan: evento.te_plan || 0,
      te_real: evento.te_real_calculado || 0,
      tb_plan: evento.tb_plan || 0,
      tb_real: evento.tb_real_calculado || 0,
      t_medio: evento.t_medio || 0,

      c_art: Number(manual?.c_art) || 0,
      c_prod: Number(manual?.c_prod) || 0,
      percent_art_fat: Number(evento.percent_art_fat) || 0,

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

      faturamento_couvert_manual: manual?.faturamento_couvert_manual,
      faturamento_bar_manual: manual?.faturamento_bar_manual,

      real_vs_m1_green: realVsM1Green,
      ci_real_vs_plan_green: ciRealVsPlanGreen,
      te_real_vs_plan_green: teRealVsPlanGreen,
      tb_real_vs_plan_green: tbRealVsPlanGreen,
      t_medio_green: tMedioGreen,
      percent_art_fat_green: percentArtFatGreen,
      t_coz_green: tCozGreen,
      t_bar_green: tBarGreen,
      fat_19h_green: fat19hGreen,

      // Flags vindas de operations.config_metas_planejamento (Etapa 6)
      couvert_c_art_green: couvertCArtGreen,
      atrasao_cozinha_green: atrasaoCozinhaGreen,
      atrasao_bar_green: atrasaoBarGreen,
      stockout_drinks_status: stockoutDrinksStatus,
      stockout_comidas_status: stockoutComidasStatus,
    };
  });

  return dadosProcessados;
}
