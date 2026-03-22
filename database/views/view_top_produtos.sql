CREATE MATERIALIZED VIEW view_top_produtos AS
WITH produtos_agregados AS (
  SELECT vendas_item.produto_desc AS produto,
    vendas_item.grupo_desc AS grupo,
    vendas_item.bar_id,
    count(*) AS total_vendas,
    sum(vendas_item.quantidade) AS quantidade_total,
    sum(vendas_item.valor) AS valor_total,
    sum(vendas_item.custo) AS custo_total,
    min(vendas_item.data_venda) AS primeira_venda,
    max(vendas_item.data_venda) AS ultima_venda,
        CASE
            WHEN sum(vendas_item.valor) > 0::numeric THEN (sum(vendas_item.valor) - sum(vendas_item.custo)) / sum(vendas_item.valor) * 100::numeric
            ELSE 0::numeric
        END AS margem_lucro_percentual
  FROM vendas_item
  WHERE vendas_item.produto_desc IS NOT NULL AND vendas_item.produto_desc <> ''::text AND vendas_item.quantidade IS NOT NULL AND vendas_item.valor IS NOT NULL AND vendas_item.bar_id IS NOT NULL
  GROUP BY vendas_item.produto_desc, vendas_item.grupo_desc, vendas_item.bar_id
),
produtos_por_dia AS (
  SELECT vendas_item.produto_desc AS produto,
    vendas_item.grupo_desc AS grupo,
    vendas_item.bar_id,
    EXTRACT(dow FROM vendas_item.data_venda) AS dia_semana,
    count(*) AS vendas_dia,
    sum(vendas_item.quantidade) AS quantidade_dia,
    sum(vendas_item.valor) AS valor_dia,
    sum(vendas_item.custo) AS custo_dia
  FROM vendas_item
  WHERE vendas_item.produto_desc IS NOT NULL AND vendas_item.produto_desc <> ''::text AND vendas_item.quantidade IS NOT NULL AND vendas_item.valor IS NOT NULL AND vendas_item.bar_id IS NOT NULL
  GROUP BY vendas_item.produto_desc, vendas_item.grupo_desc, vendas_item.bar_id, (EXTRACT(dow FROM vendas_item.data_venda))
)
SELECT produto, grupo, bar_id, total_vendas, quantidade_total, valor_total, custo_total, primeira_venda, ultima_venda, margem_lucro_percentual,
  ( SELECT json_agg(json_build_object('dia_semana', pd.dia_semana, 'vendas', pd.vendas_dia, 'quantidade', pd.quantidade_dia, 'valor', pd.valor_dia, 'custo', pd.custo_dia)) AS json_agg
        FROM produtos_por_dia pd
        WHERE pd.produto = p.produto AND pd.grupo = p.grupo AND pd.bar_id = p.bar_id) AS vendas_por_dia
FROM produtos_agregados p
ORDER BY valor_total DESC
LIMIT 200;