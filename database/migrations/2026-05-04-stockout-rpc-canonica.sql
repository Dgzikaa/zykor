-- 2026-05-04: stockout consolidado em RPC unica (silver.calcular_stockout_periodo)
--
-- Problema: stockout era calculado em 3 lugares diferentes com logicas divergentes:
--   1. /ferramentas/stockout (frontend)         -> silver + incluido + categoria_local + COUNT DISTINCT
--   2. etl_gold_desempenho_semanal (gold)       -> idem (correto)
--   3. etl_gold_desempenho_mensal  (gold)       -> idem (correto)
--   4. calculate_evento_metrics    (operations) -> categoria_mix + filtros prd_desc legacy + COUNT(*)
--
-- Resultado: planejamento-comercial divergia da ferramenta (Deb 03/05: drinks 33.3% vs 22.34%).
--
-- Fix: criar 1 RPC canonica em silver, e fazer todos os 3 ETLs chamarem essa RPC.
-- A flag `incluido` na silver ja consolida regras de exclusao por bar (via
-- produto_categoria_mix.incluir_stockout). A regra real de exclusao mora em UM lugar
-- (a flag), e o calculo mora em UMA funcao (a RPC).
--
-- Resultado validado:
--   Deb 03/05: drinks=22.34, bar=26.32, comidas=3.23 (bate com /ferramentas/stockout)
--   Ord S18:   drinks=2.96,  bar=14.19, comidas=8.73 (bate com /ferramentas/stockout)

-- ============================================================
-- 1. RPC canonica
-- ============================================================
CREATE OR REPLACE FUNCTION silver.calcular_stockout_periodo(
  p_bar_id integer,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  stockout_drinks_perc numeric,
  stockout_bar_perc numeric,
  stockout_comidas_perc numeric,
  stockout_total_perc numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = silver, public, pg_catalog
AS $$
  WITH dia AS (
    SELECT data_consulta, categoria_local,
           COUNT(DISTINCT prd) AS total,
           COUNT(DISTINCT prd) FILTER (WHERE prd_venda='N') AS sem_venda
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id
      AND data_consulta BETWEEN p_data_inicio AND p_data_fim
      AND incluido = true
      AND categoria_local IN ('Drinks','Bar','Comidas')
    GROUP BY data_consulta, categoria_local
  )
  SELECT
    AVG(sem_venda::numeric / NULLIF(total,0) * 100) FILTER (WHERE categoria_local='Drinks')::numeric(5,2),
    AVG(sem_venda::numeric / NULLIF(total,0) * 100) FILTER (WHERE categoria_local='Bar')::numeric(5,2),
    AVG(sem_venda::numeric / NULLIF(total,0) * 100) FILTER (WHERE categoria_local='Comidas')::numeric(5,2),
    AVG(sem_venda::numeric / NULLIF(total,0) * 100)::numeric(5,2)
  FROM dia;
$$;

REVOKE EXECUTE ON FUNCTION silver.calcular_stockout_periodo(integer, date, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION silver.calcular_stockout_periodo(integer, date, date) TO authenticated, service_role;

-- ============================================================
-- 2. Refatorar etl_gold_desempenho_semanal (substituir CTEs por chamada a RPC)
-- ============================================================
DO $$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.etl_gold_desempenho_semanal'::regproc);
  v_old := E'fase_stockout_dia AS (\n    SELECT data_consulta, categoria_local,\n      COUNT(DISTINCT prd) as total,\n      COUNT(DISTINCT prd) FILTER (WHERE prd_venda = ''N'') as stockout\n    FROM silver.silver_contahub_operacional_stockout_processado\n    WHERE bar_id = p_bar_id\n      AND data_consulta BETWEEN v_data_inicio AND v_data_fim\n      AND incluido = true\n    GROUP BY data_consulta, categoria_local\n  ),\n  fase_stockout AS (\n    SELECT AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = ''Drinks'')::numeric(5,2) as stockout_drinks_perc, AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = ''Bar'')::numeric(5,2) as stockout_bar_perc, AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = ''Comidas'')::numeric(5,2) as stockout_comidas_perc, AVG(stockout::numeric / NULLIF(total, 0) * 100)::numeric(5,2) as stockout_total_perc\n    FROM fase_stockout_dia\n  ),';
  v_new := E'fase_stockout AS (\n    SELECT * FROM silver.calcular_stockout_periodo(p_bar_id, v_data_inicio, v_data_fim)\n  ),';

  IF position(v_old IN v_def) = 0 THEN
    RAISE NOTICE 'etl_gold_desempenho_semanal ja esta refatorado ou tem formato diferente. Pulando.';
  ELSE
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
    RAISE NOTICE 'etl_gold_desempenho_semanal refatorado com sucesso.';
  END IF;
END $$;

-- ============================================================
-- 3. Refatorar etl_gold_desempenho_mensal (substituir CTEs por chamada a RPC)
-- ============================================================
DO $$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.etl_gold_desempenho_mensal'::regproc);
  v_old := E'fase_stockout_dia AS (\n    SELECT data_consulta, categoria_local,\n      COUNT(DISTINCT prd) as total,\n      COUNT(DISTINCT prd) FILTER (WHERE prd_venda = ''N'') as stockout\n    FROM silver.silver_contahub_operacional_stockout_processado\n    WHERE bar_id = p_bar_id AND data_consulta BETWEEN v_data_inicio AND v_data_fim AND incluido = true\n    GROUP BY data_consulta, categoria_local\n  ),\n  fase_stockout AS (\n    SELECT\n      AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = ''Drinks'')::numeric(5,2) as stockout_drinks_perc,\n      AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = ''Bar'')::numeric(5,2) as stockout_bar_perc,\n      AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = ''Comidas'')::numeric(5,2) as stockout_comidas_perc,\n      AVG(stockout::numeric / NULLIF(total, 0) * 100)::numeric(5,2) as stockout_total_perc\n    FROM fase_stockout_dia\n  ),';
  v_new := E'fase_stockout AS (\n    SELECT * FROM silver.calcular_stockout_periodo(p_bar_id, v_data_inicio, v_data_fim)\n  ),';

  IF position(v_old IN v_def) = 0 THEN
    RAISE NOTICE 'etl_gold_desempenho_mensal ja esta refatorado ou tem formato diferente. Pulando.';
  ELSE
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
    RAISE NOTICE 'etl_gold_desempenho_mensal refatorado com sucesso.';
  END IF;
END $$;

-- ============================================================
-- 4. Refatorar calculate_evento_metrics (substituir bloco WITH stockout_base/categoria/pivot)
-- ============================================================
-- Esta funcao tem mudanca semantica (era categoria_mix, vira categoria_local + incluido),
-- entao reescreve a funcao inteira em vez de search-and-replace.
-- versao_calculo: 23 -> 24
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
      INTO contaazul_custos FROM integrations.contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA';
  ELSIF evento_record.bar_id = 4 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação', 'Atrações/Eventos') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico, 0::NUMERIC AS custo_producao
      INTO contaazul_custos FROM integrations.contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA';
  ELSE
    SELECT COALESCE(SUM(CASE WHEN categoria_nome IN ('Atrações Programação', 'Atrações/Eventos') THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_artistico,
           COALESCE(SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor_bruto ELSE 0 END), 0)::NUMERIC AS custo_producao
      INTO contaazul_custos FROM integrations.contaazul_lancamentos
     WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id AND tipo = 'DESPESA';
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

    WITH tempo_cozinha AS (
      SELECT t.t0_t2 FROM bronze.bronze_contahub_produtos_temposproducao t
      INNER JOIN operations.produto_categoria_mix pcm ON pcm.bar_id = t.bar_id AND pcm.loc_desc = t.loc_desc
      WHERE t.data = evento_record.data_evento AND t.bar_id = evento_record.bar_id AND pcm.categoria = 'COMIDA'
    ), tempo_bar AS (
      SELECT CASE WHEN evento_record.bar_id = 3 THEN t.t0_t3 ELSE t.t0_t2 END as tempo
      FROM bronze.bronze_contahub_produtos_temposproducao t
      INNER JOIN operations.produto_categoria_mix pcm ON pcm.bar_id = t.bar_id AND pcm.loc_desc = t.loc_desc
      WHERE t.data = evento_record.data_evento AND t.bar_id = evento_record.bar_id
        AND pcm.categoria IN ('DRINK', 'BEBIDA')
    )
    SELECT (SELECT COALESCE(AVG(t0_t2), 0)::NUMERIC FROM tempo_cozinha) AS tempo_cozinha,
           (SELECT COALESCE(AVG(tempo), 0)::NUMERIC FROM tempo_bar) AS tempo_bar,
           (SELECT COUNT(*)::INTEGER FROM tempo_cozinha WHERE t0_t2 > 15) AS atrasinho_cozinha,
           (SELECT COUNT(*)::INTEGER FROM tempo_bar WHERE tempo > 5) AS atrasinho_bar,
           (SELECT COUNT(*)::INTEGER FROM tempo_cozinha WHERE t0_t2 > 20) AS atrasao_cozinha,
           (SELECT COUNT(*)::INTEGER FROM tempo_bar WHERE tempo > 10) AS atrasao_bar
      INTO contahub_tempo_data;

    calculated_t_coz := COALESCE(contahub_tempo_data.tempo_cozinha, 0)::NUMERIC;
    calculated_t_bar := COALESCE(contahub_tempo_data.tempo_bar, 0)::NUMERIC;
    calculated_atrasinho_cozinha := COALESCE(contahub_tempo_data.atrasinho_cozinha, 0)::INTEGER;
    calculated_atrasinho_bar := COALESCE(contahub_tempo_data.atrasinho_bar, 0)::INTEGER;
    calculated_atrasao_cozinha := COALESCE(contahub_tempo_data.atrasao_cozinha, 0)::INTEGER;
    calculated_atrasao_bar := COALESCE(contahub_tempo_data.atrasao_bar, 0)::INTEGER;

    -- Stockout vem da RPC canonica silver.calcular_stockout_periodo (mesma fonte da
    -- ferramenta /ferramentas/stockout). Substitui CTE legacy que filtrava por
    -- categoria_mix + patterns de prd_desc.
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
    calculado_em = NOW(), precisa_recalculo = FALSE, atualizado_em = NOW(), versao_calculo = 24
  WHERE id = evento_id;
END;
$function$;
