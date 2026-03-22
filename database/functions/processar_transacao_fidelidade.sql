-- Função: processar_transacao_fidelidade
CREATE OR REPLACE FUNCTION public.processar_transacao_fidelidade(p_membro_id uuid, p_valor numeric, p_tipo character varying, p_descricao text DEFAULT NULL, p_aprovado_por uuid DEFAULT NULL, p_bar_id integer DEFAULT 3, p_origem character varying DEFAULT 'qr_scanner') RETURNS json LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_transacao_id UUID; v_saldo_atual NUMERIC; v_resultado JSON;
BEGIN
    INSERT INTO fidelidade_transacoes (membro_id, tipo, valor, descricao, aprovado_por, bar_id, origem, status) VALUES (p_membro_id, p_tipo, p_valor, p_descricao, p_aprovado_por, p_bar_id, p_origem, 'concluida') RETURNING id INTO v_transacao_id;
    SELECT saldo_atual INTO v_saldo_atual FROM fidelidade_saldos WHERE membro_id = p_membro_id;
    SELECT json_build_object('success', true, 'transacao_id', v_transacao_id, 'saldo_anterior', COALESCE(v_saldo_atual - p_valor, 0), 'valor_transacao', p_valor, 'saldo_atual', COALESCE(v_saldo_atual, 0), 'tipo', p_tipo, 'timestamp', NOW()) INTO v_resultado;
    RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
