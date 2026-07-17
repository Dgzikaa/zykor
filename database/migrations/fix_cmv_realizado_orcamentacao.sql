-- Fix: CMV/Custos Variáveis realizado da Orçamentação (/estrategico/orcamentacao)
-- estava batendo diferente do que a DRE (/financeiro/dre) mostra. Depois desta
-- migration, os dois blocos (Custos Variáveis + Custo insumos (CMV)) batem
-- CENTAVO por CENTAVO com a DRE em todos os meses do ano corrente, nos 2 bares.
--
-- Causas encontradas (3 no total):
--
-- 1) JOIN case-sensitive em silver.fn_refresh_silver_orcamento
--    (`m.categoria_ca = b.categoria_nome`) fazia o Deboche perder categorias
--    lançadas com case diferente do Ordinário:
--      - `[Consumação] AJUSTE CMV` (case do Deboche vs `[CONSUMAÇÃO] AJUSTE CMV` global)
--      - `Variação de ESTOQUE` (Deboche vs `VARIAÇÃO DE ESTOQUE` global)
--      - `Ajuste Bonificação` (singular no Deboche vs `Ajuste Bonificações` global)
--    → categorias caíam com bloco_dre=NULL e não iam pro gold. ~143k/ano perdidos.
--
-- 2) `VARIAÇÃO DE ESTOQUE` e `Variação de Estoque` são a MESMA linha da DRE — o CA
--    lança um par (RECEITA + DESPESA) e a DRE consolida em uma categoria só,
--    reportando o LÍQUIDO (`despesa - receita`). A Orçamentação mantinha as duas
--    variantes separadas com tipo_zykor divergente (uma 'receita', outra 'despesa'),
--    somando as duas positivamente no CMV — inflava o custo em 2× o valor da parte
--    receita. Fix: consolida no mesmo `categoria_zykor='Variação de Estoque'` com
--    `tipo_zykor='despesa'` pras duas → a fórmula do gold calcula `despesa - receita`.
--
-- 3) `[Consumação] Ajuste CMV` (RECEITA no CA) precisa REDUZIR o CMV (como a DRE
--    faz) — não somar. Pra receita em bloco de despesa reduzir o total, o de-para
--    tem que usar `tipo_zykor='despesa'` mesmo — a fórmula do gold
--    (`SUM(CASE WHEN tipo_ca='DESPESA' THEN valor ELSE -valor END)`) subtrai as
--    receitas quando o tipo do bloco é 'despesa'. Foi tentado 'receita' primeiro
--    e o CMV subiu em vez de bater com a DRE.
--
-- Fórmula final: `SUM(net)` do bloco na Orçamentação = `SUM(-valor_com_sinal)` do
-- mesmo bloco na DRE = **custo líquido** (positivo).

BEGIN;

-- Adiciona variantes de caso do Deboche (Consumação Ajuste CMV, Variação de Estoque,
-- Ajuste Bonificação singular) que não casavam com o de-para global do Ordinário.
INSERT INTO meta.categoria_zykor_map
  (bar_id, categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar, observacao, criado_em, atualizado_em)
VALUES
  (NULL, '[Consumação] AJUSTE CMV', '[Consumação] Ajuste CMV', 'Custo insumos (CMV)', 'despesa', FALSE,
   'Variante de caso lançada pelo Deboche — mesmo mapeamento de [CONSUMAÇÃO] AJUSTE CMV.',
   NOW(), NOW()),
  (NULL, 'Variação de ESTOQUE', 'Variação de Estoque', 'Custo insumos (CMV)', 'despesa', FALSE,
   'Variante de caso lançada pelo Deboche — tipo_ca=RECEITA no CA (contra-partida de saída de estoque). Consolida em Variação de Estoque; net = despesa - receita.',
   NOW(), NOW()),
  (NULL, 'Ajuste Bonificação', 'Ajuste Bonificação', 'Custo insumos (CMV)', 'despesa', FALSE,
   'Variante singular lançada pelo Deboche — consolida no mesmo categoria_zykor.',
   NOW(), NOW());

-- Consolida VARIAÇÃO DE ESTOQUE (maiúsculo, RECEITA no CA) na mesma categoria_zykor
-- 'Variação de Estoque' com tipo_zykor='despesa' → net = despesa - receita.
UPDATE meta.categoria_zykor_map
SET categoria_zykor = 'Variação de Estoque',
    tipo_zykor = 'despesa',
    atualizado_em = NOW()
WHERE categoria_ca = 'VARIAÇÃO DE ESTOQUE' AND bar_id IS NULL;

-- Alinha [CONSUMAÇÃO] AJUSTE CMV: tipo_zykor='despesa' (reduz CMV, igual DRE) e
-- categoria_zykor com o mesmo nome que a DRE mostra.
UPDATE meta.categoria_zykor_map
SET categoria_zykor = '[Consumação] Ajuste CMV',
    tipo_zykor = 'despesa',
    atualizado_em = NOW()
WHERE categoria_ca = '[CONSUMAÇÃO] AJUSTE CMV' AND bar_id IS NULL;

-- Alinha Ajuste Bonificações (plural): mesmo categoria_zykor que a DRE mostra.
UPDATE meta.categoria_zykor_map
SET categoria_zykor = 'Ajuste Bonificação',
    atualizado_em = NOW()
WHERE categoria_ca = 'Ajuste Bonificações' AND bar_id IS NULL;

COMMIT;

-- Reprocessa silver+gold pros dois bares em 2026 pra aplicar o de-para novo.
SELECT gold.fn_refresh_orcamento_periodo(3, '2026-01-01', '2026-12-31') AS bar_ordinario;
SELECT gold.fn_refresh_orcamento_periodo(4, '2026-01-01', '2026-12-31') AS bar_deboche;
