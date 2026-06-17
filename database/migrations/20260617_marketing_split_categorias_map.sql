-- 2026-06-17 — Marketing separado em 3 categorias no de-para (orçamentação/DRE)
--
-- O sócio re-categorizou no Conta Azul a categoria "Marketing" em três:
--   Marketing Mídia / Marketing Disparos / Marketing Produção.
-- Após o sync do CA, o bronze passou a ter essas 3 categorias (bar 3). Para a
-- DRE e a Orçamentação posicionarem corretamente (bloco Despesas Comerciais) em
-- vez de cair em "Outras", registramos o de-para. (bar 4 segue com "Marketing"
-- único até ser re-categorizado no CA.)
--
-- Depois deste INSERT é preciso recalcular silver+gold do período:
--   SELECT gold.fn_refresh_orcamento_periodo(<bar_id>, '<inicio>', '<fim>');

-- 1) Orçamentação (medallion gold): de-para meta.categoria_zykor_map
INSERT INTO meta.categoria_zykor_map (categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar)
VALUES
 ('Marketing Mídia',    'Marketing Mídia',    'Despesas Comerciais', 'despesa', false),
 ('Marketing Disparos', 'Marketing Disparos', 'Despesas Comerciais', 'despesa', false),
 ('Marketing Produção', 'Marketing Produção', 'Despesas Comerciais', 'despesa', false)
ON CONFLICT (categoria_ca) DO UPDATE SET
  categoria_zykor = EXCLUDED.categoria_zykor,
  bloco_dre       = EXCLUDED.bloco_dre,
  tipo_zykor      = EXCLUDED.tipo_zykor,
  ignorar         = EXCLUDED.ignorar,
  atualizado_em   = NOW();

-- 2) DRE (get_dre_por_ano): de-para financial.dre_categoria_macro.
-- A DRE usa OUTRO de-para (não o categoria_zykor_map). Mantemos "Marketing"
-- (sub 1) pro bar 4 legado e abrimos espaço pras 3 novas em subs 2-4.
UPDATE financial.dre_categoria_macro
SET ordem_sub = ordem_sub + 3
WHERE categoria_macro = 'Despesas Comerciais' AND ordem_sub BETWEEN 2 AND 8;

INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub)
VALUES
 ('Marketing Mídia',    'Despesas Comerciais', 5, 2),
 ('Marketing Disparos', 'Despesas Comerciais', 5, 3),
 ('Marketing Produção', 'Despesas Comerciais', 5, 4)
ON CONFLICT (categoria_nome) DO UPDATE SET
  categoria_macro = EXCLUDED.categoria_macro,
  ordem_macro     = EXCLUDED.ordem_macro,
  ordem_sub       = EXCLUDED.ordem_sub;

-- 3) Recalcular silver+gold do período afetado (orçamentação):
--   SELECT gold.fn_refresh_orcamento_periodo(3, '2026-01-01', '2026-12-31');
-- (A DRE lê o bronze ao vivo e não precisa de refresh.)
