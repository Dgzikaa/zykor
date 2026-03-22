CREATE OR REPLACE FUNCTION public.get_metas_dia(p_bar_id integer, p_dia_semana integer)
 RETURNS TABLE(meta_m1 numeric, te_plan numeric, tb_plan numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT meta_m1, te_plan, tb_plan
  FROM bar_metas_periodo
  WHERE bar_id = p_bar_id AND dia_semana = p_dia_semana
  LIMIT 1;
$function$;
