-- Função: bloquear_dados_antigos
CREATE OR REPLACE FUNCTION public.bloquear_dados_antigos(p_bar_id integer DEFAULT 3) RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_data_limite DATE; v_count INTEGER := 0; v_data DATE;
BEGIN
    v_data_limite := CURRENT_DATE - INTERVAL '7 days';
    FOR v_data IN SELECT DISTINCT data_evento FROM eventos_base WHERE bar_id = p_bar_id AND data_evento < v_data_limite AND NOT EXISTS (SELECT 1 FROM dados_bloqueados WHERE tabela = 'eventos_base' AND data_referencia = eventos_base.data_evento AND dados_bloqueados.bar_id = p_bar_id) LOOP
        INSERT INTO dados_bloqueados (tabela, data_referencia, bar_id, motivo) VALUES ('eventos_base', v_data, p_bar_id, 'Bloqueio automático após 7 dias') ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    RETURN 'Bloqueados ' || v_count || ' dias anteriores a ' || v_data_limite;
END;
$$;
