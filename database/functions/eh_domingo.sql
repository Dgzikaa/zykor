-- Função: eh_domingo
-- Verifica se hoje é domingo

CREATE OR REPLACE FUNCTION public.eh_domingo()
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXTRACT(DOW FROM CURRENT_DATE) = 0;
END;
$function$;
