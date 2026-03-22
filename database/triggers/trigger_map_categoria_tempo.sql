-- Trigger: trigger_map_categoria_tempo
-- Mapeia categoria em contahub_tempo

CREATE TRIGGER trigger_map_categoria_tempo
BEFORE INSERT OR UPDATE ON contahub_tempo
FOR EACH ROW
EXECUTE FUNCTION map_categoria_tempo();
