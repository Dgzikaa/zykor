-- Função: eh_ultimo_dia_mes
-- Verifica se a data é o último dia do mês

CREATE OR REPLACE FUNCTION public.eh_ultimo_dia_mes(p_data date DEFAULT CURRENT_DATE)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN p_data = (DATE_TRUNC('month', p_data) + INTERVAL '1 month - 1 day')::DATE;
END;
$function$;
