-- 2026-06-14 — Bonificações unificadas (decisão do sócio).
-- Antes: dois campos separados (bonificacao_contrato_anual + bonificacao_cashback_mensal)
-- que a UI obrigava a "expandir" pra preencher. Agora: UM campo só `bonificacoes`,
-- preenchido direto, sem expandir.
--
-- Histórico preservado: backfill bonificacoes = contrato_anual + cashback_mensal em
-- todas as linhas já preenchidas. As colunas antigas FICAM no banco como backup
-- (não aparecem mais na UI e saem da fórmula).
--
-- Semântica (igual ao semanal de hoje): bonificações SOMAM no CMV real (produto extra
-- = estoque inflado).

-- 1) Coluna unificada nas duas tabelas
ALTER TABLE financial.cmv_semanal ADD COLUMN IF NOT EXISTS bonificacoes numeric DEFAULT 0;
ALTER TABLE financial.cmv_mensal  ADD COLUMN IF NOT EXISTS bonificacoes numeric DEFAULT 0;

-- 2) Backfill do histórico (soma os dois campos antigos). Só onde ainda está nulo/zero,
--    pra ser idempotente e não estourar valores já consolidados em re-execução.
UPDATE financial.cmv_semanal
SET bonificacoes = COALESCE(bonificacao_contrato_anual, 0) + COALESCE(bonificacao_cashback_mensal, 0)
WHERE COALESCE(bonificacoes, 0) = 0
  AND (COALESCE(bonificacao_contrato_anual, 0) + COALESCE(bonificacao_cashback_mensal, 0)) <> 0;

UPDATE financial.cmv_mensal
SET bonificacoes = COALESCE(bonificacao_contrato_anual, 0) + COALESCE(bonificacao_cashback_mensal, 0)
WHERE COALESCE(bonificacoes, 0) = 0
  AND (COALESCE(bonificacao_contrato_anual, 0) + COALESCE(bonificacao_cashback_mensal, 0)) <> 0;

-- 3) Trigger semanal passa a usar `bonificacoes` (fallback p/ colunas legadas durante transição).
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

  -- Campo unificado; fallback p/ legados enquanto a UI antiga não some de vez.
  v_bonificacoes := COALESCE(NEW.bonificacoes,
                      COALESCE(NEW.bonificacao_contrato_anual, 0)
                    + COALESCE(NEW.bonificacao_cashback_mensal, 0));

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
  bonificacoes, bonificacao_contrato_anual, bonificacao_cashback_mensal,
  faturamento_cmvivel
ON financial.cmv_semanal
FOR EACH ROW
EXECUTE FUNCTION financial.fn_cmv_semanal_recalc_real();
