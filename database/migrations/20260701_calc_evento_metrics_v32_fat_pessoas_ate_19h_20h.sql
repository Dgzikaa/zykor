-- 20260701 — Frente 2: faturamento e pessoas (comanda aberta) até 19h e até 20h.
-- fat_19h/fat_19h_percent já existiam (horas 16-18). Adicionamos:
--   fat_20h / fat_20h_percent      (horas 16-19)
--   pessoas_ate_19h / pessoas_ate_20h  (SUM(vd_pessoas) por hora de ABERTURA da comanda)
-- Fonte pessoas: bronze_contahub_avendas_vendasperiodo.vd_hrabertura (cobertura ~96%).
-- Madrugada (0-4h) excluída via EXTRACT(HOUR) >= 5.
-- calculate_evento_metrics -> versao_calculo = 32.

ALTER TABLE operations.eventos_base
  ADD COLUMN IF NOT EXISTS fat_20h numeric,
  ADD COLUMN IF NOT EXISTS fat_20h_percent numeric,
  ADD COLUMN IF NOT EXISTS pessoas_ate_19h integer,
  ADD COLUMN IF NOT EXISTS pessoas_ate_20h integer;

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
  v_bronze_yuzer NUMERIC := 0;
  v_sympla_liquido NUMERIC := 0; v_sympla_checkins INTEGER := 0;
  v_sb_liq NUMERIC; v_sb_chk INTEGER;
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
  calculated_fat_20h NUMERIC := 0; calculated_fat_20h_percent NUMERIC := 0;
  calculated_pessoas_ate_19h INTEGER := 0; calculated_pessoas_ate_20h INTEGER := 0;
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

  -- pessoas pagantes + couvert + cortes por hora de ABERTURA da comanda (madrugada 0-4h excluída via >= 5)
  SELECT COALESCE(SUM(CASE WHEN vd_vrpagamentos > 0 THEN vd_pessoas ELSE 0 END), 0)::INTEGER AS total_pessoas_pagantes,
         COALESCE(SUM(vd_vrcouvert), 0)::NUMERIC AS total_couvert,
         COALESCE(SUM(CASE WHEN vd_vrpagamentos > 0 AND EXTRACT(HOUR FROM vd_hrabertura) BETWEEN 5 AND 18 THEN vd_pessoas ELSE 0 END), 0)::INTEGER AS pessoas_ate_19h,
         COALESCE(SUM(CASE WHEN vd_vrpagamentos > 0 AND EXTRACT(HOUR FROM vd_hrabertura) BETWEEN 5 AND 19 THEN vd_pessoas ELSE 0 END), 0)::INTEGER AS pessoas_ate_20h
    INTO contahub_per
    FROM bronze.bronze_contahub_avendas_vendasperiodo
   WHERE vd_dtgerencial = evento_record.data_evento AND bar_id = evento_record.bar_id;

  -- faturamento por hora: até 19h = 16-18; até 20h = 16-19
  SELECT COALESCE(SUM(CASE WHEN SPLIT_PART(hora, ':', 1)::int IN (16,17,18) THEN valor ELSE 0 END), 0)::NUMERIC AS fat_ate_19h,
         COALESCE(SUM(CASE WHEN SPLIT_PART(hora, ':', 1)::int IN (16,17,18,19) THEN valor ELSE 0 END), 0)::NUMERIC AS fat_ate_20h,
         COALESCE(SUM(valor), 0)::NUMERIC AS fat_total
    INTO contahub_fat
    FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
   WHERE vd_dtgerencial = evento_record.data_evento AND bar_id = evento_record.bar_id;

  -- Yuzer (camada antiga integrations, por data exata) — preserva histórico.
  SELECT COALESCE(SUM(valor_liquido), 0)::NUMERIC INTO v_yuzer_liquido_total
    FROM integrations.yuzer_pagamento
   WHERE data_evento = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(valor_total), 0)::NUMERIC, COALESCE(SUM(quantidade), 0)::INTEGER
    INTO v_yuzer_ingressos_valor, v_yuzer_ingressos_qtd
    FROM integrations.yuzer_produtos
   WHERE data_evento = evento_record.data_evento AND bar_id = evento_record.bar_id AND LOWER(produto_nome) LIKE '%ingresso%';

  -- Se marcado usa_yuzer e há detalhe novo no bronze (fatporhora), sobrescreve por DATA DE OPERAÇÃO.
  IF COALESCE(evento_record.usa_yuzer, false) THEN
    SELECT COALESCE(SUM(f.faturamento), 0)::NUMERIC INTO v_bronze_yuzer
      FROM bronze.bronze_yuzer_fatporhora f
     WHERE f.bar_id = evento_record.bar_id
       AND (((f.data_hora AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '6 hours')::date) = evento_record.data_evento;

    IF v_bronze_yuzer > 0 THEN
      v_yuzer_liquido_total := v_bronze_yuzer;
      SELECT COALESCE(SUM(p.total), 0)::NUMERIC, COALESCE(SUM(p.count_vendido), 0)::INTEGER
        INTO v_yuzer_ingressos_valor, v_yuzer_ingressos_qtd
        FROM bronze.bronze_yuzer_produtos_evento p
       WHERE p.bar_id = evento_record.bar_id
         AND LOWER(p.produto_nome) LIKE '%ingresso%'
         AND p.evento_id IN (
           SELECT DISTINCT f.evento_id FROM bronze.bronze_yuzer_fatporhora f
            WHERE f.bar_id = evento_record.bar_id
              AND (((f.data_hora AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '6 hours')::date) = evento_record.data_evento
         );
    END IF;
  END IF;

  v_yuzer_bar_valor := COALESCE(v_yuzer_liquido_total, 0) - COALESCE(v_yuzer_ingressos_valor, 0);

  -- Sympla (camada antiga integrations) — preserva histórico.
  SELECT COALESCE(SUM(valor_liquido), 0)::NUMERIC INTO v_sympla_liquido
    FROM integrations.sympla_pedidos
   WHERE data_pedido::date = evento_record.data_evento AND bar_id = evento_record.bar_id AND status_pedido = 'APPROVED';

  SELECT COALESCE(COUNT(DISTINCT participante_sympla_id), 0)::INTEGER INTO v_sympla_checkins
    FROM integrations.sympla_participantes
   WHERE bar_id = evento_record.bar_id AND fez_checkin = true AND status_pedido = 'APPROVED' AND data_checkin::date = evento_record.data_evento;

  -- Se marcado usa_sympla e há dado no silver (bilheteria diária), sobrescreve.
  IF COALESCE(evento_record.usa_sympla, false) THEN
    SELECT valor_liquido, participantes_com_checkin INTO v_sb_liq, v_sb_chk
      FROM silver.sympla_bilheteria_diaria
     WHERE bar_id = evento_record.bar_id AND data_evento = evento_record.data_evento;
    IF v_sb_liq IS NOT NULL THEN
      v_sympla_liquido := v_sb_liq;
      v_sympla_checkins := COALESCE(v_sb_chk, v_sympla_checkins);
    END IF;
  END IF;

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
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação','Atrações/Eventos') THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_artistico, COALESCE(SUM(CASE WHEN categoria_nome IN ('Produção Eventos','Produção de Eventos') THEN COALESCE(NULLIF(valor_pago,0), valor_bruto) ELSE 0 END), 0)::NUMERIC AS custo_producao
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

  calculated_fat_20h := COALESCE(contahub_fat.fat_ate_20h, 0);
  IF calculated_fat_total_hora > 0 THEN
    calculated_fat_20h_percent := (calculated_fat_20h / calculated_fat_total_hora) * 100;
  END IF;
  calculated_pessoas_ate_19h := COALESCE(contahub_per.pessoas_ate_19h, 0);
  calculated_pessoas_ate_20h := COALESCE(contahub_per.pessoas_ate_20h, 0);

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
    fat_20h = calculated_fat_20h, fat_20h_percent = calculated_fat_20h_percent,
    pessoas_ate_19h = calculated_pessoas_ate_19h, pessoas_ate_20h = calculated_pessoas_ate_20h,
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
    calculado_em = NOW(), precisa_recalculo = FALSE, atualizado_em = NOW(), versao_calculo = 32
  WHERE id = evento_id;
END;
$function$;

-- Backfill das 4 colunas novas p/ o histórico SEM re-rodar a função (preserva edições manuais versao_calculo=999).
WITH fat AS (
  SELECT bar_id, vd_dtgerencial AS d,
    SUM(CASE WHEN SPLIT_PART(hora, ':', 1)::int IN (16,17,18,19) THEN valor ELSE 0 END)::numeric AS fat20,
    SUM(valor)::numeric AS fat_total
  FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
  GROUP BY bar_id, vd_dtgerencial
), per AS (
  SELECT bar_id, vd_dtgerencial AS d,
    SUM(CASE WHEN vd_vrpagamentos>0 AND EXTRACT(HOUR FROM vd_hrabertura) BETWEEN 5 AND 18 THEN vd_pessoas ELSE 0 END)::int AS p19,
    SUM(CASE WHEN vd_vrpagamentos>0 AND EXTRACT(HOUR FROM vd_hrabertura) BETWEEN 5 AND 19 THEN vd_pessoas ELSE 0 END)::int AS p20
  FROM bronze.bronze_contahub_avendas_vendasperiodo
  GROUP BY bar_id, vd_dtgerencial
)
UPDATE operations.eventos_base e SET
  fat_20h = x.fat20,
  fat_20h_percent = x.fat20_pct,
  pessoas_ate_19h = x.p19,
  pessoas_ate_20h = x.p20
FROM (
  SELECT e2.id,
    COALESCE(f.fat20, 0) AS fat20,
    CASE WHEN COALESCE(f.fat_total,0) > 0 THEN round(f.fat20 / f.fat_total * 100, 2) ELSE 0 END AS fat20_pct,
    COALESCE(p.p19, 0) AS p19,
    COALESCE(p.p20, 0) AS p20
  FROM operations.eventos_base e2
  LEFT JOIN fat f ON f.bar_id = e2.bar_id AND f.d = e2.data_evento
  LEFT JOIN per p ON p.bar_id = e2.bar_id AND p.d = e2.data_evento
) x
WHERE x.id = e.id;
