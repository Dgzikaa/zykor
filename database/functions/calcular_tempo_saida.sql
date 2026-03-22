CREATE OR REPLACE FUNCTION public.calcular_tempo_saida(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(tempo_bar_minutos numeric, tempo_cozinha_minutos numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_locais_drinks TEXT[];
  v_locais_comidas TEXT[];
  v_tempo_metrica VARCHAR(10);
BEGIN
  SELECT locais INTO v_locais_drinks
  FROM bar_local_mapeamento
  WHERE bar_id = p_bar_id AND categoria = 'drinks' AND ativo = true;
  
  SELECT locais INTO v_locais_comidas
  FROM bar_local_mapeamento
  WHERE bar_id = p_bar_id AND categoria = 'comidas' AND ativo = true;
  
  SELECT COALESCE(brn.tempo_metrica_bar, 't0_t3') INTO v_tempo_metrica
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
  
  IF v_tempo_metrica = 't0_t3' THEN
    RETURN QUERY
    SELECT
      ROUND(
        SUM(CASE WHEN tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t3 > 0 THEN tp.t0_t3 ELSE 0 END)::numeric /
        NULLIF(COUNT(CASE WHEN tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t3 > 0 THEN 1 END), 0) / 60
      , 1)::NUMERIC,
      ROUND(
        SUM(CASE WHEN tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > 0 THEN tp.t0_t2 ELSE 0 END)::numeric /
        NULLIF(COUNT(CASE WHEN tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > 0 THEN 1 END), 0) / 60
      , 1)::NUMERIC
    FROM tempos_producao tp
    WHERE tp.bar_id = p_bar_id
      AND tp.data_producao >= p_data_inicio
      AND tp.data_producao <= p_data_fim
      AND tp.data_producao NOT IN ('2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17');
  ELSE
    RETURN QUERY
    SELECT
      ROUND(
        SUM(CASE WHEN tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t2 > 0 THEN tp.t0_t2 ELSE 0 END)::numeric /
        NULLIF(COUNT(CASE WHEN tp.local_desc = ANY(v_locais_drinks) AND tp.t0_t2 > 0 THEN 1 END), 0) / 60
      , 1)::NUMERIC,
      ROUND(
        SUM(CASE WHEN tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > 0 THEN tp.t0_t2 ELSE 0 END)::numeric /
        NULLIF(COUNT(CASE WHEN tp.local_desc = ANY(v_locais_comidas) AND tp.t0_t2 > 0 THEN 1 END), 0) / 60
      , 1)::NUMERIC
    FROM tempos_producao tp
    WHERE tp.bar_id = p_bar_id
      AND tp.data_producao >= p_data_inicio
      AND tp.data_producao <= p_data_fim
      AND tp.data_producao NOT IN ('2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17');
  END IF;
END;
$function$;
