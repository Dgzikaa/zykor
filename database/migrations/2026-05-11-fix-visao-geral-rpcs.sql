-- ============================================================
-- 2026-05-11 — Fix RPCs visao-geral (dependiam de view dropada)
-- ============================================================
-- Problema:
--   calcular_visao_geral_anual e calcular_visao_geral_trimestral
--   buscavam de public.view_visao_geral_anual /
--   public.view_visao_geral_trimestral, que foram removidas.
--   Página /estrategico/visao-geral em branco em produção.
-- Solução:
--   Reescrever ambas como CTEs diretas sobre as tabelas atuais em
--   silver (faturamento_pagamentos, cliente_visitas, yuzer_*,
--   sympla_bilheteria_diaria) e bronze (google_reviews).
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- ANUAL
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_visao_geral_anual(
  p_bar_id integer,
  p_ano    integer
)
RETURNS TABLE(
  faturamento_contahub numeric,
  faturamento_yuzer    numeric,
  faturamento_sympla   numeric,
  faturamento_total    numeric,
  pessoas_contahub     numeric,
  pessoas_yuzer        numeric,
  pessoas_sympla       numeric,
  pessoas_total        numeric,
  reputacao_media      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_fat_contahub numeric;
  v_fat_yuzer    numeric;
  v_fat_sympla   numeric;
  v_pess_contahub numeric;
  v_pess_yuzer    numeric;
  v_pess_sympla   numeric;
  v_reputacao     numeric;
BEGIN
  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_fat_contahub
  FROM silver.faturamento_pagamentos
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_pagamento)::int = p_ano;

  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_fat_yuzer
  FROM silver.yuzer_pagamentos_evento
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_evento)::int = p_ano;

  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_fat_sympla
  FROM silver.sympla_bilheteria_diaria
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_evento)::int = p_ano;

  SELECT COALESCE(SUM(pessoas), 0) INTO v_pess_contahub
  FROM silver.cliente_visitas
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_visita)::int = p_ano;

  -- yuzer não tem mais coluna quantidade limpa em silver — aproximação 0
  v_pess_yuzer := 0;

  SELECT COALESCE(SUM(participantes_com_checkin), 0) INTO v_pess_sympla
  FROM silver.sympla_bilheteria_diaria
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_evento)::int = p_ano;

  -- Reputação: média de stars do bronze_google_reviews (não tem bar_id por review,
  -- então usa todos os reviews do ano).
  SELECT AVG(stars) INTO v_reputacao
  FROM bronze.bronze_google_reviews
  WHERE stars IS NOT NULL AND stars > 0
    AND EXTRACT(YEAR FROM published_at_date)::int = p_ano;

  RETURN QUERY SELECT
    v_fat_contahub,
    v_fat_yuzer,
    v_fat_sympla,
    v_fat_contahub + v_fat_yuzer + v_fat_sympla,
    v_pess_contahub,
    v_pess_yuzer,
    v_pess_sympla,
    v_pess_contahub + v_pess_yuzer + v_pess_sympla,
    COALESCE(v_reputacao, 0);
END;
$function$;

-- ----------------------------------------------------------------
-- TRIMESTRAL
-- ----------------------------------------------------------------
-- Campos que ficam aproximados / zerados até gold.desempenho_trimestral
-- ser materializado: cmo_total, cmo_percentual, artistica_percent (estes
-- vêm de gold.desempenho semanal — agregação trimestral fica para
-- migration futura).
CREATE OR REPLACE FUNCTION public.calcular_visao_geral_trimestral(
  p_bar_id     integer,
  p_trimestre  integer,
  p_ano        integer
)
RETURNS TABLE(
  clientes_totais          numeric,
  clientes_ativos          numeric,
  variacao_clientes_totais numeric,
  variacao_clientes_ativos numeric,
  cmo_total                numeric,
  cmo_percentual           numeric,
  variacao_cmo             numeric,
  faturamento_trimestre    numeric,
  artistica_percentual     numeric,
  variacao_artistica       numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_mes_inicio int;
  v_mes_fim    int;
  v_trim_ant   int;
  v_ano_ant    int;
  v_mes_ini_ant int;
  v_mes_fim_ant int;
  v_data_90    date;

  v_clientes_tot  numeric := 0;
  v_clientes_ativ numeric := 0;
  v_clientes_tot_ant  numeric := 0;
  v_clientes_ativ_ant numeric := 0;
  v_fat_trim      numeric := 0;
  v_fat_trim_ant  numeric := 0;
BEGIN
  v_mes_inicio := (p_trimestre - 1) * 3 + 1;
  v_mes_fim    := p_trimestre * 3;

  IF p_trimestre = 1 THEN
    v_trim_ant := 4; v_ano_ant := p_ano - 1;
  ELSE
    v_trim_ant := p_trimestre - 1; v_ano_ant := p_ano;
  END IF;
  v_mes_ini_ant := (v_trim_ant - 1) * 3 + 1;
  v_mes_fim_ant := v_trim_ant * 3;

  -- Clientes totais (únicos por telefone) no trimestre atual e anterior
  SELECT COUNT(DISTINCT cliente_nome)
    INTO v_clientes_tot
  FROM silver.cliente_visitas
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_visita)::int = p_ano
    AND EXTRACT(MONTH FROM data_visita)::int BETWEEN v_mes_inicio AND v_mes_fim
    AND tem_nome = true;

  SELECT COUNT(DISTINCT cliente_nome)
    INTO v_clientes_tot_ant
  FROM silver.cliente_visitas
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_visita)::int = v_ano_ant
    AND EXTRACT(MONTH FROM data_visita)::int BETWEEN v_mes_ini_ant AND v_mes_fim_ant
    AND tem_nome = true;

  -- Base ativa 90 dias: clientes que visitaram nos últimos 90 dias do trimestre
  v_data_90 := make_date(p_ano, v_mes_fim, 28) - INTERVAL '90 days';
  SELECT COUNT(DISTINCT cliente_nome)
    INTO v_clientes_ativ
  FROM silver.cliente_visitas
  WHERE bar_id = p_bar_id
    AND data_visita BETWEEN v_data_90 AND make_date(p_ano, v_mes_fim, 28)
    AND tem_nome = true;

  v_data_90 := make_date(v_ano_ant, v_mes_fim_ant, 28) - INTERVAL '90 days';
  SELECT COUNT(DISTINCT cliente_nome)
    INTO v_clientes_ativ_ant
  FROM silver.cliente_visitas
  WHERE bar_id = p_bar_id
    AND data_visita BETWEEN v_data_90 AND make_date(v_ano_ant, v_mes_fim_ant, 28)
    AND tem_nome = true;

  -- Faturamento do trimestre
  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_fat_trim
  FROM silver.faturamento_pagamentos
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_pagamento)::int = p_ano
    AND EXTRACT(MONTH FROM data_pagamento)::int BETWEEN v_mes_inicio AND v_mes_fim;

  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_fat_trim_ant
  FROM silver.faturamento_pagamentos
  WHERE bar_id = p_bar_id
    AND EXTRACT(YEAR FROM data_pagamento)::int = v_ano_ant
    AND EXTRACT(MONTH FROM data_pagamento)::int BETWEEN v_mes_ini_ant AND v_mes_fim_ant;

  RETURN QUERY SELECT
    v_clientes_tot                                                                            AS clientes_totais,
    v_clientes_ativ                                                                           AS clientes_ativos,
    CASE WHEN v_clientes_tot_ant > 0
         THEN ((v_clientes_tot - v_clientes_tot_ant) / v_clientes_tot_ant) * 100
         ELSE 0 END                                                                           AS variacao_clientes_totais,
    CASE WHEN v_clientes_ativ_ant > 0
         THEN ((v_clientes_ativ - v_clientes_ativ_ant) / v_clientes_ativ_ant) * 100
         ELSE 0 END                                                                           AS variacao_clientes_ativos,
    0::numeric                                                                                AS cmo_total,
    0::numeric                                                                                AS cmo_percentual,
    0::numeric                                                                                AS variacao_cmo,
    v_fat_trim                                                                                AS faturamento_trimestre,
    0::numeric                                                                                AS artistica_percentual,
    0::numeric                                                                                AS variacao_artistica;
END;
$function$;

COMMIT;
