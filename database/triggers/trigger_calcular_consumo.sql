-- Trigger: trigger_calcular_consumo
-- Calcula consumo automático em contagem_estoque_insumos

CREATE TRIGGER trigger_calcular_consumo
BEFORE INSERT OR UPDATE ON contagem_estoque_insumos
FOR EACH ROW
EXECUTE FUNCTION calcular_consumo_insumo();
