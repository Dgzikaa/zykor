-- 2026-06-14 (c) — Mapeia ACESSORIOS SALAO e LOCACOES OPERACAO em Despesas
-- Operacionais no de-para da DRE (antes caíam em "Não Mapeado").
--
-- Grafia sem acento p/ casar com o bronze do Conta Azul (join por upper/trim).
-- Alinha a DRE com a orçamentação, que já mapeia essas categorias em Operacionais.
-- Já aplicado em produção via MCP em 2026-06-14; versionado aqui.

INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal) VALUES
  ('ACESSORIOS SALAO', 'Despesas Operacionais', 7, 7, -1),
  ('LOCACOES OPERACAO', 'Despesas Operacionais', 7, 8, -1)
ON CONFLICT DO NOTHING;
