-- Função: get_locais_por_categoria
CREATE OR REPLACE FUNCTION public.get_locais_por_categoria(p_bar_id integer, p_categoria character varying) RETURNS text[] LANGUAGE plpgsql STABLE
AS $$ DECLARE v_locais TEXT[]; BEGIN SELECT locais INTO v_locais FROM bar_local_mapeamento WHERE bar_id = p_bar_id AND categoria = p_categoria AND ativo = TRUE; RETURN COALESCE(v_locais, ARRAY[]::TEXT[]); END; $$;
