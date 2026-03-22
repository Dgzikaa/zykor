-- Função: normalizar_telefone
CREATE OR REPLACE FUNCTION public.normalizar_telefone(telefone text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $$
DECLARE apenas_numeros TEXT;
BEGIN
  IF telefone IS NULL OR TRIM(telefone) = '' THEN RETURN ''; END IF;
  apenas_numeros := REGEXP_REPLACE(telefone, '[^0-9]', '', 'g');
  IF apenas_numeros = '' THEN RETURN ''; END IF;
  IF LENGTH(apenas_numeros) >= 11 THEN RETURN RIGHT(apenas_numeros, 11); ELSE RETURN apenas_numeros; END IF;
END;
$$;
