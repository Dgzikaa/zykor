-- ============================================================================
-- Sinal do construtor de alertas: compra acima da média (compra cara)
-- ----------------------------------------------------------------------------
-- Usada pelo motor (sinal 'compra_cara'): compras recentes (p_dias) de um insumo
-- cujo preço saiu acima da média histórica (120 dias, mín 3 compras). Fontes:
-- gold.vmarket_pedido_item (preco, cod_interno) + gold.vmarket_pedido (data).
-- O motor compara desvio_pct > X% (limite do admin). Aplicada em prod 07/jul/2026.
-- ============================================================================

create or replace function gold.fn_compras_caras(p_bar integer, p_dias integer default 7)
returns table (cod_interno text, nome text, data date, preco numeric, preco_medio numeric, desvio_pct numeric)
language sql
stable
security definer
set search_path = public, gold
as $$
  with base as (
    select pi.cod_interno,
           pi.nome_cotacao as nome,
           pd.data::date as data,
           pi.preco
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido pd
      on pd.id_pedido = pi.id_pedido and pd.bar_id = p_bar
    where pi.bar_id = p_bar
      and pi.preco > 0
      and coalesce(pi.cod_interno, '') <> ''
      and pd.data::date >= current_date - 120
  ),
  medias as (
    select cod_interno, avg(preco) as preco_medio, count(*) as n
    from base
    group by cod_interno
    having count(*) >= 3
  )
  select b.cod_interno, b.nome, b.data, b.preco, round(m.preco_medio, 4) as preco_medio,
         round((b.preco / m.preco_medio - 1) * 100, 1) as desvio_pct
  from base b
  join medias m on m.cod_interno = b.cod_interno
  where b.data >= current_date - p_dias
    and b.preco > m.preco_medio
  order by desvio_pct desc;
$$;

grant execute on function gold.fn_compras_caras(integer, integer) to service_role;
