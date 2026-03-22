-- Função: aplicar_desconto_qr
-- Descrição: Aplica desconto via QR code no programa de fidelidade
CREATE OR REPLACE FUNCTION public.aplicar_desconto_qr(p_qr_token character varying, p_valor_desconto numeric, p_funcionario_id uuid DEFAULT NULL, p_bar_id integer DEFAULT 3)
 RETURNS json LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_membro_id UUID; v_nome_membro VARCHAR; v_saldo_atual NUMERIC; v_transacao_id UUID;
BEGIN
    SELECT id, nome INTO v_membro_id, v_nome_membro FROM fidelidade_membros WHERE qr_code_token = p_qr_token AND status = 'ativo' AND bar_id = p_bar_id;
    IF v_membro_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'QR Code inválido ou membro inativo'); END IF;
    SELECT saldo_atual INTO v_saldo_atual FROM fidelidade_saldos WHERE membro_id = v_membro_id;
    IF COALESCE(v_saldo_atual, 0) < p_valor_desconto THEN
        RETURN json_build_object('success', false, 'error', 'Saldo insuficiente', 'saldo_atual', COALESCE(v_saldo_atual, 0), 'valor_solicitado', p_valor_desconto, 'membro_nome', v_nome_membro);
    END IF;
    INSERT INTO fidelidade_transacoes (membro_id, tipo, valor, descricao, aprovado_por, bar_id, origem, status) VALUES (v_membro_id, 'desconto', -p_valor_desconto, 'Desconto aplicado via QR Scanner', p_funcionario_id, p_bar_id, 'qr_scanner', 'concluida') RETURNING id INTO v_transacao_id;
    SELECT saldo_atual INTO v_saldo_atual FROM fidelidade_saldos WHERE membro_id = v_membro_id;
    RETURN json_build_object('success', true, 'membro_id', v_membro_id, 'membro_nome', v_nome_membro, 'transacao_id', v_transacao_id, 'valor_desconto', p_valor_desconto, 'saldo_anterior', v_saldo_atual + p_valor_desconto, 'saldo_atual', v_saldo_atual, 'timestamp', NOW());
EXCEPTION WHEN OTHERS THEN RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
