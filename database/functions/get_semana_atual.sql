-- Função: get_semana_atual
-- Retorna informações da semana atual (ano, número, data início/fim)

CREATE OR REPLACE FUNCTION public.get_semana_atual()
 RETURNS TABLE(ano integer, numero_semana integer, data_inicio date, data_fim date)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  hoje DATE := CURRENT_DATE;
  ano_atual INTEGER := EXTRACT(YEAR FROM hoje);
  dia_semana INTEGER := EXTRACT(DOW FROM hoje);
  inicio DATE;
  fim DATE;
  num_semana INTEGER;
BEGIN
  inicio := hoje - (dia_semana || ' days')::INTERVAL;
  fim := inicio + INTERVAL '6 days';
  num_semana := EXTRACT(WEEK FROM hoje);
  
  RETURN QUERY SELECT ano_atual, num_semana, inicio, fim;
END;
$function$;
