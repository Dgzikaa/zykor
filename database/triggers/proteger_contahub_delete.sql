-- PROTECAO: Bloquear DELETE em tabelas ContaHub e dados de clientes
-- Dados historicos NUNCA devem ser excluidos - sao a base do negocio.
-- O cron purgar_staging_antigo foi desabilitado e esta funcao impede
-- qualquer tentativa futura de delete em massa.

CREATE OR REPLACE FUNCTION proteger_contahub_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DELETE bloqueado em %. Dados historicos do ContaHub nao podem ser excluidos. Contate o administrador.', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

-- contahub_periodo
DROP TRIGGER IF EXISTS proteger_delete ON contahub_periodo;
CREATE TRIGGER proteger_delete BEFORE DELETE ON contahub_periodo
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();

-- contahub_analitico
DROP TRIGGER IF EXISTS proteger_delete ON contahub_analitico;
CREATE TRIGGER proteger_delete BEFORE DELETE ON contahub_analitico
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();

-- contahub_tempo
DROP TRIGGER IF EXISTS proteger_delete ON contahub_tempo;
CREATE TRIGGER proteger_delete BEFORE DELETE ON contahub_tempo
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();

-- contahub_pagamentos
DROP TRIGGER IF EXISTS proteger_delete ON contahub_pagamentos;
CREATE TRIGGER proteger_delete BEFORE DELETE ON contahub_pagamentos
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();

-- contahub_fatporhora
DROP TRIGGER IF EXISTS proteger_delete ON contahub_fatporhora;
CREATE TRIGGER proteger_delete BEFORE DELETE ON contahub_fatporhora
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();

-- visitas (domain table)
DROP TRIGGER IF EXISTS proteger_delete ON visitas;
CREATE TRIGGER proteger_delete BEFORE DELETE ON visitas
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();

-- cliente_estatisticas (cache de clientes)
DROP TRIGGER IF EXISTS proteger_delete ON cliente_estatisticas;
CREATE TRIGGER proteger_delete BEFORE DELETE ON cliente_estatisticas
  FOR EACH STATEMENT EXECUTE FUNCTION proteger_contahub_delete();
