-- 2026-07-07 — Fix da VALORIZAÇÃO do estoque (silver.fn_refresh_estoque_contagem).
--
-- Sintoma (Deboche): estoque do Zykor ~30% acima da planilha do Alan (contagens idênticas,
-- só o preço unitário divergia). Duas causas, mesma raiz — a função confiava no preço do VMarket
-- mesmo quando ele era ruim:
--   1) VMarket = 0  → item que NÃO passa pelo VMarket (cerveja/bebida direto do distribuidor).
--      O `coalesce(px.preco, o.custo_unitario, 0)` pegava o 0 (não é null!) e valorava em R$0.
--      148 itens zerados no Deboche.
--   2) VMarket = preço da EMBALAGEM/caixa num item contado por UNIDADE (ex.: Pastel cx 32un =
--      R$206,40 num item contado em unidade). A função usava R$206 × qtd → inflava ~32×.
-- Nos dois casos o `operations.contagem_estoque_insumos.custo_unitario` JÁ tinha o preço certo
-- por unidade contada (R$6,45 do pastel, R$7,02 do Spaten) — só não era usado.
--
-- Fix: preço VMarket EFETIVO (`vm`) descarta 0 e descarta preço >5x o custo_unitario conhecido
-- (>5x = quase sempre unidade de embalagem trocada). Quando descarta, cai pro custo_unitario.
-- Validado (Deboche semana 06/07): 65.941 → 49.090 (planilha 50.425 = 97%). Os ~3% que sobram
-- são diferença real entre preço VMarket (compra) e preço manual da planilha, não bug.
-- Aplicada em prod via MCP + re-rodado silver.fn_refresh_estoque_contagem(3,30) e (4,30).
-- OBS: muda valores de estoque/desvios/CMV dos 2 bares (pra melhor).

CREATE OR REPLACE FUNCTION silver.fn_refresh_estoque_contagem(p_bar integer, p_dias integer DEFAULT 14)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'silver', 'operations', 'public'
AS $function$
declare v int;
begin
  with relevant as (
    select * from operations.contagem_estoque_insumos o
    where o.bar_id = p_bar and o.data_contagem >= current_date - p_dias
  ),
  precos as materialized (
    select bb.bar_id, upper(coalesce(bb.codigo_planilha, bb.cod_interno)) as cod,
           pp.data::date as ddata, pi.preco
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido pp on pp.id_pedido = pi.id_pedido and pp.bar_id = pi.bar_id
    join public.bronze_vmarket_produtos bb on bb.id_produto_sisfood_cotacao = pi.id_produto_sisfood_cotacao and bb.bar_id = pi.bar_id
    where pi.bar_id = p_bar and pp.data::date <= current_date
  ),
  px as (
    select distinct on (o.bar_id, o.data_contagem, o.insumo_codigo)
      o.bar_id, o.data_contagem, o.insumo_codigo, p.preco
    from relevant o
    join precos p on p.cod = upper(o.insumo_codigo) and p.ddata <= o.data_contagem
    order by o.bar_id, o.data_contagem, o.insumo_codigo, p.ddata desc, p.preco desc
  ),
  resolved as (
    select o.*,
      (case when nullif(px.preco, 0) is not null
              and not (coalesce(o.custo_unitario, 0) > 0 and px.preco > o.custo_unitario * 5)
            then px.preco end) as vm
    from relevant o
    left join px on px.bar_id = o.bar_id and px.data_contagem = o.data_contagem and px.insumo_codigo = o.insumo_codigo
  )
  insert into silver.estoque_contagem
    (bar_id, data_contagem, insumo_codigo, insumo_id, insumo_nome, tipo_contagem,
     categoria, tipo_local, unidade_medida, estoque_fechado, estoque_flutuante, estoque_final,
     preco_vmarket, preco_fonte, valor, curva_a, atualizado_em)
  select r.bar_id, r.data_contagem, r.insumo_codigo, r.insumo_id, r.insumo_nome, r.tipo_contagem,
         r.categoria, r.tipo_local, r.unidade_medida, r.estoque_fechado, r.estoque_flutuante, r.estoque_final,
         r.vm,
         case when r.vm is not null then 'vmarket'
              when coalesce(r.custo_unitario,0) > 0 then 'cadastro'
              else 'sem_preco' end,
         coalesce(r.estoque_final,0) * coalesce(r.vm, r.custo_unitario, 0),
         coalesce(r.curva_a, false),
         now()
  from resolved r
  on conflict (bar_id, data_contagem, insumo_codigo) do update set
    insumo_id=excluded.insumo_id, insumo_nome=excluded.insumo_nome, tipo_contagem=excluded.tipo_contagem,
    categoria=excluded.categoria, tipo_local=excluded.tipo_local, unidade_medida=excluded.unidade_medida,
    estoque_fechado=excluded.estoque_fechado, estoque_flutuante=excluded.estoque_flutuante, estoque_final=excluded.estoque_final,
    preco_vmarket=excluded.preco_vmarket, preco_fonte=excluded.preco_fonte, valor=excluded.valor,
    curva_a=excluded.curva_a, atualizado_em=excluded.atualizado_em;
  get diagnostics v = row_count;

  delete from silver.estoque_contagem s
  where s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and not exists (select 1 from operations.contagem_estoque_insumos o
                    where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo);
  return v;
end $function$;
