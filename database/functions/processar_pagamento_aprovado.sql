-- Função: processar_pagamento_aprovado
CREATE OR REPLACE FUNCTION public.processar_pagamento_aprovado(p_membro_id uuid, p_valor_pagamento numeric, p_credito_mensal numeric DEFAULT 150.00) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_membro_exists BOOLEAN; v_ja_processado BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM fidelidade_membros WHERE id = p_membro_id) INTO v_membro_exists;
    IF NOT v_membro_exists THEN RETURN jsonb_build_object('success', false, 'error', 'Membro não encontrado'); END IF;
    SELECT EXISTS(SELECT 1 FROM fidelidade_membros WHERE id = p_membro_id AND status = 'ativo' AND ultimo_pagamento >= (NOW() - INTERVAL '5 minutes')) INTO v_ja_processado;
    IF v_ja_processado THEN RETURN jsonb_build_object('success', false, 'error', 'Pagamento já processado'); END IF;
    UPDATE fidelidade_membros SET status = 'ativo', ultimo_pagamento = NOW(), proxima_cobranca = (NOW() + INTERVAL '30 days')::DATE, updated_at = NOW() WHERE id = p_membro_id;
    INSERT INTO fidelidade_transacoes (membro_id, tipo, valor, descricao, data_transacao, status) VALUES (p_membro_id, 'credito', p_credito_mensal, 'Crédito mensal - Pagamento aprovado', NOW(), 'concluida');
    UPDATE fidelidade_membros SET saldo_atual = COALESCE(saldo_atual, 0) + p_credito_mensal WHERE id = p_membro_id;
    RETURN jsonb_build_object('success', true, 'membro_id', p_membro_id, 'credito_adicionado', p_credito_mensal);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', 'Erro interno');
END;
$$;
