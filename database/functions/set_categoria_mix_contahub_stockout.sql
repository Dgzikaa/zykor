-- Função: set_categoria_mix_contahub_stockout (trigger function)
-- Define categoria_mix em contahub_stockout

CREATE OR REPLACE FUNCTION public.set_categoria_mix_contahub_stockout()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.categoria_mix := public.map_categoria_mix(NEW.bar_id, NEW.loc_desc);
  RETURN NEW;
END;
$function$;
