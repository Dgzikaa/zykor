-- Trigger: trigger_calculate_metrics
-- Calcula ticket_medio e atingimento em desempenho_semanal

CREATE TRIGGER trigger_calculate_metrics
BEFORE INSERT OR UPDATE ON desempenho_semanal
FOR EACH ROW
EXECUTE FUNCTION calculate_ticket_medio();
