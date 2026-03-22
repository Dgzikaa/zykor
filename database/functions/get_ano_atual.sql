-- Função: get_ano_atual
-- Retorna o ano atual

CREATE OR REPLACE FUNCTION public.get_ano_atual()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXTRACT(YEAR FROM CURRENT_DATE);
END;
$function$;
