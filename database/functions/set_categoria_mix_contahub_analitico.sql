-- Função: set_categoria_mix_contahub_analitico (trigger function)
-- Define categoria_mix em contahub_analitico

CREATE OR REPLACE FUNCTION public.set_categoria_mix_contahub_analitico()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.categoria_mix := public.map_categoria_mix(NEW.bar_id, NEW.loc_desc);
  RETURN NEW;
END;
$function$;
