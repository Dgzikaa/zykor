-- 2026-06-15 — DRE: mapeia categorias [Consumação]/Investimento do Conta Azul +
-- view-radar de categorias não mapeadas.
--
-- Contexto: o sócio padronizou categorias [Consumação] no Conta Azul. A DRE
-- (financial.dre_excel) casa lançamento.categoria_nome com o de-para
-- financial.dre_categoria_macro; categoria fora do de-para cai em "Não Mapeado".
-- O cadastro de categorias do CA vem ACHATADO (sem hierarquia/pai), então o grupo
-- de cada categoria é decisão de negócio (de-para), não dá pra derivar do CA.

-- 1) 10 categorias [Consumação] (grupos definidos pelo sócio; Relacionamento e
--    Sócios = Não Operacionais). de-para é global (vale bar 3 e 4).
INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal) VALUES
  ('[Consumação] Ajuste CMV',              'Custo insumos (CMV)',      3, 5, -1),
  ('[Consumação] Artistas',               'Despesas Comerciais',      5, 4, -1),
  ('[Consumação] Aniversários',           'Despesas Comerciais',      5, 5, -1),
  ('[Consumação] Benefício Clientes',     'Despesas Comerciais',      5, 6, -1),
  ('[Consumação] Influencers',            'Despesas Comerciais',      5, 7, -1),
  ('[Consumação] Programa de Pontos',     'Despesas Comerciais',      5, 8, -1),
  ('[Consumação] Funcionários Operação',  'Despesas Administrativas', 6, 4, -1),
  ('[Consumação] Funcionários Escritório','Despesas Administrativas', 6, 5, -1),
  ('[Consumação] Relacionamento',         'Não Operacionais',         9, 3, -1),
  ('[Consumação] Sócios',                 'Não Operacionais',         9, 4, -1),
  ('[Investimento] Consultoria',          'Investimentos',           11, 7, -1)
ON CONFLICT DO NOTHING;

-- 2) View-radar: categorias do CA COM lançamento no ano que NÃO estão no de-para
--    (caem em "Não Mapeado" na DRE). Evita categoria nova escondida silenciosamente.
CREATE OR REPLACE VIEW financial.dre_categorias_nao_mapeadas AS
SELECT
  l.bar_id,
  TRIM(l.categoria_nome) AS categoria_nome,
  l.tipo,
  count(*) AS lancamentos_ano,
  ROUND(SUM(l.valor_bruto)::numeric, 2) AS total_ano,
  max(l.data_competencia) AS ultimo_lancamento
FROM bronze.bronze_contaazul_lancamentos l
LEFT JOIN financial.dre_categoria_macro m
  ON upper(TRIM(m.categoria_nome)) = upper(TRIM(l.categoria_nome))
WHERE l.data_competencia >= date_trunc('year', CURRENT_DATE)
  AND l.excluido_em IS NULL
  AND m.categoria_nome IS NULL
  AND TRIM(COALESCE(l.categoria_nome, '')) <> ''
GROUP BY l.bar_id, TRIM(l.categoria_nome), l.tipo;

GRANT SELECT ON financial.dre_categorias_nao_mapeadas TO authenticated, service_role;
