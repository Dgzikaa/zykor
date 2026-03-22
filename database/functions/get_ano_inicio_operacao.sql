CREATE OR REPLACE FUNCTION public.get_ano_inicio_operacao(p_bar_id integer)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT ano_inicio_operacao
  FROM bar_regras_negocio
  WHERE bar_id = p_bar_id
  LIMIT 1;
$function$;
