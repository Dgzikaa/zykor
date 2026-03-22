-- Função: agora_brasil
-- Retorna timestamp atual no fuso horário de São Paulo

CREATE OR REPLACE FUNCTION public.agora_brasil()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RETURN NOW() AT TIME ZONE 'America/Sao_Paulo';
END;
$function$;
