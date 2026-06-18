-- 2026-06-18 — CMV Mensal: estoque inicial de alimentação (funcionários) rolante.
-- O agregar_cmv_mensal_auto só mantinha o valor existente (default 0) — nunca herdava
-- o final do mês anterior. Estoque inicial de funcionários é sempre PROPAGADO (= final
-- do mês anterior; o manual/contagem é o estoque FINAL). Trava no banco força isso em
-- insert/update do cmv_mensal, e corrige o histórico. A tela calcula o CMA a partir disso.

CREATE OR REPLACE FUNCTION financial.fn_rola_estoque_inicial_func()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'financial','pg_catalog' AS $fn$
DECLARE v_prev numeric;
BEGIN
  SELECT estoque_final_funcionarios INTO v_prev FROM financial.cmv_mensal
   WHERE bar_id=NEW.bar_id AND (ano*12+mes)=(NEW.ano*12+NEW.mes-1);
  IF v_prev IS NOT NULL THEN NEW.estoque_inicial_funcionarios := v_prev; END IF;
  RETURN NEW;
END;$fn$;

DROP TRIGGER IF EXISTS trg_rola_estoque_inicial_func ON financial.cmv_mensal;
CREATE TRIGGER trg_rola_estoque_inicial_func BEFORE INSERT OR UPDATE ON financial.cmv_mensal
FOR EACH ROW EXECUTE FUNCTION financial.fn_rola_estoque_inicial_func();

-- corrige o histórico
UPDATE financial.cmv_mensal m SET estoque_inicial_funcionarios = prev.estoque_final_funcionarios
FROM financial.cmv_mensal prev
WHERE prev.bar_id=m.bar_id AND (prev.ano*12+prev.mes)=(m.ano*12+m.mes-1)
  AND m.estoque_inicial_funcionarios IS DISTINCT FROM prev.estoque_final_funcionarios;
