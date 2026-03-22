-- Função: limpar_valor_monetario
CREATE OR REPLACE FUNCTION public.limpar_valor_monetario(valor_texto text) RETURNS numeric LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
    IF valor_texto IS NULL OR valor_texto = '' OR valor_texto = '-' THEN RETURN NULL; END IF;
    valor_texto := REPLACE(valor_texto, 'R$', ''); valor_texto := REPLACE(valor_texto, ' ', ''); valor_texto := REPLACE(valor_texto, '.', ''); valor_texto := REPLACE(valor_texto, ',', '.');
    IF LEFT(valor_texto, 1) = '-' THEN valor_texto := REPLACE(valor_texto, '-', ''); RETURN -CAST(valor_texto AS DECIMAL(15,2)); END IF;
    RETURN CAST(valor_texto AS DECIMAL(15,2));
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
