-- 2026-05-01 (segunda parte): refinar keywords de socios
--
-- Bug: Sócio Diogo não estava no regex (era diferente de "Diego"). Mesa
-- "X-Socio Diogo" + motivo "Consumação" não classificavam.
--
-- Bug 2: Word boundary `\m\M` exige separador entre X e nome. "X-cadu"
-- match (hifen e boundary), mas "Xcadu" sem separador NÃO match. Como os
-- garcons digitam de mil jeitos, removi boundary dos nomes unicos de socios.
--
-- Aplicado direto via UPDATE na tabela financial.consumos_keywords.

-- Adicionar Diogo (não existia) e Digao (apelido)
INSERT INTO financial.consumos_keywords (pattern, categoria, prioridade, descricao)
VALUES
  ('diogo', 'socios', 20, 'Socio Diogo (variacoes: X diogo, XDIOGO, X-Socio Diogo)'),
  ('digao', 'socios', 20, 'Socio Digao (apelido)')
ON CONFLICT DO NOTHING;

-- Remover boundaries dos nomes únicos de sócios (Xcadu/Xcorbal/Xdiego sem separador)
UPDATE financial.consumos_keywords SET pattern='cadu',     atualizado_em=now() WHERE pattern='\mcadu\M'     AND categoria='socios';
UPDATE financial.consumos_keywords SET pattern='gonza',    atualizado_em=now() WHERE pattern='\mgonza\M'    AND categoria='socios';
UPDATE financial.consumos_keywords SET pattern='augusto',  atualizado_em=now() WHERE pattern='\maugusto\M'  AND categoria='socios';
UPDATE financial.consumos_keywords SET pattern='diego',    atualizado_em=now() WHERE pattern='\mdiego\M'    AND categoria='socios';
UPDATE financial.consumos_keywords SET pattern='moai',     atualizado_em=now() WHERE pattern='\mmoai\M'     AND categoria='socios';
UPDATE financial.consumos_keywords SET pattern='rodrigo',  atualizado_em=now() WHERE pattern='\mrodrigo\M'  AND categoria='socios';
-- Mantem boundary: \mluan\M (luana, luanda), x[- ]vini\M (vinicius cliente), \msocio\M (sociedade fornecedor)

-- Re-rodar UPDATE retroativo cmv_semanal 2026 Ord + Deb (popula novos socios)
-- e re-agregar abril/2026 mensal Ord + Deb
-- (executar em sessoes separadas pra evitar timeout do PostgREST)
