-- 2026-04-29: Suportar mensal em meta.desempenho_manual
--
-- Bug reportado: PUT /api/estrategico/desempenho-v2 retorna 500 ao salvar
-- mensal (CMV Teorico, CMO%) com erro
--   "null value in column \"numero_semana\" violates not-null constraint"
--
-- Causa: tabela criada apenas pra granularidade=semanal (UNIQUE em
-- bar_id, ano, numero_semana) com numero_semana NOT NULL. No mensal, gold
-- tem numero_semana=null e periodo='YYYY-MM'.
--
-- Fix:
-- 1. Tornar numero_semana nullable
-- 2. Adicionar colunas granularidade ('semanal'|'mensal') e mes
-- 3. Substituir UNIQUE por 2 partial unique indexes (1 por granularidade)
-- 4. Frontend route.ts (/api/estrategico/desempenho-v2 PUT) detecta
--    mensal via gold.granularidade ou periodo regex e faz SELECT+INSERT/UPDATE
--    manual (PostgREST não suporta partial index target em onConflict)

ALTER TABLE meta.desempenho_manual
  ADD COLUMN IF NOT EXISTS granularidade text NOT NULL DEFAULT 'semanal',
  ADD COLUMN IF NOT EXISTS mes integer NULL,
  ALTER COLUMN numero_semana DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='desempenho_manual_granularidade_chk'
      AND conrelid='meta.desempenho_manual'::regclass
  ) THEN
    ALTER TABLE meta.desempenho_manual
      ADD CONSTRAINT desempenho_manual_granularidade_chk
      CHECK (granularidade IN ('semanal','mensal'));
  END IF;
END $$;

ALTER TABLE meta.desempenho_manual
  DROP CONSTRAINT IF EXISTS desempenho_semanal_bar_id_ano_numero_semana_key;

CREATE UNIQUE INDEX IF NOT EXISTS desempenho_manual_semanal_uniq
  ON meta.desempenho_manual(bar_id, ano, numero_semana)
  WHERE granularidade='semanal';

CREATE UNIQUE INDEX IF NOT EXISTS desempenho_manual_mensal_uniq
  ON meta.desempenho_manual(bar_id, ano, mes)
  WHERE granularidade='mensal';
