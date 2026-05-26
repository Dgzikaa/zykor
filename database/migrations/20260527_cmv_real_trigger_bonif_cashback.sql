-- Aplicada via MCP em 2026-05-27.
-- Estende trigger trg_cmv_semanal_recalc_real (#79) pra recalcular cmv_real quando
-- bonificacao_cashback_mensal mudar (antes so monitorava bonificacao_contrato_anual).
--
-- Formula final (decisao confirmada pelo socio):
--   cmv_real = est_ini + compras_cmv - est_fim - consumos
--              + (bonificacao_contrato_anual + bonificacao_cashback_mensal)
--
-- Bonificacoes SOMAM porque vem como produto extra (estoque inflado).
--
-- Caso real S21/2026 Ord: bonif_cashback=R\$17.303,54 preenchida via UI
--   antes: cmv_real R\$54.242,73 (nao incluia cashback)
--   depois: cmv_real R\$71.546,27 (inclui)

CREATE OR REPLACE FUNCTION financial.fn_cmv_semanal_recalc_real()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_compras_cmv NUMERIC;
  v_consumos NUMERIC;
  v_bonificacoes NUMERIC;
  v_cmv_real NUMERIC;
BEGIN
  v_compras_cmv := COALESCE(NEW.compras_custo_comida, 0)
                 + COALESCE(NEW.compras_custo_bebidas, 0)
                 + COALESCE(NEW.compras_custo_drinks, 0);

  v_consumos := COALESCE(NEW.consumo_socios, 0)
              + COALESCE(NEW.consumo_beneficios, 0)
              + COALESCE(NEW.consumo_artista, 0)
              + COALESCE(NEW.consumo_rh, 0)
              + COALESCE(NEW.outros_ajustes, 0);

  v_bonificacoes := COALESCE(NEW.bonificacao_contrato_anual, 0)
                  + COALESCE(NEW.bonificacao_cashback_mensal, 0);

  v_cmv_real := COALESCE(NEW.estoque_inicial, 0)
              + v_compras_cmv
              - COALESCE(NEW.estoque_final, 0)
              - v_consumos
              + v_bonificacoes;

  NEW.cmv_real := v_cmv_real;

  IF COALESCE(NEW.faturamento_cmvivel, 0) > 0 THEN
    NEW.cmv_limpo_percentual := (v_cmv_real / NEW.faturamento_cmvivel) * 100;
  ELSE
    NEW.cmv_limpo_percentual := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cmv_semanal_recalc_real ON financial.cmv_semanal;

CREATE TRIGGER trg_cmv_semanal_recalc_real
BEFORE INSERT OR UPDATE OF
  estoque_inicial, estoque_final,
  compras_custo_comida, compras_custo_bebidas, compras_custo_drinks,
  consumo_socios, consumo_beneficios, consumo_artista, consumo_rh, outros_ajustes,
  bonificacao_contrato_anual, bonificacao_cashback_mensal,
  faturamento_cmvivel
ON financial.cmv_semanal
FOR EACH ROW
EXECUTE FUNCTION financial.fn_cmv_semanal_recalc_real();
