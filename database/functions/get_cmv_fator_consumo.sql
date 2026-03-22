CREATE OR REPLACE FUNCTION public.get_cmv_fator_consumo(p_bar_id integer)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(cmv_fator_consumo, 0.35)
  FROM bar_regras_negocio
  WHERE bar_id = p_bar_id
  LIMIT 1;
$function$;
