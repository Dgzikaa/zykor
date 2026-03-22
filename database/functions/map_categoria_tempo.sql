-- Função: map_categoria_tempo (trigger function)
-- Mapeia categoria baseado em loc_desc para contahub_tempo

CREATE OR REPLACE FUNCTION public.map_categoria_tempo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.categoria := CASE 
        WHEN NEW.loc_desc = 'Preshh' THEN 'drink'
        WHEN NEW.loc_desc = 'Chopp' THEN 'bebida'
        WHEN NEW.loc_desc = 'Montados' THEN 'drink'
        WHEN NEW.loc_desc = 'Cozinha' THEN 'comida'
        WHEN NEW.loc_desc = 'Baldes' THEN 'bebida'
        WHEN NEW.loc_desc = 'Cozinha 1' THEN 'comida'
        WHEN NEW.loc_desc = 'Mexido' THEN 'drink'
        WHEN NEW.loc_desc = 'Drinks' THEN 'drink'
        WHEN NEW.loc_desc = 'Drinks Autorais' THEN 'drink'
        WHEN NEW.loc_desc = 'Pegue e Pague' THEN 'bebida'
        WHEN NEW.loc_desc = 'Venda Volante' THEN 'bebida'
        WHEN NEW.loc_desc = 'Cozinha 2' THEN 'comida'
        WHEN NEW.loc_desc = 'Bar' THEN 'bebida'
        WHEN NEW.loc_desc = 'Shot e Dose' THEN 'drink'
        WHEN NEW.loc_desc = 'Batidos' THEN 'drink'
        ELSE 'outros'
    END;
    
    RETURN NEW;
END;
$function$;
