-- Funções RPC para Visão Geral Estratégica

-- 1) FUNÇÃO ANUAL
CREATE OR REPLACE FUNCTION calcular_visao_geral_anual(
  p_bar_id INT,
  p_ano INT
)
RETURNS TABLE (
  faturamento_contahub NUMERIC,
  faturamento_yuzer NUMERIC,
  faturamento_sympla NUMERIC,
  faturamento_total NUMERIC,
  pessoas_contahub NUMERIC,
  pessoas_yuzer NUMERIC,
  pessoas_sympla NUMERIC,
  pessoas_total NUMERIC,
  reputacao_media NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.faturamento_contahub,
    v.faturamento_yuzer,
    v.faturamento_sympla,
    v.faturamento_total,
    v.pessoas_contahub,
    v.pessoas_yuzer,
    v.pessoas_sympla,
    v.pessoas_total,
    v.reputacao_media
  FROM public.view_visao_geral_anual v
  WHERE v.bar_id = p_bar_id
    AND v.ano = p_ano;
END;
$$;

GRANT EXECUTE ON FUNCTION calcular_visao_geral_anual(INT, INT) TO anon, authenticated;

-- 2) FUNÇÃO TRIMESTRAL
CREATE OR REPLACE FUNCTION calcular_visao_geral_trimestral(
  p_bar_id INT,
  p_trimestre INT,
  p_ano INT
)
RETURNS TABLE (
  clientes_totais NUMERIC,
  clientes_ativos NUMERIC,
  variacao_clientes_totais NUMERIC,
  variacao_clientes_ativos NUMERIC,
  cmo_total NUMERIC,
  cmo_percentual NUMERIC,
  variacao_cmo NUMERIC,
  faturamento_trimestre NUMERIC,
  artistica_percentual NUMERIC,
  variacao_artistica NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trimestre_anterior INT;
  v_ano_anterior INT;
BEGIN
  IF p_trimestre = 1 THEN
    v_trimestre_anterior := 4;
    v_ano_anterior := p_ano - 1;
  ELSE
    v_trimestre_anterior := p_trimestre - 1;
    v_ano_anterior := p_ano;
  END IF;

  RETURN QUERY
  WITH atual AS (
    SELECT 
      v.clientes_totais,
      v.cmo_total,
      v.cmo_percent,
      v.faturamento_trimestre,
      v.artistica_percent
    FROM public.view_visao_geral_trimestral v
    WHERE v.bar_id = p_bar_id
      AND v.ano = p_ano
      AND v.trimestre = p_trimestre
  ),
  anterior AS (
    SELECT 
      v.clientes_totais,
      v.cmo_total,
      v.cmo_percent,
      v.faturamento_trimestre,
      v.artistica_percent
    FROM public.view_visao_geral_trimestral v
    WHERE v.bar_id = p_bar_id
      AND v.ano = v_ano_anterior
      AND v.trimestre = v_trimestre_anterior
  )
  SELECT 
    COALESCE(atual.clientes_totais, 0) AS clientes_totais,
    COALESCE(atual.clientes_totais, 0) AS clientes_ativos,
    CASE 
      WHEN COALESCE(anterior.clientes_totais, 0) > 0 
      THEN ((COALESCE(atual.clientes_totais, 0) - COALESCE(anterior.clientes_totais, 0)) / COALESCE(anterior.clientes_totais, 1)) * 100
      ELSE 0 
    END AS variacao_clientes_totais,
    CASE 
      WHEN COALESCE(anterior.clientes_totais, 0) > 0 
      THEN ((COALESCE(atual.clientes_totais, 0) - COALESCE(anterior.clientes_totais, 0)) / COALESCE(anterior.clientes_totais, 1)) * 100
      ELSE 0 
    END AS variacao_clientes_ativos,
    COALESCE(atual.cmo_total, 0) AS cmo_total,
    COALESCE(atual.cmo_percent, 0) AS cmo_percentual,
    CASE 
      WHEN COALESCE(anterior.cmo_percent, 0) > 0 
      THEN ((COALESCE(atual.cmo_percent, 0) - COALESCE(anterior.cmo_percent, 0)) / COALESCE(anterior.cmo_percent, 1)) * 100
      ELSE 0 
    END AS variacao_cmo,
    COALESCE(atual.faturamento_trimestre, 0) AS faturamento_trimestre,
    COALESCE(atual.artistica_percent, 0) AS artistica_percentual,
    CASE 
      WHEN COALESCE(anterior.artistica_percent, 0) > 0 
      THEN ((COALESCE(atual.artistica_percent, 0) - COALESCE(anterior.artistica_percent, 0)) / COALESCE(anterior.artistica_percent, 1)) * 100
      ELSE 0 
    END AS variacao_artistica
  FROM atual
  LEFT JOIN anterior ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION calcular_visao_geral_trimestral(INT, INT, INT) TO anon, authenticated;

-- 3) FUNÇÃO PARA CALCULAR MÉTRICAS DE CLIENTES
CREATE OR REPLACE FUNCTION calcular_metricas_clientes(
  p_bar_id INT,
  p_data_inicio_atual DATE,
  p_data_fim_atual DATE,
  p_data_inicio_anterior DATE,
  p_data_fim_anterior DATE
)
RETURNS TABLE (
  total_atual BIGINT,
  novos_atual BIGINT,
  retornantes_atual BIGINT,
  total_anterior BIGINT,
  novos_anterior BIGINT,
  retornantes_anterior BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH clientes_atual AS (
    SELECT DISTINCT cli_fone
    FROM public.contahub_periodo
    WHERE bar_id = p_bar_id
      AND dt_gerencial >= p_data_inicio_atual
      AND dt_gerencial <= p_data_fim_atual
      AND cli_fone IS NOT NULL
      AND LENGTH(cli_fone) >= 8
  ),
  clientes_anterior AS (
    SELECT DISTINCT cli_fone
    FROM public.contahub_periodo
    WHERE bar_id = p_bar_id
      AND dt_gerencial >= p_data_inicio_anterior
      AND dt_gerencial <= p_data_fim_anterior
      AND cli_fone IS NOT NULL
      AND LENGTH(cli_fone) >= 8
  ),
  clientes_historico AS (
    SELECT DISTINCT cli_fone
    FROM public.contahub_periodo
    WHERE bar_id = p_bar_id
      AND dt_gerencial < p_data_inicio_atual
      AND cli_fone IS NOT NULL
      AND LENGTH(cli_fone) >= 8
  ),
  clientes_historico_anterior AS (
    SELECT DISTINCT cli_fone
    FROM public.contahub_periodo
    WHERE bar_id = p_bar_id
      AND dt_gerencial < p_data_inicio_anterior
      AND cli_fone IS NOT NULL
      AND LENGTH(cli_fone) >= 8
  )
  SELECT
    (SELECT COUNT(*) FROM clientes_atual)::BIGINT AS total_atual,
    (SELECT COUNT(*) FROM clientes_atual WHERE cli_fone NOT IN (SELECT cli_fone FROM clientes_historico))::BIGINT AS novos_atual,
    (SELECT COUNT(*) FROM clientes_atual WHERE cli_fone IN (SELECT cli_fone FROM clientes_historico))::BIGINT AS retornantes_atual,
    (SELECT COUNT(*) FROM clientes_anterior)::BIGINT AS total_anterior,
    (SELECT COUNT(*) FROM clientes_anterior WHERE cli_fone NOT IN (SELECT cli_fone FROM clientes_historico_anterior))::BIGINT AS novos_anterior,
    (SELECT COUNT(*) FROM clientes_anterior WHERE cli_fone IN (SELECT cli_fone FROM clientes_historico_anterior))::BIGINT AS retornantes_anterior;
END;
$$;

GRANT EXECUTE ON FUNCTION calcular_metricas_clientes(INT, DATE, DATE, DATE, DATE) TO anon, authenticated;
