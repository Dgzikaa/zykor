-- Função: set_posicao_fila (trigger)
CREATE OR REPLACE FUNCTION public.set_posicao_fila() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.posicao_fila IS NULL THEN SELECT COALESCE(MAX(posicao_fila), 0) + 1 INTO NEW.posicao_fila FROM fidelidade_lista_espera WHERE bar_id = NEW.bar_id; END IF;
    RETURN NEW;
END;
$$;
