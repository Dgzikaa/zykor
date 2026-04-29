-- 2026-04-29: Fix etl_gold_planejamento_full
--
-- Bugs reportados pelo socio na /planejamento-comercial:
-- 1. "Ticket Entrada (real) ta o total" → te_real_calculado pegava
--    silver.vendas_diarias.ticket_medio_pessoas_r, que é fat_total/pessoas
--    (= ticket TOTAL por pessoa). O nome confundia com "ticket entrada"
--    (couvert/pessoa). Ord 17/04 mostrava 102.79 quando o real era 23.14.
-- 2. "Entrada Real, Bar Real, Ticket Médio não batem" → consequência do
--    mesmo bug. te_real + tb_real ≠ t_medio porque cada um pegava de
--    fonte diferente do silver.
-- 3. "Artistico e Producao nao buscou das ultimas semanas" → c_art,
--    c_prod, percent_art_fat existiam como colunas mas o ETL nunca
--    populava (não estavam no INSERT/ON CONFLICT). Ficava sempre NULL
--    no gold. Frontend mostrava 0/N/A.
--
-- Fix: adiciona JOIN com operations.eventos_base que já tem te_real,
-- tb_real, t_medio, c_art, c_prod, percent_art_fat calculados pela
-- public.calculate_evento_metrics. Single source of truth.
--
-- Pós-deploy: rodar etl_gold_planejamento_full pros 60 dias x 2 bares
-- e calculate_evento_metrics em loop pros eventos com c_art zerado
-- (depois que sync ContaAzul popular os lançamentos restantes).
--
-- versao_etl bump 4 → 5.

CREATE OR REPLACE FUNCTION public.etl_gold_planejamento_full(p_bar_id integer, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
 RETURNS TABLE(dias_processados integer, dias_inseridos integer, dias_atualizados integer, duracao_ms integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gold', 'silver', 'operations'
AS $function$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_processados integer := 0;
BEGIN
  IF p_bar_id IS NULL THEN
    RAISE EXCEPTION 'p_bar_id obrigatorio';
  END IF;

  WITH serie AS (
    SELECT generate_series(
      COALESCE(p_data_inicio, CURRENT_DATE - 30),
      COALESCE(p_data_fim, CURRENT_DATE),
      '1 day'::interval)::date AS data_evento
  ),
  fase_a AS (
    SELECT
      s.data_evento,
      EXTRACT(DOW FROM s.data_evento)::smallint AS dow,
      EXTRACT(WEEK FROM s.data_evento)::smallint AS sem,
      COALESCE(vd.faturamento_liquido_r, 0)::numeric(14,2) AS real_r,
      COALESCE(vd.total_pessoas, 0)::integer AS pub,
      COALESCE(vd.total_descontos_r, 0)::numeric(14,2) AS desc,
      COALESCE(vd.conta_assinada_r, 0)::numeric(14,2) AS assn,
      COALESCE(vd.total_couvert_r, 0)::numeric(14,2) AS couv
    FROM serie s
    LEFT JOIN silver.vendas_diarias vd
      ON vd.bar_id=p_bar_id AND vd.dt_gerencial=s.data_evento
  ),
  fase_a2 AS (
    SELECT
      s.data_evento,
      COUNT(DISTINCT cv.vd)::integer AS res,
      COUNT(DISTINCT cv.cliente_fone_norm) FILTER (WHERE cv.tem_telefone=true)::integer AS cl_tel,
      AVG(cv.tempo_estadia_minutos) FILTER (WHERE cv.tem_estadia_calculada)::numeric(8,2) AS tmed
    FROM serie s
    LEFT JOIN silver.cliente_visitas cv
      ON cv.bar_id=p_bar_id AND cv.data_visita=s.data_evento
    GROUP BY s.data_evento
  ),
  fase_b1 AS (
    SELECT
      s.data_evento,
      COALESCE(sb.valor_liquido, 0)::numeric(14,2) AS sy_liq,
      COALESCE(sb.participantes_com_checkin, 0)::integer AS sy_chk
    FROM serie s
    LEFT JOIN silver.sympla_bilheteria_diaria sb
      ON sb.bar_id=p_bar_id AND sb.data_evento=s.data_evento
  ),
  fase_b2 AS (
    SELECT
      s.data_evento,
      COALESCE(SUM(y.valor_liquido), 0)::numeric(14,2) AS yz_liq,
      COALESCE(SUM(y.count_pedidos), 0)::integer AS yz_ped,
      COALESCE(SUM(y.faturamento_bruto), 0)::numeric(14,2) AS yz_br
    FROM serie s
    LEFT JOIN silver.yuzer_pagamentos_evento y
      ON y.bar_id=p_bar_id AND y.data_evento=s.data_evento
    GROUP BY s.data_evento
  ),
  fase_b3 AS (
    SELECT
      s.data_evento,
      COALESCE(SUM(yp.quantidade) FILTER (WHERE yp.eh_ingresso=true), 0)::integer AS yz_ingr
    FROM serie s
    LEFT JOIN silver.yuzer_produtos_evento yp
      ON yp.bar_id=p_bar_id AND yp.data_evento=s.data_evento
    GROUP BY s.data_evento
  ),
  fase_fat_hora AS (
    SELECT
      vd_dtgerencial AS data_evento,
      SUM(valor)::numeric(14,2) AS fat_total,
      SUM(valor) FILTER (WHERE hora IN ('16:00', '17:00', '18:00'))::numeric(14,2) AS fat_ate_19h,
      SUM(valor) FILTER (WHERE hora IN ('22:00', '23:00', '24:00', '25:00', '26:00', '27:00', '28:00'))::numeric(14,2) AS fat_apos_22h
    FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
    WHERE bar_id = p_bar_id
      AND vd_dtgerencial BETWEEN COALESCE(p_data_inicio, CURRENT_DATE - 30)
                            AND COALESCE(p_data_fim, CURRENT_DATE)
    GROUP BY vd_dtgerencial
  ),
  fase_c_meta AS (
    SELECT
      s.data_evento,
      e.nome,
      e.artista,
      e.genero,
      e.ativo,
      e.m1_r,
      e.cl_plan,
      e.res_p,
      e.lot_max,
      e.te_plan,
      e.tb_plan,
      e.c_artistico_plan
    FROM serie s
    LEFT JOIN operations.eventos e
      ON e.bar_id=p_bar_id AND e.data_evento=s.data_evento
  ),
  -- FIX 2026-04-29: pega te_real, tb_real, t_medio, c_art, c_prod
  -- diretamente de operations.eventos_base (calculate_evento_metrics).
  fase_eb AS (
    SELECT
      s.data_evento,
      COALESCE(eb.te_real, 0)::numeric(10,2) AS eb_te_real,
      COALESCE(eb.tb_real, 0)::numeric(10,2) AS eb_tb_real,
      COALESCE(eb.t_medio, 0)::numeric(10,2) AS eb_t_medio,
      COALESCE(eb.c_art, 0)::numeric(14,2) AS eb_c_art,
      COALESCE(eb.c_prod, 0)::numeric(14,2) AS eb_c_prod,
      COALESCE(eb.percent_art_fat, 0)::numeric(6,2) AS eb_pct_art_fat,
      eb.cl_real AS eb_cl_real,
      eb.real_r AS eb_real_r
    FROM serie s
    LEFT JOIN operations.eventos_base eb
      ON eb.bar_id=p_bar_id AND eb.data_evento=s.data_evento AND eb.ativo=true
  )
  INSERT INTO gold.planejamento (
    bar_id, data_evento, dia_semana, semana,
    nome, artista, genero, ativo,
    m1_r, cl_plan, res_p, lot_max, te_plan, tb_plan, c_artistico_plan,
    real_r, faturamento_liquido, faturamento_couvert,
    te_real_calculado, tb_real_calculado, t_medio,
    c_art, c_prod, percent_art_fat,
    cl_real, cl_com_telefone, pct_cadastro_telefone,
    res_tot, publico_real,
    descontos, conta_assinada,
    sympla_liquido, sympla_checkins,
    yuzer_liquido, yuzer_ingressos, yuzer_pedidos, faturamento_entrada_yuzer,
    faturamento_total_consolidado, publico_real_consolidado,
    fat_19h, fat_19h_percent,
    fat_apos_22h, fat_apos_22h_percent,
    calculado_em, versao_etl
  )
  SELECT
    p_bar_id,
    v.data_evento, v.dow, v.sem,
    m.nome, m.artista, m.genero, COALESCE(m.ativo, true),
    m.m1_r, m.cl_plan, m.res_p, m.lot_max, m.te_plan, m.tb_plan, m.c_artistico_plan,
    v.real_r, v.real_r, v.couv,
    -- FIX: pega de eventos_base (calculado por calculate_evento_metrics)
    eb.eb_te_real, eb.eb_tb_real, eb.eb_t_medio,
    eb.eb_c_art, eb.eb_c_prod, eb.eb_pct_art_fat,
    v.pub, COALESCE(c.cl_tel, 0),
    CASE WHEN v.pub > 0 THEN (c.cl_tel::numeric / v.pub * 100)::numeric(5,2) END,
    COALESCE(c.res,0), v.pub,
    v.desc, v.assn,
    b1.sy_liq, b1.sy_chk,
    b2.yz_liq, COALESCE(b3.yz_ingr, 0), COALESCE(b2.yz_ped, 0), b2.yz_br,
    (v.real_r + COALESCE(b2.yz_liq, 0) + COALESCE(b1.sy_liq, 0))::numeric(14,2),
    (v.pub + COALESCE(b3.yz_ingr, 0) + COALESCE(b1.sy_chk, 0))::integer,
    fh.fat_ate_19h,
    CASE WHEN fh.fat_total > 0 THEN (fh.fat_ate_19h / fh.fat_total * 100)::numeric(5,2) ELSE NULL END,
    fh.fat_apos_22h,
    CASE WHEN fh.fat_total > 0 THEN (fh.fat_apos_22h / fh.fat_total * 100)::numeric(5,2) ELSE NULL END,
    NOW(), 5
  FROM fase_a v
  LEFT JOIN fase_a2 c USING (data_evento)
  LEFT JOIN fase_b1 b1 USING (data_evento)
  LEFT JOIN fase_b2 b2 USING (data_evento)
  LEFT JOIN fase_b3 b3 USING (data_evento)
  LEFT JOIN fase_fat_hora fh USING (data_evento)
  LEFT JOIN fase_c_meta m USING (data_evento)
  LEFT JOIN fase_eb eb USING (data_evento)
  ON CONFLICT (bar_id, data_evento) DO UPDATE SET
    dia_semana=EXCLUDED.dia_semana,
    semana=EXCLUDED.semana,
    nome=EXCLUDED.nome,
    artista=EXCLUDED.artista,
    genero=EXCLUDED.genero,
    ativo=EXCLUDED.ativo,
    m1_r=EXCLUDED.m1_r,
    cl_plan=EXCLUDED.cl_plan,
    res_p=EXCLUDED.res_p,
    lot_max=EXCLUDED.lot_max,
    te_plan=EXCLUDED.te_plan,
    tb_plan=EXCLUDED.tb_plan,
    c_artistico_plan=EXCLUDED.c_artistico_plan,
    real_r=EXCLUDED.real_r,
    faturamento_liquido=EXCLUDED.faturamento_liquido,
    faturamento_couvert=EXCLUDED.faturamento_couvert,
    te_real_calculado=EXCLUDED.te_real_calculado,
    tb_real_calculado=EXCLUDED.tb_real_calculado,
    t_medio=EXCLUDED.t_medio,
    c_art=EXCLUDED.c_art,
    c_prod=EXCLUDED.c_prod,
    percent_art_fat=EXCLUDED.percent_art_fat,
    cl_real=EXCLUDED.cl_real,
    cl_com_telefone=EXCLUDED.cl_com_telefone,
    pct_cadastro_telefone=EXCLUDED.pct_cadastro_telefone,
    res_tot=EXCLUDED.res_tot,
    publico_real=EXCLUDED.publico_real,
    descontos=EXCLUDED.descontos,
    conta_assinada=EXCLUDED.conta_assinada,
    sympla_liquido=EXCLUDED.sympla_liquido,
    sympla_checkins=EXCLUDED.sympla_checkins,
    yuzer_liquido=EXCLUDED.yuzer_liquido,
    yuzer_ingressos=EXCLUDED.yuzer_ingressos,
    yuzer_pedidos=EXCLUDED.yuzer_pedidos,
    faturamento_entrada_yuzer=EXCLUDED.faturamento_entrada_yuzer,
    faturamento_total_consolidado=EXCLUDED.faturamento_total_consolidado,
    publico_real_consolidado=EXCLUDED.publico_real_consolidado,
    fat_19h=EXCLUDED.fat_19h,
    fat_19h_percent=EXCLUDED.fat_19h_percent,
    fat_apos_22h=EXCLUDED.fat_apos_22h,
    fat_apos_22h_percent=EXCLUDED.fat_apos_22h_percent,
    calculado_em=NOW(),
    versao_etl=5;

  GET DIAGNOSTICS v_processados = ROW_COUNT;

  RETURN QUERY SELECT
    v_processados, v_processados, 0,
    ((EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000))::int;
END;
$function$;
