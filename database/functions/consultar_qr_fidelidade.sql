-- Função: consultar_qr_fidelidade
CREATE OR REPLACE FUNCTION public.consultar_qr_fidelidade(p_qr_token character varying, p_bar_id integer DEFAULT 3, p_funcionario_id uuid DEFAULT NULL, p_ip_origem inet DEFAULT NULL) RETURNS json LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_membro_id UUID; v_membro_dados JSON; v_saldo_atual NUMERIC; v_resultado JSON;
BEGIN
    SELECT m.id, json_build_object('id', m.id, 'nome', m.nome, 'email', m.email, 'plano', m.plano, 'status', m.status, 'bar_id', m.bar_id, 'data_adesao', m.data_adesao) INTO v_membro_id, v_membro_dados FROM fidelidade_membros m WHERE m.qr_code_token = p_qr_token AND m.bar_id = p_bar_id;
    IF v_membro_id IS NULL THEN
        INSERT INTO fidelidade_qr_scanner_logs (qr_token, acao, resultado, bar_id, funcionario_id, ip_origem) VALUES (p_qr_token, 'token_invalido', json_build_object('error', 'QR Code não encontrado'), p_bar_id, p_funcionario_id, p_ip_origem);
        RETURN json_build_object('success', false, 'error', 'QR Code inválido ou não pertence a este estabelecimento');
    END IF;
    SELECT saldo_atual INTO v_saldo_atual FROM fidelidade_saldos WHERE membro_id = v_membro_id;
    SELECT json_build_object('success', true, 'membro', v_membro_dados, 'saldo_atual', COALESCE(v_saldo_atual, 0), 'pode_usar', (COALESCE(v_saldo_atual, 0) > 0), 'timestamp', NOW()) INTO v_resultado;
    INSERT INTO fidelidade_qr_scanner_logs (qr_token, membro_id, acao, resultado, bar_id, funcionario_id, ip_origem) VALUES (p_qr_token, v_membro_id, 'consulta', v_resultado, p_bar_id, p_funcionario_id, p_ip_origem);
    RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
