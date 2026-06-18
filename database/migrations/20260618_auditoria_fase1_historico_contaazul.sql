-- 2026-06-18 — Auditoria Fase 1: histórico de mudanças dos lançamentos do Conta Azul.
-- O bronze é upsert (sobrescreve); data_alteracao_ca diz QUANDO mudou, não O QUE.
-- Trigger captura o DIFF (de->para) dos campos-chave a cada mudança, daqui pra frente.
-- Base para: detectar preenchimento atrasado/retroativo e responder "o que mudou e por quê".

CREATE TABLE IF NOT EXISTS bronze.contaazul_lancamentos_historico (
  id              bigserial PRIMARY KEY,
  contaazul_id    text NOT NULL,
  bar_id          integer,
  data_competencia date,
  categoria_nome  text,
  evento          text NOT NULL,          -- INSERT | UPDATE | EXCLUIDO | REATIVADO
  mudancas        jsonb,                  -- {campo: {de, para}} (nos UPDATE)
  snapshot        jsonb,                  -- valores-chave no INSERT
  alterado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_hist_bar_comp ON bronze.contaazul_lancamentos_historico(bar_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_ca_hist_alterado ON bronze.contaazul_lancamentos_historico(alterado_em);
CREATE INDEX IF NOT EXISTS idx_ca_hist_id ON bronze.contaazul_lancamentos_historico(contaazul_id);

CREATE OR REPLACE FUNCTION bronze.fn_log_contaazul_lancamento_change()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE m jsonb := '{}'::jsonb; v_evento text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bronze.contaazul_lancamentos_historico(contaazul_id,bar_id,data_competencia,categoria_nome,evento,snapshot)
    VALUES (NEW.contaazul_id, NEW.bar_id, NEW.data_competencia, NEW.categoria_nome, 'INSERT',
      jsonb_build_object('categoria_nome',NEW.categoria_nome,'valor_bruto',NEW.valor_bruto,'valor_pago',NEW.valor_pago,
        'data_competencia',NEW.data_competencia,'data_pagamento',NEW.data_pagamento,'tipo',NEW.tipo,'status',NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.categoria_nome   IS DISTINCT FROM OLD.categoria_nome   THEN m := m || jsonb_build_object('categoria_nome',  jsonb_build_object('de',OLD.categoria_nome,'para',NEW.categoria_nome)); END IF;
  IF NEW.valor_bruto      IS DISTINCT FROM OLD.valor_bruto      THEN m := m || jsonb_build_object('valor_bruto',     jsonb_build_object('de',OLD.valor_bruto,'para',NEW.valor_bruto)); END IF;
  IF NEW.valor_pago       IS DISTINCT FROM OLD.valor_pago       THEN m := m || jsonb_build_object('valor_pago',      jsonb_build_object('de',OLD.valor_pago,'para',NEW.valor_pago)); END IF;
  IF NEW.data_competencia IS DISTINCT FROM OLD.data_competencia THEN m := m || jsonb_build_object('data_competencia',jsonb_build_object('de',OLD.data_competencia,'para',NEW.data_competencia)); END IF;
  IF NEW.data_pagamento   IS DISTINCT FROM OLD.data_pagamento   THEN m := m || jsonb_build_object('data_pagamento',  jsonb_build_object('de',OLD.data_pagamento,'para',NEW.data_pagamento)); END IF;
  IF NEW.tipo             IS DISTINCT FROM OLD.tipo             THEN m := m || jsonb_build_object('tipo',            jsonb_build_object('de',OLD.tipo,'para',NEW.tipo)); END IF;
  IF NEW.status           IS DISTINCT FROM OLD.status           THEN m := m || jsonb_build_object('status',          jsonb_build_object('de',OLD.status,'para',NEW.status)); END IF;
  IF NEW.excluido_em      IS DISTINCT FROM OLD.excluido_em      THEN m := m || jsonb_build_object('excluido_em',     jsonb_build_object('de',OLD.excluido_em,'para',NEW.excluido_em)); END IF;
  IF m = '{}'::jsonb THEN RETURN NEW; END IF;
  v_evento := CASE WHEN OLD.excluido_em IS NULL AND NEW.excluido_em IS NOT NULL THEN 'EXCLUIDO'
                   WHEN OLD.excluido_em IS NOT NULL AND NEW.excluido_em IS NULL THEN 'REATIVADO'
                   ELSE 'UPDATE' END;
  INSERT INTO bronze.contaazul_lancamentos_historico(contaazul_id,bar_id,data_competencia,categoria_nome,evento,mudancas)
  VALUES (NEW.contaazul_id, NEW.bar_id, NEW.data_competencia, NEW.categoria_nome, v_evento, m);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_log_contaazul_lancamento ON bronze.bronze_contaazul_lancamentos;
CREATE TRIGGER trg_log_contaazul_lancamento
AFTER INSERT OR UPDATE ON bronze.bronze_contaazul_lancamentos
FOR EACH ROW EXECUTE FUNCTION bronze.fn_log_contaazul_lancamento_change();
