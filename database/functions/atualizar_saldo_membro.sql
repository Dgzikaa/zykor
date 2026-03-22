-- Função: atualizar_saldo_membro (trigger)
CREATE OR REPLACE FUNCTION public.atualizar_saldo_membro() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.status = 'concluida' THEN
        INSERT INTO fidelidade_saldos (membro_id, saldo_atual, ultima_atualizacao) VALUES (NEW.membro_id, NEW.valor, NOW())
        ON CONFLICT (membro_id) DO UPDATE SET saldo_atual = fidelidade_saldos.saldo_atual + NEW.valor, ultima_atualizacao = NOW();
    END IF;
    RETURN NEW;
END;
$$;
