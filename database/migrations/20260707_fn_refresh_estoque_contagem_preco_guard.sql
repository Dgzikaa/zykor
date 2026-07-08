-- 2026-07-07 — VALORIZAÇÃO do estoque (silver.fn_refresh_estoque_contagem): cascata de preço
-- correta = VMarket (preço REALMENTE PAGO no pedido) → PLANILHA (preço manual, p/ item sem compra
-- precificada) → cadastro → 0.
--
-- Bugs corrigidos (Deboche estava ~30% acima da planilha; contagens sempre idênticas, só o preço):
--   1) PEDIDO RECENTE COM PREÇO 0: o VMarket manda o pedido feito mas ainda não precificado/entregue
--      com preco=0. A função pegava o pedido MAIS RECENTE (0) em vez do último PRECIFICADO → zerava
--      148 itens. Fix: CTE `precos` só considera pedido com preco>0 → pega o último preço REAL pago.
--   2) EMBALAGEM/CAIXA: preço da caixa num item contado por unidade (Pastel cx 32un = R$206 × qtd
--      → inflava 32×). Fix: `resolved` descarta o VMarket quando é >5x o preço unitário conhecido.
--   3) FALLBACK errado: caía no custo_unitario do cadastro (diverge da planilha, ex.: Pimenta 40,91
--      vs 82,83). Fix: fallback passa a ser o PREÇO DA PLANILHA (bronze_contagem_sheet.preco_planilha
--      via CTE `planp`), que é a referência do time p/ item sem compra no VMarket.
--
-- Resultado (Deboche 06/07): 65.941 → 50.215 (planilha 50.425 = 99,6%). Os itens sem VMarket batem
-- EXATO com a planilha; sobra só ~R$210 nos itens VMarket = preço PAGO ≠ preço manual da planilha
-- (Zykor mais correto). Aplicada em prod + re-rodado bar 3 e 4. Muda estoque/desvios/CMV (pra melhor).

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
  planp as (
    select distinct on (bar_id, data_contagem, insumo_codigo)
      bar_id, data_contagem, insumo_codigo, preco_planilha
    from public.bronze_contagem_sheet
    where bar_id = p_bar and data_contagem >= current_date - p_dias
    order by bar_id, data_contagem, insumo_codigo, preco_planilha desc nulls last
  ),
  resolved as (
    select o.*,
      pl.preco_planilha as plan_price,
      (case when px.preco is not null
              and not (coalesce(nullif(o.custo_unitario,0), pl.preco_planilha, 0) > 0
                       and px.preco > coalesce(nullif(o.custo_unitario,0), pl.preco_planilha) * 5)
            then px.preco end) as vm
    from relevant o
    left join px on px.bar_id = o.bar_id and px.data_contagem = o.data_contagem and px.insumo_codigo = o.insumo_codigo
    left join planp pl on pl.bar_id = o.bar_id and pl.data_contagem = o.data_contagem and pl.insumo_codigo = o.insumo_codigo
  )
  insert into silver.estoque_contagem
    (bar_id, data_contagem, insumo_codigo, insumo_id, insumo_nome, tipo_contagem,
     categoria, tipo_local, unidade_medida, estoque_fechado, estoque_flutuante, estoque_final,
     preco_vmarket, preco_fonte, valor, curva_a, atualizado_em)
  select r.bar_id, r.data_contagem, r.insumo_codigo, r.insumo_id, r.insumo_nome, r.tipo_contagem,
         r.categoria, r.tipo_local, r.unidade_medida, r.estoque_fechado, r.estoque_flutuante, r.estoque_final,
         r.vm,
         case when r.vm is not null then 'vmarket'
              when coalesce(r.plan_price,0) > 0 then 'planilha'
              when coalesce(r.custo_unitario,0) > 0 then 'cadastro'
              else 'sem_preco' end,
         coalesce(r.estoque_final,0) * coalesce(r.vm, r.plan_price, r.custo_unitario, 0),
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
