-- Função: safe_numeric
-- Converte texto para numeric de forma segura (retorna 0 em caso de erro)

CREATE OR REPLACE FUNCTION public.safe_numeric(text_val text)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN CASE 
        WHEN text_val IS NULL OR text_val = '' THEN 0
        WHEN text_val ~ '^\d+\.?\d*$$' THEN text_val::numeric
        ELSE 0
    END;
EXCEPTION WHEN others THEN
    RETURN 0;
END;
$function$;
