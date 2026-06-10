-- 2026-06-10 | Fix calculate_evento_metrics: tempos/atrasos divergiam do gold.desempenho
--
-- Sintoma: gold.planejamento (por-evento) mostrava atrasos absurdos (maio bar3 somava
--   atrasao_bar=4507 vs 148 reais) e tempo em segundos exibido como minutos. gold.desempenho
--   (mensal) estava certo (187/148) — a apresentação do sócio usava ele.
--
-- Causa (calculate_evento_metrics): calculava tempos/atrasos do BRONZE raw
--   (bronze.bronze_contahub_produtos_temposproducao) + JOIN produto_categoria_mix por loc_desc,
--   e contava DRINK+BEBIDA como "bar". A gold.desempenho usa silver.tempos_producao filtrando
--   por local_desc (estacoes) e conta SO DRINK.
--
-- Correcao: alinhar 100% a logica do etl_gold_desempenho — fonte silver.tempos_producao,
--   filtro por local_desc nas estacoes (Ord: drinks=Preshh/Montados/Mexido/Drinks/Drinks
--   Autorais/Shot e Dose/Batidos, cozinha=Cozinha/Cozinha 1/Cozinha 2; Deb: drinks=Bar,
--   cozinha=Cozinha/Cozinha 2), drinks=t0_t3, cozinha=t0_t2 (Ord)/t0_t3 (Deb >=20/03),
--   cap 1-3600s no tempo medio. bar = SO drinks. Fallback p/ categoria do silver em outros bares.
--
-- Verificado: dry-run e recalculo de maio bar3 batem EXATO com gold.desempenho (187/148,
--   tempo_cozinha 546,72s, tempo_drinks 151,75s). Apos recalcular 2026 (bars 3,4) +
--   etl_gold_planejamento_full, gold.planejamento (soma) == gold.desempenho (mensal).
--
-- Pos-deploy: rodar
--   SELECT calculate_evento_metrics(id) FROM operations.eventos_base
--     WHERE bar_id IN (3,4) AND ativo AND data_evento >= '2026-01-01';
--   SELECT etl_gold_planejamento_full(3,'2026-01-01','2026-12-31');
--   SELECT etl_gold_planejamento_full(4,'2026-01-01','2026-12-31');

CREATE OR REPLACE FUNCTION public.calculate_evento_metrics(evento_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'bronze', 'silver', 'integrations', 'pg_temp'
AS $function$
DECLARE
  evento_record RECORD;
  is_evento_especial BOOLEAN;
  v_use_t0t3_cozinha BOOLEAN;
  v_use_t0t3_bar BOOLEAN;
  v_locs_drinks text[];
  v_locs_cozinha text[];
  v_contahub_liquido NUMERIC := 0; v_conta_assinada NUMERIC := 0;
  v_yuzer_liquido_total NUMERIC := 0; v_yuzer_ingressos_valor NUMERIC := 0;
  v_yuzer_ingressos_qtd INTEGER := 0; v_yuzer_bar_valor NUMERIC := 0;
  v_sympla_liquido NUMERIC := 0; v_sympla_checkins INTEGER := 0;
  contahub_per RECORD; contahub_fat RECORD; contahub_ana RECORD;
  contahub_tempo_data RECORD; contaazul_custos RECORD; getin_reservas RECORD;
  calculated_cl_real INTEGER := 0; calculated_real_r NUMERIC := 0;
  calculated_faturamento_entrada NUMERIC := 0; calculated_faturamento_bar NUMERIC := 0;
  calculated_te_real NUMERIC := 0; calculated_tb_real NUMERIC := 0;
  calculated_t_medio NUMERIC := 0; calculated_lot_max NUMERIC := 0;
  calculated_percent_b NUMERIC := 0; calculated_percent_c NUMERIC := 0;
  calculated_percent_d NUMERIC := 0; calculated_percent_happy_hour NUMERIC := 0;
  calculated_t_coz NUMERIC := 0; calculated_t_bar NUMERIC := 0;
  calculated_atrasinho_cozinha INTEGER := 0; calculated_atrasinho_bar INTEGER := 0;
  calculated_atrasao_cozinha INTEGER := 0; calculated_atrasao_bar INTEGER := 0;
  calculated_fat_19h NUMERIC := 0; calculated_fat_19h_percent NUMERIC := 0;
  calculated_fat_total_hora NUMERIC := 0;
  calculated_c_art NUMERIC := 0; calculated_c_prod NUMERIC := 0; calculated_percent_art_fat NUMERIC := 0;
  calculated_res_tot INTEGER := 0; calculated_res_p INTEGER := 0;
  calculated_num_mesas_tot INTEGER := 0; calculated_num_mesas_presentes INTEGER := 0;
  calculated_percent_stockout NUMERIC := 0; calculated_stockout_bebidas_perc NUMERIC := 0;
  calculated_stockout_comidas_perc NUMERIC := 0; calculated_stockout_drinks_perc NUMERIC := 0;
BEGIN
  SELECT * INTO evento_record FROM operations.eventos_base WHERE id = evento_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF evento_record.bar_id = 4 AND EXTRACT(dow FROM evento_record.data_evento) = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
       WHERE bar_id = evento_record.bar_id AND dt_gerencial = evento_record.data_evento LIMIT 1
    ) THEN RETURN; END IF;
  END IF;

  v_use_t0t3_cozinha := (evento_record.bar_id = 4 AND evento_record.data_evento >= DATE '2026-03-20');
  v_use_t0t3_bar := (evento_record.bar_id = 3) OR (evento_record.bar_id = 4 AND evento_record.data_evento >= DATE '2026-03-07');

  IF evento_record.bar_id = 3 THEN
    v_locs_drinks := ARRAY['Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos'];
    v_locs_cozinha := ARRAY['Cozinha','Cozinha 1','Cozinha 2'];
  ELSIF evento_record.bar_id = 4 THEN
    v_locs_drinks := ARRAY['Bar'];
    v_locs_cozinha := ARRAY['Cozinha','Cozinha 2'];
  ELSE
    v_locs_drinks := NULL;
    v_locs_cozinha := NULL;
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

  SELECT COALESCE(SUM(CASE WHEN SPLIT_PART(hora, ':', 1)::int IN (16,17,18) THEN valor ELSE 0 END), 0)::NUMERIC AS fat_ate_19h,
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
    COALESCE(SUM(CASE WHEN status IN ('seated','pending','confirmed') THEN people ELSE 0 END), 0)::INTEGER AS reservas_presentes,
    COALESCE(COUNT(*), 0)::INTEGER AS total_mesas,
    COALESCE(COUNT(*) FILTER (WHERE status IN ('seated','pending','confirmed')), 0)::INTEGER AS mesas_presentes
  INTO getin_reservas
  FROM bronze.bronze_getin_reservations
  WHERE reservation_date = evento_record.data_evento AND bar_id = evento_record.bar_id;

  IF evento_record.bar_id = 3 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação','Atrações/Eventos') THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_producao
      INTO contaazul_custos FROM bronze.bronze_contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA' AND excluido_em IS NULL;
  ELSIF evento_record.bar_id = 4 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação','Atrações/Eventos') THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_artistico, 0::NUMERIC AS custo_producao
      INTO contaazul_custos FROM bronze.bronze_contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA' AND excluido_em IS NULL;
  ELSE
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação','Atrações/Eventos') THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_producao
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
     WHERE a.trn_dtgerencial = evento_record.data_evento AND a.bar_id = evento_record.bar_id AND a.tipo IN ('venda integral','com desconto','100% desconto');

    IF COALESCE(contahub_ana.total_valorfinal, 0) > 0 THEN
      calculated_percent_b := (COALESCE(contahub_ana.valor_bebidas, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_c := (COALESCE(contahub_ana.valor_comidas, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_d := (COALESCE(contahub_ana.valor_drinks, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_happy_hour := (COALESCE(contahub_ana.valor_happy_hour, 0) / contahub_ana.total_valorfinal) * 100;
    END IF;

    -- TEMPOS/ATRASOS: silver.tempos_producao por local_desc (igual etl_gold_desempenho).
    WITH tempo_cozinha AS (
      SELECT CASE WHEN v_use_t0t3_cozinha THEN t.t0_t3 ELSE t.t0_t2 END AS tempo
      FROM silver.tempos_producao t
      WHERE t.data_producao = evento_record.data_evento AND t.bar_id = evento_record.bar_id
        AND ( (v_locs_cozinha IS NOT NULL AND t.local_desc = ANY(v_locs_cozinha))
              OR (v_locs_cozinha IS NULL AND t.categoria = 'comida') )
    ), tempo_bar AS (
      SELECT t.t0_t3 AS tempo
      FROM silver.tempos_producao t
      WHERE t.data_producao = evento_record.data_evento AND t.bar_id = evento_record.bar_id
        AND ( (v_locs_drinks IS NOT NULL AND t.local_desc = ANY(v_locs_drinks))
              OR (v_locs_drinks IS NULL AND t.categoria = 'drink') )
    )
    SELECT
      (SELECT COALESCE(AVG(tempo), 0)::NUMERIC FROM tempo_cozinha WHERE tempo BETWEEN 1 AND 3600) AS tempo_cozinha,
      (SELECT COALESCE(AVG(tempo), 0)::NUMERIC FROM tempo_bar      WHERE tempo BETWEEN 1 AND 3600) AS tempo_bar,
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

    SELECT COALESCE(s.stockout_bar_perc, 0), COALESCE(s.stockout_comidas_perc, 0),
           COALESCE(s.stockout_drinks_perc, 0), COALESCE(s.stockout_total_perc, 0)
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
    calculado_em = NOW(), precisa_recalculo = FALSE, atualizado_em = NOW(), versao_calculo = 29
  WHERE id = evento_id;
END;
$function$;
