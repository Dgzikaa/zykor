-- Trigger: trigger_fill_semana
-- Preenche automaticamente o campo semana baseado em data_evento

CREATE TRIGGER trigger_fill_semana
BEFORE INSERT OR UPDATE ON eventos_base
FOR EACH ROW
EXECUTE FUNCTION fill_semana_on_insert();
