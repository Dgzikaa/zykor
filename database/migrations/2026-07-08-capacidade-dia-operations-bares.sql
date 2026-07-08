-- Capacidade nominal de atendimento por dia aberto (os "650" do Ordinário).
-- Usada na Taxa de Lotação do Dashboard de Receitas (área Receitas):
--   capacidade mensal = dias abertos × capacidade_dia
-- Conceito distinto de eventos_base.capacidade_estimada/lot_max (que é por evento e esparso).
-- Aplicada em produção via MCP em 2026-07-08.
ALTER TABLE operations.bares ADD COLUMN IF NOT EXISTS capacidade_dia integer;

COMMENT ON COLUMN operations.bares.capacidade_dia IS
  'Capacidade nominal de atendimento por dia aberto (ex.: 650 no Ordinário). Taxa de Lotação = dias abertos × capacidade_dia. NULL = não configurada.';

-- MVP: Ordinário (id=3). Deboche/Primo Pobre ficam NULL até configurar.
UPDATE operations.bares SET capacidade_dia = 650 WHERE id = 3 AND capacidade_dia IS NULL;
