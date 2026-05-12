-- Fix logica de atrasao/atrasinho por bar
-- Excel define:
--   Ordinario (bar 3):
--     - Cozinha: t0_t2 (preparo)  threshold > 1200s atrasao, 900-1200 atrasinho
--     - Drinks:  t0_t3 (entrega) threshold > 600s atrasao,  300-600 atrasinho
--   Deboche (bar 4) — nao registra t1_prodini/t2_prodfim, t0_t2 sempre 0:
--     - Cozinha: t0_t3 (entrega) threshold > 1200s atrasao, 900-1200 atrasinho
--     - Drinks:  t0_t3 (entrega) threshold > 600s atrasao,  300-600 atrasinho
--
-- Bug anterior em calculate_evento_metrics: thresholds estavam em MINUTOS
-- (> 20, > 10, > 15, > 5) sendo comparados com SEGUNDOS — pegava virtualmente tudo.

-- ============================================================================
-- 1) Atualizar calculate_evento_metrics (planejamento diario)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_evento_metrics(evento_id integer)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'operations', 'bronze', 'silver', 'integrations', 'pg_temp'
AS $function$
DECLARE
  evento_record RECORD;
  is_evento_especial BOOLEAN;
  v_contahub_liquido NUMERIC := 0;
  v_conta_assinada NUMERIC := 0;
  v_yuzer_liquido_total NUMERIC := 0;
  v_yuzer_ingressos_valor NUMERIC := 0;
  v_yuzer_ingressos_qtd INTEGER := 0;
  v_yuzer_bar_valor NUMERIC := 0;
  v_sympla_liquido NUMERIC := 0;
  v_sympla_checkins INTEGER := 0;
  contahub_per RECORD;
  contahub_fat RECORD;
  contahub_ana RECORD;
  contahub_tempo_data RECORD;
  contaazul_custos RECORD;
  getin_reservas RECORD;
  calculated_cl_real INTEGER := 0;
  calculated_real_r NUMERIC := 0;
  calculated_faturamento_entrada NUMERIC := 0;
  calculated_faturamento_bar NUMERIC := 0;
  calculated_te_real NUMERIC := 0;
  calculated_tb_real NUMERIC := 0;
  calculated_t_medio NUMERIC := 0;
  calculated_lot_max NUMERIC := 0;
  calculated_percent_b NUMERIC := 0;
  calculated_percent_c NUMERIC := 0;
  calculated_percent_d NUMERIC := 0;
  calculated_percent_happy_hour NUMERIC := 0;
  calculated_t_coz NUMERIC := 0;
  calculated_t_bar NUMERIC := 0;
  calculated_atrasinho_cozinha INTEGER := 0;
  calculated_atrasinho_bar INTEGER := 0;
  calculated_atrasao_cozinha INTEGER := 0;
  calculated_atrasao_bar INTEGER := 0;
  calculated_fat_19h NUMERIC := 0;
  calculated_fat_19h_percent NUMERIC := 0;
  calculated_fat_total_hora NUMERIC := 0;
  calculated_c_art NUMERIC := 0;
  calculated_c_prod NUMERIC := 0;
  calculated_percent_art_fat NUMERIC := 0;
  calculated_res_tot INTEGER := 0;
  calculated_res_p INTEGER := 0;
  calculated_num_mesas_tot INTEGER := 0;
  calculated_num_mesas_presentes INTEGER := 0;
  calculated_percent_stockout NUMERIC := 0;
  calculated_stockout_bebidas_perc NUMERIC := 0;
  calculated_stockout_comidas_perc NUMERIC := 0;
  calculated_stockout_drinks_perc NUMERIC := 0;
BEGIN
  SELECT * INTO evento_record FROM operations.eventos_base WHERE id = evento_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF evento_record.bar_id = 4 AND EXTRACT(dow FROM evento_record.data_evento) = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
       WHERE bar_id = evento_record.bar_id AND dt_gerencial = evento_record.data_evento LIMIT 1
    ) THEN RETURN; END IF;
  END IF;

  is_evento_especial := COALESCE(evento_record.usa_yuzer, false) OR COALESCE(evento_record.usa_sympla, false);

  SELECT COALESCE(SUM(CASE WHEN meio <> 'Conta Assinada' THEN liquido ELSE 0 END), 0)::NUMERIC,
         COALESCE(SUM(CASE WHEN meio = 'Conta Assinada' THEN valor ELSE 0 END), 0)::NUMERIC
    INTO v_contahub_liquido, v_conta_assinada
    FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
   WHERE dt_gerencial = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(CASE WHEN vd_vrpagamentos > 0 THEN vd_pessoas ELSE 0 END), 0)::INTEGER AS total_pessoas_pagantes,
         COALESCE(SUM(vd_vrcouvert), 0)::NUMERIC AS total_couvert
    INTO contahub_per
    FROM bronze.bronze_contahub_avendas_vendasperiodo
   WHERE vd_dtgerencial = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(CASE WHEN SPLIT_PART(hora, ':', 1)::int IN (16, 17, 18) THEN valor ELSE 0 END), 0)::NUMERIC AS fat_ate_19h,
         COALESCE(SUM(valor), 0)::NUMERIC AS fat_total
    INTO contahub_fat
    FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
   WHERE vd_dtgerencial = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(valor_liquido), 0)::NUMERIC INTO v_yuzer_liquido_total
    FROM integrations.yuzer_pagamento
   WHERE data_evento = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(valor_total), 0)::NUMERIC, COALESCE(SUM(quantidade), 0)::INTEGER
    INTO v_yuzer_ingressos_valor, v_yuzer_ingressos_qtd
    FROM integrations.yuzer_produtos
   WHERE data_evento = evento_record.data_evento AND bar_id = evento_record.bar_id AND LOWER(produto_nome) LIKE '%ingresso%';

  v_yuzer_bar_valor := COALESCE(v_yuzer_liquido_total, 0) - COALESCE(v_yuzer_ingressos_valor, 0);

  SELECT COALESCE(SUM(valor_liquido), 0)::NUMERIC INTO v_sympla_liquido
    FROM integrations.sympla_pedidos
   WHERE data_pedido::date = evento_record.data_evento AND bar_id = evento_record.bar_id AND status_pedido = 'APPROVED';

  SELECT COALESCE(COUNT(DISTINCT participante_sympla_id), 0)::INTEGER INTO v_sympla_checkins
    FROM integrations.sympla_participantes
   WHERE bar_id = evento_record.bar_id AND fez_checkin = true AND status_pedido = 'APPROVED' AND data_checkin::date = evento_record.data_evento;

  SELECT
    COALESCE(SUM(people), 0)::INTEGER AS total_reservas,
    COALESCE(SUM(CASE WHEN status IN ('seated', 'pending', 'confirmed') THEN people ELSE 0 END), 0)::INTEGER AS reservas_presentes,
    COALESCE(COUNT(*), 0)::INTEGER AS total_mesas,
    COALESCE(COUNT(*) FILTER (WHERE status IN ('seated', 'pending', 'confirmed')), 0)::INTEGER AS mesas_presentes
  INTO getin_reservas
  FROM bronze.bronze_getin_reservations
  WHERE reservation_date = evento_record.data_evento AND bar_id = evento_record.bar_id;

  IF evento_record.bar_id = 3 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação', 'Atrações/Eventos') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_producao
      INTO contaazul_custos FROM bronze.bronze_contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA' AND excluido_em IS NULL;
  ELSIF evento_record.bar_id = 4 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação', 'Atrações/Eventos') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico, 0::NUMERIC AS custo_producao
      INTO contaazul_custos FROM bronze.bronze_contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA' AND excluido_em IS NULL;
  ELSE
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação', 'Atrações/Eventos') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_producao
      INTO contaazul_custos FROM bronze.bronze_contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA' AND excluido_em IS NULL;
  END IF;

  IF NOT is_evento_especial THEN
    SELECT COALESCE(SUM(a.valorfinal), 0)::NUMERIC AS total_valorfinal,
           COALESCE(SUM(CASE WHEN pcm.categoria = 'BEBIDA' THEN a.valorfinal ELSE 0 END), 0)::NUMERIC AS valor_bebidas,
           COALESCE(SUM(CASE WHEN pcm.categoria = 'COMIDA' THEN a.valorfinal ELSE 0 END), 0)::NUMERIC AS valor_comidas,
           COALESCE(SUM(CASE WHEN pcm.categoria = 'DRINK' THEN a.valorfinal ELSE 0 END), 0)::NUMERIC AS valor_drinks,
           COALESCE(SUM(CASE WHEN a.grp_desc = 'Happy Hour' THEN a.valorfinal ELSE 0 END), 0)::NUMERIC AS valor_happy_hour
      INTO contahub_ana
      FROM bronze.bronze_contahub_avendas_porproduto_analitico a
      INNER JOIN operations.produto_categoria_mix pcm ON pcm.bar_id = a.bar_id AND pcm.loc_desc = a.loc_desc
     WHERE a.trn_dtgerencial = evento_record.data_evento AND a.bar_id = evento_record.bar_id AND a.tipo IN ('venda integral', 'com desconto', '100% desconto');

    IF COALESCE(contahub_ana.total_valorfinal, 0) > 0 THEN
      calculated_percent_b := (COALESCE(contahub_ana.valor_bebidas, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_c := (COALESCE(contahub_ana.valor_comidas, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_d := (COALESCE(contahub_ana.valor_drinks, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_happy_hour := (COALESCE(contahub_ana.valor_happy_hour, 0) / contahub_ana.total_valorfinal) * 100;
    END IF;

    -- FIX 2026-05-12: thresholds em SEGUNDOS e logica por bar
    -- Ordinario (3): cozinha usa t0_t2 (preparo). Deboche (4): cozinha usa t0_t3 (entrega) pois nao registra t1/t2.
    -- Drinks/bebidas usam t0_t3 (entrega) em AMBOS.
    -- Atrasao: cozinha > 1200s, bar > 600s. Atrasinho: cozinha 900-1200s, bar 300-600s.
    WITH tempo_cozinha AS (
      SELECT
        CASE WHEN evento_record.bar_id = 3 THEN t.t0_t2 ELSE t.t0_t3 END AS tempo
      FROM bronze.bronze_contahub_produtos_temposproducao t
      INNER JOIN operations.produto_categoria_mix pcm ON pcm.bar_id = t.bar_id AND pcm.loc_desc = t.loc_desc
      WHERE t.data = evento_record.data_evento AND t.bar_id = evento_record.bar_id AND pcm.categoria = 'COMIDA'
    ), tempo_bar AS (
      SELECT t.t0_t3 AS tempo
      FROM bronze.bronze_contahub_produtos_temposproducao t
      INNER JOIN operations.produto_categoria_mix pcm ON pcm.bar_id = t.bar_id AND pcm.loc_desc = t.loc_desc
      WHERE t.data = evento_record.data_evento AND t.bar_id = evento_record.bar_id
        AND pcm.categoria IN ('DRINK', 'BEBIDA')
    )
    SELECT
      (SELECT COALESCE(AVG(tempo), 0)::NUMERIC FROM tempo_cozinha WHERE tempo > 0) AS tempo_cozinha,
      (SELECT COALESCE(AVG(tempo), 0)::NUMERIC FROM tempo_bar      WHERE tempo > 0) AS tempo_bar,
      (SELECT COUNT(*)::INTEGER FROM tempo_cozinha WHERE tempo BETWEEN 900 AND 1200) AS atrasinho_cozinha,
      (SELECT COUNT(*)::INTEGER FROM tempo_bar      WHERE tempo BETWEEN 300 AND 600 ) AS atrasinho_bar,
      (SELECT COUNT(*)::INTEGER FROM tempo_cozinha WHERE tempo > 1200) AS atrasao_cozinha,
      (SELECT COUNT(*)::INTEGER FROM tempo_bar      WHERE tempo > 600 ) AS atrasao_bar
      INTO contahub_tempo_data;

    calculated_t_coz := COALESCE(contahub_tempo_data.tempo_cozinha, 0)::NUMERIC;
    calculated_t_bar := COALESCE(contahub_tempo_data.tempo_bar, 0)::NUMERIC;
    calculated_atrasinho_cozinha := COALESCE(contahub_tempo_data.atrasinho_cozinha, 0)::INTEGER;
    calculated_atrasinho_bar := COALESCE(contahub_tempo_data.atrasinho_bar, 0)::INTEGER;
    calculated_atrasao_cozinha := COALESCE(contahub_tempo_data.atrasao_cozinha, 0)::INTEGER;
    calculated_atrasao_bar := COALESCE(contahub_tempo_data.atrasao_bar, 0)::INTEGER;

    SELECT
      COALESCE(s.stockout_bar_perc, 0),
      COALESCE(s.stockout_comidas_perc, 0),
      COALESCE(s.stockout_drinks_perc, 0),
      COALESCE(s.stockout_total_perc, 0)
    INTO calculated_stockout_bebidas_perc, calculated_stockout_comidas_perc, calculated_stockout_drinks_perc, calculated_percent_stockout
    FROM silver.calcular_stockout_periodo(evento_record.bar_id, evento_record.data_evento, evento_record.data_evento) s;
  END IF;

  calculated_cl_real := COALESCE(contahub_per.total_pessoas_pagantes, 0) + COALESCE(v_yuzer_ingressos_qtd, 0) + COALESCE(v_sympla_checkins, 0);
  calculated_real_r := COALESCE(v_contahub_liquido, 0) + COALESCE(v_yuzer_liquido_total, 0) + COALESCE(v_sympla_liquido, 0);
  calculated_faturamento_entrada := COALESCE(contahub_per.total_couvert, 0) + COALESCE(v_yuzer_ingressos_valor, 0) + COALESCE(v_sympla_liquido, 0);
  calculated_faturamento_bar := (COALESCE(v_contahub_liquido, 0) - COALESCE(contahub_per.total_couvert, 0)) + COALESCE(v_yuzer_bar_valor, 0);

  IF calculated_cl_real > 0 THEN
    calculated_te_real := calculated_faturamento_entrada / calculated_cl_real::NUMERIC;
    calculated_tb_real := calculated_faturamento_bar / calculated_cl_real::NUMERIC;
  END IF;
  calculated_t_medio := calculated_te_real + calculated_tb_real;
  IF COALESCE(evento_record.cl_plan, 0) > 0 THEN calculated_lot_max := evento_record.cl_plan / 1.3; END IF;

  calculated_fat_19h := COALESCE(contahub_fat.fat_ate_19h, 0);
  calculated_fat_total_hora := COALESCE(contahub_fat.fat_total, 0);
  IF calculated_fat_total_hora > 0 THEN
    calculated_fat_19h_percent := (calculated_fat_19h / calculated_fat_total_hora) * 100;
  END IF;

  calculated_c_art := COALESCE(contaazul_custos.custo_artistico, 0);
  calculated_c_prod := COALESCE(contaazul_custos.custo_producao, 0);
  IF calculated_real_r > 0 THEN
    calculated_percent_art_fat := ((calculated_c_art + calculated_c_prod) / calculated_real_r) * 100;
  END IF;

  calculated_res_tot := COALESCE(getin_reservas.total_reservas, evento_record.res_tot, 0);
  calculated_res_p := COALESCE(getin_reservas.reservas_presentes, evento_record.res_p, 0);
  calculated_num_mesas_tot := COALESCE(getin_reservas.total_mesas, evento_record.num_mesas_tot, 0);
  calculated_num_mesas_presentes := COALESCE(getin_reservas.mesas_presentes, evento_record.num_mesas_presentes, 0);

  UPDATE operations.eventos_base SET
    cl_real = calculated_cl_real, real_r = calculated_real_r, faturamento_entrada = calculated_faturamento_entrada,
    te_real = calculated_te_real, tb_real = calculated_tb_real, t_medio = calculated_t_medio, lot_max = calculated_lot_max,
    percent_b = calculated_percent_b, percent_c = calculated_percent_c, percent_d = calculated_percent_d,
    percent_happy_hour = calculated_percent_happy_hour, t_coz = calculated_t_coz, t_bar = calculated_t_bar,
    atrasinho_cozinha = calculated_atrasinho_cozinha, atrasinho_bar = calculated_atrasinho_bar,
    atrasao_cozinha = calculated_atrasao_cozinha, atrasao_bar = calculated_atrasao_bar,
    fat_19h = calculated_fat_19h, fat_19h_percent = calculated_fat_19h_percent,
    c_art = calculated_c_art, c_prod = calculated_c_prod, percent_art_fat = calculated_percent_art_fat,
    res_tot = calculated_res_tot, res_p = calculated_res_p,
    num_mesas_tot = calculated_num_mesas_tot, num_mesas_presentes = calculated_num_mesas_presentes,
    conta_assinada = COALESCE(v_conta_assinada, 0),
    stockout_bebidas_perc = calculated_stockout_bebidas_perc,
    stockout_comidas_perc = calculated_stockout_comidas_perc,
    stockout_drinks_perc = calculated_stockout_drinks_perc,
    percent_stockout = calculated_percent_stockout,
    sympla_liquido = COALESCE(v_sympla_liquido, 0), sympla_checkins = COALESCE(v_sympla_checkins, 0),
    yuzer_liquido = COALESCE(v_yuzer_liquido_total, 0), yuzer_ingressos = COALESCE(v_yuzer_ingressos_qtd, 0)::NUMERIC,
    calculado_em = NOW(), precisa_recalculo = FALSE, atualizado_em = NOW(), versao_calculo = 25
  WHERE id = evento_id;
END;
$function$;
