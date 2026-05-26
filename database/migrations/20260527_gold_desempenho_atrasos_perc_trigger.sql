-- Aplicada via MCP em 2026-05-27.
-- Resolve task #86: atrasinhos_cozinha_perc e atrasos_cozinha_perc ficavam 0/null
-- porque o ETL etl_gold_desempenho_semanal so populava atrasos_drinks_perc e
-- atrasos_comida_perc (que sao iguais a atrasos_bar_perc e atrasos_cozinha_perc).
--
-- Trigger BEFORE INSERT/UPDATE recalcula os 6 %s sempre que contadores
-- absolutos (atrasinho_*/atrasao_*) ou qtd_*_total mudarem.

CREATE OR REPLACE FUNCTION gold.fn_desempenho_recalc_atrasos_perc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- DRINKS / BAR
  IF COALESCE(NEW.qtd_drinks_total, 0) > 0 THEN
    NEW.atrasinhos_bar_perc := ROUND((COALESCE(NEW.atrasinho_drinks, 0)::numeric / NEW.qtd_drinks_total * 100), 2);
    NEW.atrasos_bar_perc := ROUND((COALESCE(NEW.atrasao_drinks, 0)::numeric / NEW.qtd_drinks_total * 100), 2);
    NEW.atrasos_drinks_perc := NEW.atrasos_bar_perc;
  ELSE
    NEW.atrasinhos_bar_perc := 0;
    NEW.atrasos_bar_perc := 0;
    NEW.atrasos_drinks_perc := 0;
  END IF;

  -- COMIDA / COZINHA
  IF COALESCE(NEW.qtd_comida_total, 0) > 0 THEN
    NEW.atrasinhos_cozinha_perc := ROUND((COALESCE(NEW.atrasinho_cozinha, 0)::numeric / NEW.qtd_comida_total * 100), 2);
    NEW.atrasos_cozinha_perc := ROUND((COALESCE(NEW.atrasao_cozinha, 0)::numeric / NEW.qtd_comida_total * 100), 2);
    NEW.atrasos_comida_perc := NEW.atrasos_cozinha_perc;
  ELSE
    NEW.atrasinhos_cozinha_perc := 0;
    NEW.atrasos_cozinha_perc := 0;
    NEW.atrasos_comida_perc := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desempenho_recalc_atrasos_perc ON gold.desempenho;

CREATE TRIGGER trg_desempenho_recalc_atrasos_perc
BEFORE INSERT OR UPDATE OF
  atrasinho_cozinha, atrasao_cozinha, atrasinho_drinks, atrasao_drinks, atrasao_bar,
  qtd_comida_total, qtd_drinks_total
ON gold.desempenho
FOR EACH ROW
EXECUTE FUNCTION gold.fn_desempenho_recalc_atrasos_perc();
