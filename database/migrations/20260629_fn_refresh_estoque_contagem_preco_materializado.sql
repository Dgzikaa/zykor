-- Fix de timeout (502) no "Sincronizar planilha" do /operacional/estoque-historico.
-- silver.fn_refresh_estoque_contagem buscava o preço VMarket vigente por LATERAL por linha de
-- contagem; como gold.vmarket_pedido é uma VIEW que reagrega o bronze, ela era re-executada
-- ~1383x → 7,5s só no bar 3 → estourava o statement_timeout (a chamada do RPC é 1 statement).
-- Caso clássico de [[feedback_unaccent_lateral_timeout]] / [[feedback_view_pesada_postgrest_timeout]].
--
-- Fix: materializar os preços do VMarket UMA vez (CTE `precos` MATERIALIZED) e resolver o preço
-- vigente na data com DISTINCT ON (hash join único) em vez de lateral por linha.
-- Medido: 7459ms -> 56ms na consulta; cadeia completa fn_refresh_contagem_estoque = 586ms.
-- Valores idênticos aos da lógica antiga (só desempate de mesma data agora é determinístico: preco desc).
-- Aplicada em prod via MCP em 2026-06-29.
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
  )
  insert into silver.estoque_contagem
    (bar_id, data_contagem, insumo_codigo, insumo_id, insumo_nome, tipo_contagem,
     categoria, tipo_local, unidade_medida, estoque_fechado, estoque_flutuante, estoque_final,
     preco_vmarket, preco_fonte, valor, curva_a, atualizado_em)
  select o.bar_id, o.data_contagem, o.insumo_codigo, o.insumo_id, o.insumo_nome, o.tipo_contagem,
         o.categoria, o.tipo_local, o.unidade_medida, o.estoque_fechado, o.estoque_flutuante, o.estoque_final,
         px.preco,
         case when px.preco is not null then 'vmarket'
              when coalesce(o.custo_unitario,0) > 0 then 'cadastro'
              else 'sem_preco' end,
         coalesce(o.estoque_final,0) * coalesce(px.preco, o.custo_unitario, 0),
         coalesce(o.curva_a, false),
         now()
  from relevant o
  left join px on px.bar_id = o.bar_id and px.data_contagem = o.data_contagem and px.insumo_codigo = o.insumo_codigo
  on conflict (bar_id, data_contagem, insumo_codigo) do update set
    insumo_id        = excluded.insumo_id,
    insumo_nome      = excluded.insumo_nome,
    tipo_contagem    = excluded.tipo_contagem,
    categoria        = excluded.categoria,
    tipo_local       = excluded.tipo_local,
    unidade_medida   = excluded.unidade_medida,
    estoque_fechado  = excluded.estoque_fechado,
    estoque_flutuante= excluded.estoque_flutuante,
    estoque_final    = excluded.estoque_final,
    preco_vmarket    = excluded.preco_vmarket,
    preco_fonte      = excluded.preco_fonte,
    valor            = excluded.valor,
    curva_a          = excluded.curva_a,
    atualizado_em    = excluded.atualizado_em;
  get diagnostics v = row_count;

  delete from silver.estoque_contagem s
  where s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and not exists (select 1 from operations.contagem_estoque_insumos o
                    where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo);
  return v;
end $function$;
