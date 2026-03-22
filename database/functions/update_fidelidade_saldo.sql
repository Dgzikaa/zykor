-- Função: update_fidelidade_saldo (trigger)
CREATE OR REPLACE FUNCTION public.update_fidelidade_saldo() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO fidelidade_saldos (membro_id, saldo_atual, ultima_atualizacao) VALUES (NEW.membro_id, CASE WHEN NEW.tipo IN ('credito', 'bonus') THEN NEW.valor ELSE -NEW.valor END, NOW())
  ON CONFLICT (membro_id) DO UPDATE SET saldo_atual = fidelidade_saldos.saldo_atual + CASE WHEN NEW.tipo IN ('credito', 'bonus') THEN NEW.valor ELSE -NEW.valor END, ultima_atualizacao = NOW();
  RETURN NEW;
END;
$$;
