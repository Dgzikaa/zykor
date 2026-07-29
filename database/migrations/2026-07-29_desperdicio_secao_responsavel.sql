-- 2026-07-29 — Desperdício ganha SEÇÃO (Bar/Cozinha) e RESPONSÁVEL
--
-- Pedido da operação: separar o registro de desperdício em Bar e Cozinha igual o Controle de
-- Produção, e ter uma coluna de responsável — com a lista filtrada pela seção (na aba Bar só
-- aparece gente do bar, na Cozinha só da cozinha).
--
-- Decisão de modelagem: a seção do responsável virou COLUNA, não heurística sobre o cargo.
-- O cargo é texto livre ("Aux Cozinha", "Barman", "Capitão do Bar", "Chefe de Produção") e
-- deduzir a área dele em runtime já deu problema em Desvios. A coluna é curada na tela
-- "Gerir equipe", que já existe e é gateada pelo módulo `producao - cmv_gerir_equipe`.

-- 1) Responsável passa a ter SEÇÃO explícita (Bar / Cozinha / NULL = aparece nos dois).
--    NULL é intencional pra quem atravessa as duas áreas (ex.: Chefe de Produção).
ALTER TABLE auth_custom.pessoas_responsaveis
  ADD COLUMN IF NOT EXISTS secao text;

COMMENT ON COLUMN auth_custom.pessoas_responsaveis.secao IS
  'Bar | Cozinha | NULL. NULL aparece nas duas listas (ex.: Chefe de Produção). Curado na tela Gerir Equipe — não inferir do cargo em runtime.';

-- Backfill ÚNICO a partir do cargo. Daqui pra frente o campo é curado na tela.
-- Resultado em 29/07/2026: bar 3 → Bar 3, Cozinha 7, ambos 1 (Isaías, "Chefe de Produção");
--                          bar 4 → Bar 2, Cozinha 5.
UPDATE auth_custom.pessoas_responsaveis
   SET secao = 'Cozinha'
 WHERE secao IS NULL AND cargo ~* 'cozinh';

UPDATE auth_custom.pessoas_responsaveis
   SET secao = 'Bar'
 WHERE secao IS NULL AND cargo ~* 'bar';

-- 2) Registro de desperdício ganha seção + responsável, espelhando o Controle de Produção
--    (producao_base.secao = 'Bar' | 'Cozinha').
ALTER TABLE operations.desperdicio_registro
  ADD COLUMN IF NOT EXISTS secao text,
  ADD COLUMN IF NOT EXISTS responsavel_id integer REFERENCES auth_custom.pessoas_responsaveis(id);

COMMENT ON COLUMN operations.desperdicio_registro.secao IS 'Bar | Cozinha — mesma convenção de producao_base.secao.';

-- Os 28 registros anteriores a esta migration ficam com secao NULL. O filtro das abas aceita
-- NULL de propósito (`secao.eq.X,secao.is.null`): sem isso o histórico sumiria das DUAS abas e
-- pareceria perda de dado.
CREATE INDEX IF NOT EXISTS idx_desperdicio_registro_secao
  ON operations.desperdicio_registro (bar_id, secao, data DESC);
