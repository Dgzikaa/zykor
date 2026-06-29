-- "Seção VMarket" = categoria de COMPRA do insumo (vem do VMarket: bronze_vmarket_produtos.nome_secao,
-- associada ao insumo pelo de-para codigo_planilha). Distinta do "Local de Contagem"
-- (operations.insumos.categoria), que veio da planilha de contagem e só serve pra contar estoque.
-- A view silver.insumo_catalogo (fonte única de Insumos + Plano de Compras) passa a expor as duas:
--   categoria      = Local de Contagem
--   secao_vmarket  = Seção VMarket (categoria de compra)
-- 7 insumos caem em 2 seções (variações BAR/COZINHA) — DISTINCT ON pega 1 determinística (alfabética).
-- Aplicada em prod via MCP em 2026-06-29.
create or replace view silver.insumo_catalogo as
with compras as (
  select b.bar_id,
    coalesce(nullif(b.codigo_planilha,''), case when b.cod_interno ~ '^i\d+$' then b.cod_interno else null end) as codigo,
    gp.preco_atual, gp.data_atual, gp.preco_anterior, gp.fornecedor_atual,
    row_number() over (partition by b.bar_id, coalesce(nullif(b.codigo_planilha,''), case when b.cod_interno ~ '^i\d+$' then b.cod_interno else null end) order by gp.data_atual desc nulls last) as rn
  from public.bronze_vmarket_produtos b
  join gold.vmarket_insumo_preco gp on gp.bar_id = b.bar_id and gp.id_prod = b.id_produto_sisfood_cotacao
  where gp.preco_atual > 0::numeric
),
secoes as (
  select distinct on (b.bar_id, cod.codigo) b.bar_id, cod.codigo, b.nome_secao
  from public.bronze_vmarket_produtos b
  cross join lateral (select coalesce(nullif(b.codigo_planilha,''), case when b.cod_interno ~ '^i\d+$' then b.cod_interno else null end) as codigo) cod
  where b.nome_secao is not null and cod.codigo is not null
  order by b.bar_id, cod.codigo, b.nome_secao
)
select i.bar_id, i.id, i.codigo, i.nome, i.categoria, i.unidade_medida, i.fator_correcao,
  coalesce(c.preco_atual, nullif(i.custo_unitario, 0::numeric)) as preco,
  c.preco_anterior, c.data_atual as preco_data, c.fornecedor_atual as fornecedor,
  (c.preco_atual is not null) as tem_compra,
  u.base, u.embalagem, i.curva_a, i.frequencia, i.curva_a_proteina,
  s.nome_secao as secao_vmarket
from operations.insumos i
left join compras c on c.bar_id = i.bar_id and c.codigo = i.codigo::text and c.rn = 1
left join public.insumo_unidade u on u.bar_id = i.bar_id and u.id_prod = (- i.id)
left join secoes s on s.bar_id = i.bar_id and s.codigo = i.codigo::text
where i.ativo = true and (i.codigo)::text !~ '^p[cd]\d';
