-- Trigger: trigger_salvar_versao_cmo
-- Salva versão histórica quando cmo_semanal é atualizado

CREATE TRIGGER trigger_salvar_versao_cmo
AFTER UPDATE ON cmo_semanal
FOR EACH ROW
EXECUTE FUNCTION salvar_versao_cmo();
