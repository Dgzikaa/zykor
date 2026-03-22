-- Função: limpar_auditoria_antiga
CREATE OR REPLACE FUNCTION public.limpar_auditoria_antiga(dias_manter integer DEFAULT 90) RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE registros_deletados INTEGER;
BEGIN
  DELETE FROM eventos_base_auditoria WHERE data_alteracao < NOW() - (dias_manter || ' days')::INTERVAL;
  GET DIAGNOSTICS registros_deletados = ROW_COUNT;
  RETURN format('Deletados %s registros de auditoria (mais de %s dias)', registros_deletados, dias_manter);
END;
$$;
