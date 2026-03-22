CREATE OR REPLACE FUNCTION public.map_categoria_mix(p_bar_id integer, p_loc_desc text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_loc TEXT := LOWER(TRIM(COALESCE(p_loc_desc, '')));
  v_rec RECORD;
BEGIN
  IF v_loc = '' THEN
    RETURN NULL;
  END IF;

  FOR v_rec IN 
    SELECT categoria, locais 
    FROM bar_local_mapeamento
    WHERE bar_id = p_bar_id 
      AND ativo = true 
      AND categoria IN ('bebidas', 'drinks', 'comidas')
  LOOP
    IF v_loc = ANY(SELECT LOWER(x) FROM unnest(v_rec.locais) x) THEN
      RETURN CASE v_rec.categoria
        WHEN 'bebidas' THEN 'BEBIDA'
        WHEN 'drinks' THEN 'DRINK'
        WHEN 'comidas' THEN 'COMIDA'
      END;
    END IF;
  END LOOP;

  IF v_loc IN ('preshh', 'montados', 'mexido', 'drinks', 'drinks autorais', 'shot e dose', 'batidos') THEN
    RETURN 'DRINK';
  ELSIF v_loc IN ('cozinha', 'cozinha 1', 'cozinha 2') THEN
    RETURN 'COMIDA';
  ELSIF v_loc IN ('chopp', 'bar', 'pegue e pague', 'venda volante', 'baldes', 'pp', 'salao') THEN
    RETURN 'BEBIDA';
  END IF;

  RETURN NULL;
END;
$function$;
