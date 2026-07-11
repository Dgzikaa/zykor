-- Dashboard "Gargalo de Cozinha": agrega silver.tempos_producao em 4 cortes
-- (por praça, por hora, itens que atrasam, decomposição fila/preparo/expedição).
-- Lê a config real por bar (métrica, limites, setores, excluídos) de operations.*,
-- então bate com o atrasos_cozinha_perc da home. Robusto a outlier (cap + mediana/p90).
-- Consumido por /api/operacional/gargalo-cozinha (rpc via service_role).
CREATE OR REPLACE FUNCTION operations.fn_gargalo_cozinha(
  p_bar_id   int,
  p_dias     int  DEFAULT 30,
  p_categoria text DEFAULT 'cozinha',  -- 'cozinha' | 'bar' | 'todos'
  p_cap_seg  int  DEFAULT 3600         -- corte de outlier (segundos)
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO operations, silver, public, pg_catalog
AS $$
DECLARE
  v_metrica   text;
  v_lim_bar   int;
  v_lim_coz   int;
  v_comidas   text[];
  v_drinks    text[];
  v_bebidas   text[];
  v_excluidos text[];
  v_locais    text[];   -- NULL = todos (menos excluidos)
  v_di        date := CURRENT_DATE - p_dias;
  v_result    jsonb;
BEGIN
  SELECT COALESCE(tempo_metrica_bar,'t0_t3'),
         COALESCE(tempo_limite_bar_segundos,600),
         COALESCE(tempo_limite_cozinha_segundos,1200)
    INTO v_metrica, v_lim_bar, v_lim_coz
  FROM operations.bar_regras_negocio WHERE bar_id = p_bar_id;
  IF v_metrica IS NULL THEN v_metrica := 't0_t3'; v_lim_bar := 600; v_lim_coz := 1200; END IF;

  SELECT locais INTO v_comidas   FROM operations.bar_local_mapeamento WHERE bar_id=p_bar_id AND categoria='comidas'   AND ativo;
  SELECT locais INTO v_drinks    FROM operations.bar_local_mapeamento WHERE bar_id=p_bar_id AND categoria='drinks'    AND ativo;
  SELECT locais INTO v_bebidas   FROM operations.bar_local_mapeamento WHERE bar_id=p_bar_id AND categoria='bebidas'   AND ativo;
  SELECT locais INTO v_excluidos FROM operations.bar_local_mapeamento WHERE bar_id=p_bar_id AND categoria='excluidos' AND ativo;
  v_comidas   := COALESCE(v_comidas, ARRAY['Cozinha','Cozinha 1','Cozinha 2']);
  v_excluidos := COALESCE(v_excluidos, ARRAY[]::text[]);

  IF p_categoria = 'cozinha' THEN
    v_locais := v_comidas;
  ELSIF p_categoria = 'bar' THEN
    v_locais := COALESCE(v_drinks, ARRAY[]::text[]) || COALESCE(v_bebidas, ARRAY[]::text[]);
  ELSE
    v_locais := NULL; -- todos
  END IF;

  WITH base AS (
    SELECT
      tp.local_desc,
      tp.produto_desc,
      EXTRACT(hour FROM tp.t0_lancamento)::int AS hora,
      (CASE WHEN v_metrica='t0_t2' THEN tp.t0_t2 ELSE tp.t0_t3 END)::numeric AS m,
      tp.t0_t1, tp.t1_t2, tp.t2_t3,
      CASE WHEN tp.local_desc = ANY(v_comidas) THEN v_lim_coz ELSE v_lim_bar END AS limite
    FROM silver.tempos_producao tp
    WHERE tp.bar_id = p_bar_id
      AND tp.data_producao >= v_di
      AND (tp.local_desc IS NULL OR NOT (tp.local_desc = ANY(v_excluidos)))
      AND (v_locais IS NULL OR tp.local_desc = ANY(v_locais))
      AND (CASE WHEN v_metrica='t0_t2' THEN tp.t0_t2 ELSE tp.t0_t3 END) BETWEEN 1 AND p_cap_seg
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
        'pedidos', count(*),
        'mediana_min', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1),
        'p90_min',     round((percentile_cont(0.9) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1),
        'atraso_pct',  round((100.0*count(*) FILTER (WHERE m>limite)/NULLIF(count(*),0))::numeric,1)
      ) FROM base),
    'por_praca', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.atraso_pct DESC NULLS LAST),'[]'::jsonb) FROM (
        SELECT local_desc AS setor, count(*) AS pedidos,
               round((percentile_cont(0.5) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1) AS mediana_min,
               round((percentile_cont(0.9) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1) AS p90_min,
               round((100.0*count(*) FILTER (WHERE m>limite)/count(*))::numeric,1) AS atraso_pct
        FROM base GROUP BY local_desc) x),
    'por_hora', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.hora),'[]'::jsonb) FROM (
        SELECT hora, count(*) AS pedidos,
               round((percentile_cont(0.5) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1) AS mediana_min,
               round((percentile_cont(0.9) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1) AS p90_min,
               round((100.0*count(*) FILTER (WHERE m>limite)/count(*))::numeric,1) AS atraso_pct
        FROM base GROUP BY hora) x),
    'itens', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.atraso_pct DESC, x.mediana_min DESC),'[]'::jsonb) FROM (
        SELECT produto_desc AS produto, count(*) AS pedidos,
               round((percentile_cont(0.5) WITHIN GROUP (ORDER BY m)/60.0)::numeric,1) AS mediana_min,
               round((100.0*count(*) FILTER (WHERE m>limite)/count(*))::numeric,1) AS atraso_pct
        FROM base GROUP BY produto_desc HAVING count(*) >= 10
        ORDER BY atraso_pct DESC, mediana_min DESC LIMIT 15) x),
    'decomposicao', (SELECT jsonb_build_object(
        'fila_min',    round((avg(t0_t1) FILTER (WHERE t0_t1 BETWEEN 0 AND p_cap_seg)/60.0)::numeric,1),
        'preparo_min', round((avg(t1_t2) FILTER (WHERE t1_t2 BETWEEN 0 AND p_cap_seg)/60.0)::numeric,1),
        'expedicao_min', CASE WHEN v_metrica='t0_t2' THEN NULL
                              ELSE round((avg(t2_t3) FILTER (WHERE t2_t3 BETWEEN 0 AND p_cap_seg)/60.0)::numeric,1) END
      ) FROM base),
    'meta', jsonb_build_object(
        'metrica', v_metrica, 'limite_cozinha_seg', v_lim_coz, 'limite_bar_seg', v_lim_bar,
        'dias', p_dias, 'categoria', p_categoria, 'cap_seg', p_cap_seg, 'desde', v_di)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION operations.fn_gargalo_cozinha(int,int,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_gargalo_cozinha(int,int,text,int) TO service_role;
