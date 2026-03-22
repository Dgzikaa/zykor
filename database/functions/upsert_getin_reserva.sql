-- Função: upsert_getin_reserva (duas versões)
CREATE OR REPLACE FUNCTION public.upsert_getin_reserva(p_nome_cliente text, p_data_reserva date, p_horario text, p_pessoas integer, p_status text, p_observacoes text DEFAULT '', p_telefone text DEFAULT '', p_email text DEFAULT '', p_mesa text DEFAULT '', p_origem text DEFAULT 'getin_auto', p_dados_brutos jsonb DEFAULT '{}', p_external_id text DEFAULT NULL)
 RETURNS TABLE(inserted boolean, reserva_id bigint) LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_reserva_id BIGINT; v_inserted BOOLEAN := FALSE;
BEGIN
    SELECT id INTO v_reserva_id FROM getin_reservas WHERE cliente_nome = p_nome_cliente AND data_reserva = p_data_reserva AND hora_reserva = p_horario::time AND (external_id = p_external_id OR (external_id IS NULL AND p_external_id IS NULL)) LIMIT 1;
    IF v_reserva_id IS NULL THEN
        INSERT INTO getin_reservas (cliente_nome, data_reserva, hora_reserva, numero_pessoas, status, observacoes, cliente_telefone, cliente_email, mesa_numero, origem, dados_brutos, external_id, sync_timestamp)
        VALUES (p_nome_cliente, p_data_reserva, p_horario::time, p_pessoas, p_status, p_observacoes, p_telefone, p_email, p_mesa, p_origem, p_dados_brutos, p_external_id, NOW()) RETURNING id INTO v_reserva_id;
        v_inserted := TRUE;
    ELSE
        UPDATE getin_reservas SET numero_pessoas = p_pessoas, status = p_status, observacoes = p_observacoes, cliente_telefone = p_telefone, cliente_email = p_email, mesa_numero = p_mesa, dados_brutos = p_dados_brutos, sync_timestamp = NOW() WHERE id = v_reserva_id;
        v_inserted := FALSE;
    END IF;
    RETURN QUERY SELECT v_inserted, v_reserva_id;
END;
$$;
