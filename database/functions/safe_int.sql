-- Função: safe_int
-- Converte texto para integer de forma segura (retorna 0 em caso de erro)

CREATE OR REPLACE FUNCTION public.safe_int(text_val text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN CASE 
        WHEN text_val IS NULL OR text_val = '' THEN 0
        WHEN text_val ~ '^\d+$$' THEN text_val::integer
        ELSE 0
    END;
EXCEPTION WHEN others THEN
    RETURN 0;
END;
$function$;
