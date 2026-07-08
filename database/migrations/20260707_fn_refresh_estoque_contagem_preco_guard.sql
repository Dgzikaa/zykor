-- 2026-07-07 — Fix da VALORIZAÇÃO do estoque (silver.fn_refresh_estoque_contagem).
--
-- Sintoma (Deboche): estoque do Zykor ~30% acima da planilha (contagens idênticas, só o preço
-- unitário divergia). DUAS causas:
--   1) PEDIDO RECENTE COM PREÇO 0: o VMarket manda o pedido feito mas ainda não precificado/
--      entregue com preco=0 (o preço fecha na entrega). A função pegava o pedido MAIS RECENTE
--      (preco 0) em vez do último PRECIFICADO → zerava o item. Ex.: Spaten I0362 tinha 01/07=0,00
--      mas 16/06=R$7,02. → 148 itens zerados no Deboche. (VMarket do bar está conectado e recebendo
--      pedidos; o problema era só a resolução do preço.)
--   2) PREÇO DE EMBALAGEM/CAIXA num item contado por unidade (Pastel cx 32un = R$206,40 × qtd →
--      inflava ~32×). O custo_unitario da contagem já tinha o preço certo por unidade.
--
-- Fix:
--   (1) a CTE `precos` só considera item de pedido com preco > 0 → px pega o último preço REAL.
--   (2) o `resolved` descarta o preço quando é >5x o custo_unitario conhecido (embalagem trocada);
--       nesse caso, e quando não há VMarket precificado, cai pro custo_unitario (cadastro).
-- Princípio (validado com o sócio): usar o VMarket (preço realmente pago) nos itens atuais; o
-- cadastro é só fallback pra item sem compra precificada. Deboche 06/07: 65.941 → 49.090
-- (162 itens fonte vmarket, 146 cadastro, 5 sem preço). Aplicada em prod + re-rodado bar 3 e 4.
-- OBS: muda valores de estoque/desvios/CMV dos 2 bares (pra mais correto).

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
      and coalesce(pi.preco, 0) > 0            -- ignora pedido ainda não precificado (preco 0)
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
      -- descarta o preço VMarket quando é >5x o custo_unitario conhecido (= quase sempre preço da
      -- EMBALAGEM/caixa num item contado por unidade). Nesses casos cai pro custo_unitario.
      (case when px.preco is not null
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
