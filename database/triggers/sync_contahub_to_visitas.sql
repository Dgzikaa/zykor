-- Trigger: Sincronizar contahub_periodo -> visitas automaticamente
-- Toda vez que um registro entra ou é atualizado em contahub_periodo,
-- ele é espelhado automaticamente na tabela domain visitas.

CREATE OR REPLACE FUNCTION sync_contahub_periodo_to_visitas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ignorar registros sem data
  IF NEW.dt_gerencial IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO visitas (
    bar_id, data_visita, cliente_nome, cliente_fone, cliente_email, cliente_dtnasc,
    pessoas, valor_pagamentos, valor_consumo, valor_produtos,
    valor_couvert, valor_desconto, valor_repique, mesa_desc,
    motivo_desconto, origem, origem_ref, updated_at
  )
  VALUES (
    NEW.bar_id, NEW.dt_gerencial, NEW.cli_nome, NEW.cli_fone, NEW.cli_email, NEW.cli_dtnasc,
    COALESCE(NEW.pessoas, 1),
    COALESCE(NEW.vr_pagamentos, 0),
    COALESCE(NEW.vr_pagamentos, 0) - COALESCE(NEW.vr_couvert, 0),
    COALESCE(NEW.vr_produtos, 0),
    COALESCE(NEW.vr_couvert, 0),
    COALESCE(NEW.vr_desconto, 0),
    COALESCE(NEW.vr_repique, 0),
    NEW.vd_mesadesc,
    NEW.motivo,
    'contahub',
    NEW.id,
    NOW()
  )
  ON CONFLICT (bar_id, origem, origem_ref)
  DO UPDATE SET
    cliente_nome = EXCLUDED.cliente_nome,
    cliente_fone = EXCLUDED.cliente_fone,
    cliente_email = EXCLUDED.cliente_email,
    cliente_dtnasc = EXCLUDED.cliente_dtnasc,
    pessoas = EXCLUDED.pessoas,
    valor_pagamentos = EXCLUDED.valor_pagamentos,
    valor_consumo = EXCLUDED.valor_consumo,
    valor_produtos = EXCLUDED.valor_produtos,
    valor_couvert = EXCLUDED.valor_couvert,
    valor_desconto = EXCLUDED.valor_desconto,
    valor_repique = EXCLUDED.valor_repique,
    mesa_desc = EXCLUDED.mesa_desc,
    motivo_desconto = EXCLUDED.motivo_desconto,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_visitas ON contahub_periodo;
CREATE TRIGGER trg_sync_visitas
  AFTER INSERT OR UPDATE ON contahub_periodo
  FOR EACH ROW
  EXECUTE FUNCTION sync_contahub_periodo_to_visitas();
