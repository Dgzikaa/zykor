-- Function: fill_semana_on_insert
-- Exportado de produção em: 2026-03-19
-- Descrição: Trigger function que preenche automaticamente a coluna semana em eventos_base
-- Usado por: trigger em eventos_base

CREATE OR REPLACE FUNCTION public.fill_semana_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se semana não foi preenchida, calcular automaticamente
  IF NEW.semana IS NULL THEN
    NEW.semana := EXTRACT(WEEK FROM NEW.data_evento::date);
  END IF;
  
  RETURN NEW;
END;
$function$;
