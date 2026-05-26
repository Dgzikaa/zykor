-- Migration aplicada via MCP em 2026-05-26
-- Resolve task #79: cmv_real ficava stale quando estoque_final era atualizado
-- depois do cron rodar (contagem dominical chega depois das 19h do domingo).
--
-- Caso real: S21/2026 Ord (18-24/05). Cron rodou no domingo a noite, depois
-- a contagem do estoque foi atualizada via planilha. Resultado: cmv_real
-- ficou R$71.458 (stale) quando o correto era R$40.826.
--
-- Backfill executado: 93 rows recalculadas, 0 diff residual.

CREATE OR REPLACE FUNCTION financial.fn_cmv_semanal_recalc_real()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_compras_cmv NUMERIC;
  v_consumos NUMERIC;
  v_cmv_real NUMERIC;
BEGIN
  -- Compras CMV total = comida + bebidas + drinks (exclui 'outros' que nao geram CMV)
  v_compras_cmv := COALESCE(NEW.compras_custo_comida, 0)
                 + COALESCE(NEW.compras_custo_bebidas, 0)
                 + COALESCE(NEW.compras_custo_drinks, 0);

  -- Consumos ja vem com fator aplicado nas colunas consumo_*
  v_consumos := COALESCE(NEW.consumo_socios, 0)
              + COALESCE(NEW.consumo_beneficios, 0)
              + COALESCE(NEW.consumo_artista, 0)
              + COALESCE(NEW.consumo_rh, 0)
              + COALESCE(NEW.outros_ajustes, 0);

  -- CMV Real = Est. Inicial + Compras CMV - Est. Final - Consumos + Bonificacoes
  v_cmv_real := COALESCE(NEW.estoque_inicial, 0)
              + v_compras_cmv
              - COALESCE(NEW.estoque_final, 0)
              - v_consumos
              + COALESCE(NEW.bonificacao_contrato_anual, 0);

  NEW.cmv_real := v_cmv_real;

  -- CMV Limpo % = CMV Real / Faturamento Liquido * 100
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
  bonificacao_contrato_anual, faturamento_cmvivel
ON financial.cmv_semanal
FOR EACH ROW
EXECUTE FUNCTION financial.fn_cmv_semanal_recalc_real();

COMMENT ON FUNCTION financial.fn_cmv_semanal_recalc_real() IS
  'Recalcula cmv_real e cmv_limpo_percentual sempre que algum input muda. Garante consistencia entre todos os write paths (cron, planilha, edicao manual).';
