-- Trigger: trigger_validar_ano_desempenho
-- Valida o ano em desempenho_semanal

CREATE TRIGGER trigger_validar_ano_desempenho
BEFORE INSERT OR UPDATE ON desempenho_semanal
FOR EACH ROW
EXECUTE FUNCTION validar_ano_desempenho();
