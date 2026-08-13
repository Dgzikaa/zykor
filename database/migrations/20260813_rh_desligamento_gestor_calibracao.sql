-- =====================================================================
-- RH — desligamento, organograma (gestor) e calibração (2026-08-13)
-- =====================================================================
-- 1) Desligamento: hoje NENHUM funcionário tem `data_demissao` preenchida
--    (57 inativos no Ordinário, todos sem data e sem motivo). Quem tem o
--    dado é a aba "Tempo de Casa" da planilha Indicadores - RH, que traz
--    admissão, desligamento, se foi voluntário/involuntário e o motivo.
--    As colunas abaixo são o destino desse import.
--
-- 2) Organograma: `gestor_id` aponta para o próprio funcionário a quem a
--    pessoa se reporta. A árvore é derivada disso — some sozinho quando
--    alguém é desligado, e editar = trocar o gestor.
--
-- 3) Calibração: registro manual trimestral de Comportamento e
--    Performance (não existe planilha, só o slide dos cards).
-- =====================================================================

BEGIN;

-- ── 1. Desligamento ──────────────────────────────────────────────────
ALTER TABLE hr.funcionarios
  ADD COLUMN IF NOT EXISTS tipo_desligamento  TEXT,
  ADD COLUMN IF NOT EXISTS motivo_desligamento TEXT;

ALTER TABLE hr.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_tipo_desligamento_check;
ALTER TABLE hr.funcionarios
  ADD CONSTRAINT funcionarios_tipo_desligamento_check
  CHECK (tipo_desligamento IS NULL OR tipo_desligamento IN ('Voluntário', 'Involuntário'));

COMMENT ON COLUMN hr.funcionarios.tipo_desligamento IS
  'Voluntário (pediu) ou Involuntário (empresa desligou). Vem da coluna "Voluntário/Involuntário" da aba Tempo de Casa.';
COMMENT ON COLUMN hr.funcionarios.motivo_desligamento IS
  'Texto livre: Término de Experiência, Acordo, Justa Causa, Transferência… Vem da coluna Motivo/Observação da aba Tempo de Casa.';

CREATE INDEX IF NOT EXISTS idx_funcionarios_bar_demissao
  ON hr.funcionarios (bar_id, data_demissao DESC)
  WHERE data_demissao IS NOT NULL;

-- ── 2. Organograma ───────────────────────────────────────────────────
ALTER TABLE hr.funcionarios
  ADD COLUMN IF NOT EXISTS gestor_id INTEGER;

ALTER TABLE hr.funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_gestor_id_fkey;
ALTER TABLE hr.funcionarios
  ADD CONSTRAINT funcionarios_gestor_id_fkey
  FOREIGN KEY (gestor_id) REFERENCES hr.funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_gestor ON hr.funcionarios (gestor_id);

COMMENT ON COLUMN hr.funcionarios.gestor_id IS
  'A quem esta pessoa se reporta (mesmo bar). Raiz do organograma = gestor_id NULL.';

-- Ciclo no organograma (A reporta a B que reporta a A) trava a montagem da
-- árvore no front — e um arrastar-e-soltar erra fácil. Barra no banco, que é
-- o único lugar por onde toda escrita passa.
CREATE OR REPLACE FUNCTION hr.fn_funcionario_gestor_sem_ciclo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = hr, pg_catalog
AS $$
DECLARE
  v_atual   INTEGER := NEW.gestor_id;
  v_saltos  INTEGER := 0;
BEGIN
  IF NEW.gestor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.gestor_id = NEW.id THEN
    RAISE EXCEPTION 'Funcionário % não pode ser gestor de si mesmo', NEW.id;
  END IF;

  -- Sobe a cadeia a partir do gestor escolhido: se reencontrar a própria
  -- pessoa, fecharia um ciclo. O teto de saltos é só uma trava de segurança.
  WHILE v_atual IS NOT NULL AND v_saltos < 100 LOOP
    IF v_atual = NEW.id THEN
      RAISE EXCEPTION 'Gestor inválido: criaria um ciclo no organograma (funcionário %)', NEW.id;
    END IF;
    SELECT gestor_id INTO v_atual FROM hr.funcionarios WHERE id = v_atual;
    v_saltos := v_saltos + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funcionario_gestor_sem_ciclo ON hr.funcionarios;
CREATE TRIGGER trg_funcionario_gestor_sem_ciclo
  BEFORE INSERT OR UPDATE OF gestor_id ON hr.funcionarios
  FOR EACH ROW EXECUTE FUNCTION hr.fn_funcionario_gestor_sem_ciclo();

-- ── 3. Calibração ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr.calibracoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id          INTEGER NOT NULL,
  funcionario_id  INTEGER NOT NULL REFERENCES hr.funcionarios(id) ON DELETE CASCADE,
  ano             INTEGER NOT NULL,
  trimestre       INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  comportamento   TEXT,
  performance     TEXT,
  observacao      TEXT,
  registrado_por  TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calibracoes_func_periodo_key UNIQUE (funcionario_id, ano, trimestre),
  CONSTRAINT calibracoes_comportamento_check CHECK (
    comportamento IS NULL OR comportamento IN
      ('Insatisfatório', 'Parcial', 'Atende -', 'Atende +', 'Acima', 'Destaque')),
  CONSTRAINT calibracoes_performance_check CHECK (
    performance IS NULL OR performance IN
      ('Insatisfatório', 'Parcial', 'Atende -', 'Atende +', 'Acima', 'Destaque'))
);

CREATE INDEX IF NOT EXISTS idx_calibracoes_func_periodo
  ON hr.calibracoes (funcionario_id, ano DESC, trimestre DESC);
CREATE INDEX IF NOT EXISTS idx_calibracoes_bar_periodo
  ON hr.calibracoes (bar_id, ano DESC, trimestre DESC);

COMMENT ON TABLE hr.calibracoes IS
  'Calibração trimestral de Comportamento e Performance. Preenchimento manual (a fonte é o slide dos cards, não há planilha).';
COMMENT ON COLUMN hr.calibracoes.comportamento IS
  'Insatisfatório | Parcial | Atende - | Atende + | Acima | Destaque';

ALTER TABLE hr.calibracoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr.calibracoes FROM anon, authenticated;
GRANT ALL ON hr.calibracoes TO service_role;

COMMIT;
