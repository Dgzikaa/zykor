-- Fix: CMV realizado da Orçamentação (/estrategico/orcamentacao) estava puxando
-- menor que a DRE (/financeiro/dre) por dois motivos:
--
-- 1) meta.categoria_zykor_map tinha `[CONSUMAÇÃO] AJUSTE CMV` mapeada com
--    tipo_zykor='despesa', mas o lançamento vem do CA como tipo_ca=RECEITA.
--    A fórmula do gold (gold.fn_refresh_gold_orcamento) calcula o net como
--    `SUM(CASE WHEN tipo_ca='DESPESA' THEN valor_bruto ELSE -valor_bruto END)`
--    quando tipo_zykor='despesa' — então cada lançamento RECEITA era SUBTRAÍDO
--    do CMV. Ordinário perdia ~381k/ano por causa disso.
--
-- 2) O JOIN em silver.fn_refresh_silver_orcamento é case-sensitive:
--    `LEFT JOIN meta.categoria_zykor_map m ON m.categoria_ca = b.categoria_nome`.
--    Deboche lança variantes de caso distintas do Ordinário
--    (`[Consumação] AJUSTE CMV`, `Variação de ESTOQUE`, `Ajuste Bonificação`)
--    que não casavam com nenhuma entrada — os lançamentos ficavam com
--    bloco_dre=NULL e não iam pro gold. ~143k/ano perdidos no Deboche.
--
-- Correção: 1 UPDATE + 3 INSERTs no de-para, refresh do silver+gold em seguida.

BEGIN;

-- Corrige tipo_zykor: é receita do CA, precisa somar (não subtrair) no CMV.
UPDATE meta.categoria_zykor_map
SET tipo_zykor = 'receita', atualizado_em = NOW()
WHERE categoria_ca = '[CONSUMAÇÃO] AJUSTE CMV' AND bar_id IS NULL;

-- Variantes de caso do Deboche — mesmo mapeamento das do Ordinário.
INSERT INTO meta.categoria_zykor_map
  (bar_id, categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar, observacao, criado_em, atualizado_em)
VALUES
  (NULL, '[Consumação] AJUSTE CMV', 'Consumação Ajuste CMV', 'Custo insumos (CMV)', 'receita', FALSE,
   'Variante de caso lançada pelo Deboche — mesmo mapeamento de [CONSUMAÇÃO] AJUSTE CMV do Ordinário.',
   NOW(), NOW()),
  (NULL, 'Variação de ESTOQUE', 'Variação de Estoque', 'Custo insumos (CMV)', 'receita', FALSE,
   'Variante de caso lançada pelo Deboche — tipo_ca=RECEITA no CA (contra-partida de saída de estoque).',
   NOW(), NOW()),
  (NULL, 'Ajuste Bonificação', 'Ajuste Bonificações', 'Custo insumos (CMV)', 'despesa', FALSE,
   'Variante singular lançada pelo Deboche — consolida no mesmo categoria_zykor da versão plural.',
   NOW(), NOW());

COMMIT;

-- Reprocessa silver+gold pros dois bares em 2026 pra aplicar o de-para novo.
SELECT gold.fn_refresh_orcamento_periodo(3, '2026-01-01', '2026-12-31') AS bar_ordinario;
SELECT gold.fn_refresh_orcamento_periodo(4, '2026-01-01', '2026-12-31') AS bar_deboche;
