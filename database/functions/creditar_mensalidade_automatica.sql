-- Função: creditar_mensalidade_automatica
CREATE OR REPLACE FUNCTION public.creditar_mensalidade_automatica() RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE membro RECORD;
BEGIN
  FOR membro IN SELECT id, credito_mensal, nome FROM fidelidade_membros WHERE status = 'ativo' AND DATE_TRUNC('month', proxima_cobranca) = DATE_TRUNC('month', CURRENT_DATE) LOOP
    INSERT INTO fidelidade_transacoes (membro_id, tipo, valor, descricao) VALUES (membro.id, 'credito', membro.credito_mensal, 'Crédito mensal automático');
    UPDATE fidelidade_membros SET proxima_cobranca = proxima_cobranca + INTERVAL '1 month' WHERE id = membro.id;
  END LOOP;
END;
$$;
