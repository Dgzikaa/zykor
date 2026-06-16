-- 2026-06-16 — DRE parametrizada por ano (comparar 2026 x 2025). Mesma lógica da
-- view financial.dre_excel (Conta Azul, valor efetivo, de-para, esqueleto) + p_ano.
-- Ver corpo aplicado em apply_migration get_dre_por_ano. Assinatura:
--   public.get_dre_por_ano(p_bar_id integer, p_ano integer)
-- A rota /api/estrategico/orcamentacao/dre-excel passou a aceitar ?ano= e chamar
-- esta função (default = ano corrente). A view dre_excel segue existindo (compat).
SELECT 'ver apply_migration get_dre_por_ano' AS nota;
