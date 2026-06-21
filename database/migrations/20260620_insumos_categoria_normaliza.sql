-- 2026-06-20 — Limpeza de cadastro de insumos (pré-contagem).
-- Diagnóstico: área (tipo_local) está 100% (0 sem área); o gap real é CUSTO
-- (bar 3: 237 sem custo, ~34%) — não recuperável dos dados (só 8 no histórico), preenchido
-- na tela ferramentas/insumos (card "Sem custo" vira filtro). Aqui só unifica categorias
-- escritas diferente (case/acento) pra a mesma grafia mais frequente. Idempotente.
WITH freq AS (
  SELECT bar_id, categoria, lower(unaccent(trim(categoria))) AS norm, count(*) AS n
  FROM operations.insumos WHERE ativo=true AND categoria IS NOT NULL AND categoria<>''
  GROUP BY 1,2,3
),
canon AS (
  SELECT DISTINCT ON (bar_id, norm) bar_id, norm, categoria AS canonica
  FROM freq ORDER BY bar_id, norm, n DESC
)
UPDATE operations.insumos i SET categoria = c.canonica, updated_at = now()
FROM canon c
WHERE i.bar_id = c.bar_id AND lower(unaccent(trim(i.categoria))) = c.norm
  AND i.categoria <> c.canonica AND i.ativo = true;
