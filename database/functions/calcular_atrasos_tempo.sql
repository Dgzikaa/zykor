CREATE OR REPLACE FUNCTION public.calcular_atrasos_tempo(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(qtde_itens_bar integer, qtde_itens_cozinha integer, atrasos_bar integer, atrasos_cozinha integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_locais_drinks TEXT[];
  v_locais_comidas TEXT[];
  v_tempo_metrica VARCHAR(10);
  v_tempo_limite_bar INTEGER;
  v_tempo_limite_cozinha INTEGER;
BEGIN
  SELECT locais INTO v_locais_drinks
  FROM bar_local_mapeamento
  WHERE bar_id = p_bar_id AND categoria = 'drinks' AND ativo = true;
  
  SELECT locais INTO v_locais_comidas
  FROM bar_local_mapeamento
  WHERE bar_id = p_bar_id AND categoria = 'comidas' AND ativo = true;
  
  SELECT 
    COALESCE(brn.tempo_metrica_bar, 't0_t3'),
    COALESCE(brn.tempo_limite_bar_segundos, 600),
    COALESCE(brn.tempo_limite_cozinha_segundos, 1200)
  INTO v_tempo_metrica, v_tempo_limite_bar, v_tempo_limite_cozinha
  FROM bar_regras_negocio brn
  WHERE brn.bar_id = p_bar_id;
  
  IF v_locais_drinks IS NULL THEN
    v_locais_drinks := ARRAY['Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos'];
  END IF;
  IF v_locais_comidas IS NULL THEN
    v_locais_comidas := ARRAY['Cozinha','Cozinha 1','Cozinha 2'];
  END IF;
  IF v_tempo_metrica IS NULL THEN
    v_tempo_metrica := 't0_t3';
  END IF;
  IF v_tempo_limite_bar IS NULL THEN
    v_tempo_limite_bar := 600;
  END IF;
  IF v_tempo_limite_cozinha IS NULL THEN
    v_tempo_limite_cozinha := 1200;
  END IF;
  
  IF v_tempo_metrica = 't0_t3' THEN
    RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t3 > 0)::INTEGER,
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > 0)::INTEGER,
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t3 > v_tempo_limite_bar)::INTEGER,
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > v_tempo_limite_cozinha)::INTEGER
    FROM tempos_producao tp
    WHERE tp.bar_id = p_bar_id
      AND tp.data_producao >= p_data_inicio
      AND tp.data_producao <= p_data_fim;
  ELSE
    RETURN QUERY
    SELECT
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t2 > 0)::INTEGER,
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > 0)::INTEGER,
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t2 > v_tempo_limite_bar)::INTEGER,
      COUNT(*) FILTER (WHERE tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > v_tempo_limite_cozinha)::INTEGER
    FROM tempos_producao tp
    WHERE tp.bar_id = p_bar_id
      AND tp.data_producao >= p_data_inicio
      AND tp.data_producao <= p_data_fim;
  END IF;
END;
$function$;
