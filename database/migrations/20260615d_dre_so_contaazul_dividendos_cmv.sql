-- 2026-06-15 — DRE: passa a considerar SÓ Conta Azul + Dividendos (linha solitária)
-- + 2 categorias novas em CMV.
--
-- 1) DRE só Conta Azul: a aba DRE Manual foi escondida e os ajustes manuais
--    (financial.dre_manual) duplicariam o que já vem do CA (consumações etc. agora
--    lançadas no CA). A view financial.dre_excel foi recriada SEM o branch da
--    dre_manual (mantém CA + esqueleto de categorias zeradas).
--    Ver corpo aplicado em apply_migration dre_excel_remove_dre_manual.

-- 2) Novas categorias em CMV (case-insensitive cobre as variantes em maiúsculas):
INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal) VALUES
  ('Ajuste Bonificações',  'Custo insumos (CMV)', 3, 6, -1),
  ('Variação de Estoque',  'Custo insumos (CMV)', 3, 7, -1)
ON CONFLICT DO NOTHING;

-- 3) Dividendos: linha solitária após Investimentos. Já existia sob a macro
--    "Sócios" (não renderizada) -> movida pra macro própria "Dividendos".
UPDATE financial.dre_categoria_macro
SET categoria_macro = 'Dividendos', ordem_macro = 13, ordem_sub = 1, sinal = -1
WHERE categoria_nome = 'Dividendos';
