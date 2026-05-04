-- 2026-05-04: RPC pra calcular retencao_real da Visao Geral em SQL
--
-- Problema: a Visao Geral (/estrategico/visao-geral) demorava ~10s pra carregar
-- porque calcularRetencaoReal() no frontend fazia 3 paginacoes paralelas em
-- public.visitas (~60k rows/ano), totalizando 90+ HTTP requests.
--
-- Esta RPC faz tudo em SQL: 3 CTEs com DISTINCT cliente_fone + 4 COUNT
-- com EXISTS. Roda em <1s vs ~10s do JS client-side.
--
-- Uso pelo frontend:
--   supabase.rpc('calcular_retencao_real_visao_geral', { p_bar_id, p_atual_inicio, ... })
--
-- Retorna:
--   retencao_real_pct: % de clientes do periodo anterior que voltaram no atual
--   variacao_pct: variacao % vs o cruzamento anterior-comparacao
--   contadores brutos (total_anterior, voltaram, total_comparacao, voltaram_anterior)

CREATE OR REPLACE FUNCTION public.calcular_retencao_real_visao_geral(
  p_bar_id integer,
  p_atual_inicio date,
  p_atual_fim date,
  p_anterior_inicio date,
  p_anterior_fim date,
  p_comparacao_inicio date,
  p_comparacao_fim date
)
RETURNS TABLE (
  retencao_real_pct numeric,
  variacao_pct numeric,
  total_anterior integer,
  voltaram integer,
  total_comparacao integer,
  voltaram_anterior integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, operations, pg_catalog
AS $$
DECLARE
  v_total_anterior integer;
  v_voltaram integer;
  v_total_comparacao integer;
  v_voltaram_anterior integer;
  v_pct_atual numeric;
  v_pct_anterior numeric;
BEGIN
  WITH
  clientes_atual AS (
    SELECT DISTINCT cliente_fone FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita BETWEEN p_atual_inicio AND p_atual_fim
      AND cliente_fone IS NOT NULL AND length(cliente_fone) >= 8
  ),
  clientes_anterior AS (
    SELECT DISTINCT cliente_fone FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita BETWEEN p_anterior_inicio AND p_anterior_fim
      AND cliente_fone IS NOT NULL AND length(cliente_fone) >= 8
  ),
  clientes_comparacao AS (
    SELECT DISTINCT cliente_fone FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita BETWEEN p_comparacao_inicio AND p_comparacao_fim
      AND cliente_fone IS NOT NULL AND length(cliente_fone) >= 8
  )
  SELECT
    (SELECT COUNT(*) FROM clientes_anterior)::integer,
    (SELECT COUNT(*) FROM clientes_anterior ca WHERE EXISTS (SELECT 1 FROM clientes_atual cat WHERE cat.cliente_fone = ca.cliente_fone))::integer,
    (SELECT COUNT(*) FROM clientes_comparacao)::integer,
    (SELECT COUNT(*) FROM clientes_comparacao cc WHERE EXISTS (SELECT 1 FROM clientes_anterior ca WHERE ca.cliente_fone = cc.cliente_fone))::integer
  INTO v_total_anterior, v_voltaram, v_total_comparacao, v_voltaram_anterior;

  v_pct_atual := CASE WHEN v_total_anterior > 0 THEN (v_voltaram::numeric / v_total_anterior * 100) ELSE 0 END;
  v_pct_anterior := CASE WHEN v_total_comparacao > 0 THEN (v_voltaram_anterior::numeric / v_total_comparacao * 100) ELSE 0 END;

  RETURN QUERY SELECT
    ROUND(v_pct_atual, 1),
    CASE WHEN v_pct_anterior > 0
      THEN ROUND(((v_pct_atual - v_pct_anterior) / v_pct_anterior * 100), 1)
      ELSE 0::numeric
    END,
    v_total_anterior, v_voltaram, v_total_comparacao, v_voltaram_anterior;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_retencao_real_visao_geral(integer, date, date, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_retencao_real_visao_geral(integer, date, date, date, date, date, date) TO authenticated, service_role;
