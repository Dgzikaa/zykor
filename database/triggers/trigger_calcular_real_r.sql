-- Trigger: trigger_calcular_real_r
-- Calcula real_r automaticamente quando eventos_base é atualizado

CREATE TRIGGER trigger_calcular_real_r
BEFORE INSERT OR UPDATE ON eventos_base
FOR EACH ROW
EXECUTE FUNCTION calcular_real_r();
