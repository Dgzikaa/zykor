-- 2026-07-14 — BUG: aba "Produção" do estoque-histórico (e Deboche em geral) não puxava a
-- contagem das produções (pc/pd).
--
-- CAUSA RAIZ: silver.fn_refresh_estoque_contagem (chamada pelo sync-contagem-sheets) fazia o
-- INSERT em silver.estoque_contagem SEM a coluna `classe`. Como o DEFAULT da coluna é 'insumo',
-- TODA linha nova (produção, limpeza, utensílio) entrava rotulada como 'insumo'. O backfill de
-- jul/2026 retagueou o histórico, mas cada sync novo reintroduzia o bug nas datas novas.
--   → A tela filtra por classe='producao' e não achava nada recente ("não puxa").
--   → Pior: reinflava a aba Insumo e (para limpeza/utensílio) contaminava o CMV.
--
-- FIX: o refresh passa a carregar `classe` vindo de operations.contagem_estoque_insumos
-- (que já deriva produção por ^P[CD] e usa a classe do cadastro p/ limpeza/utensílio).
-- A produção continua dentro do filtro do CMV (classe in ('insumo','producao')) → CMV neutro.

CREATE OR REPLACE FUNCTION silver.fn_refresh_estoque_contagem(p_bar integer, p_dias integer DEFAULT 14, p_force boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'silver', 'operations', 'public'
AS $function$
declare v int;
begin
  with relevant as (
    select * from operations.contagem_estoque_insumos o
    where o.bar_id = p_bar
      and o.data_contagem >= current_date - p_dias
      and (p_force or o.data_contagem >= current_date)
  ),
  precos as materialized (
    select bb.bar_id, upper(coalesce(bb.codigo_planilha, bb.cod_interno)) as cod,
           pp.data::date as ddata, pi.preco
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido pp on pp.id_pedido = pi.id_pedido and pp.bar_id = pi.bar_id
    join public.bronze_vmarket_produtos bb on bb.id_produto_sisfood_cotacao = pi.id_produto_sisfood_cotacao and bb.bar_id = pi.bar_id
    where pi.bar_id = p_bar and pp.data::date <= current_date
      and coalesce(pi.preco, 0) > 0
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
     preco_vmarket, preco_fonte, preco_unitario, valor, curva_a, classe, congelado, congelado_em, atualizado_em)
  select r.bar_id, r.data_contagem, r.insumo_codigo, r.insumo_id, r.insumo_nome, r.tipo_contagem,
         r.categoria, r.tipo_local, r.unidade_medida, r.estoque_fechado, r.estoque_flutuante, r.estoque_final,
         r.vm,
         case when r.vm is not null then 'vmarket'
              when coalesce(r.plan_price,0) > 0 then 'planilha'
              when coalesce(r.custo_unitario,0) > 0 then 'cadastro'
              else 'sem_preco' end,
         coalesce(r.vm, r.plan_price, r.custo_unitario, 0),
         coalesce(r.estoque_final,0) * coalesce(r.vm, r.plan_price, r.custo_unitario, 0),
         coalesce(r.curva_a, false),
         coalesce(r.classe, 'insumo'),
         false, null, now()
  from resolved r
  on conflict (bar_id, data_contagem, insumo_codigo) do update set
    insumo_id=excluded.insumo_id, insumo_nome=excluded.insumo_nome, tipo_contagem=excluded.tipo_contagem,
    categoria=excluded.categoria, tipo_local=excluded.tipo_local, unidade_medida=excluded.unidade_medida,
    estoque_fechado=excluded.estoque_fechado, estoque_flutuante=excluded.estoque_flutuante, estoque_final=excluded.estoque_final,
    preco_vmarket=excluded.preco_vmarket, preco_fonte=excluded.preco_fonte, preco_unitario=excluded.preco_unitario,
    valor=excluded.valor, curva_a=excluded.curva_a, classe=excluded.classe, atualizado_em=excluded.atualizado_em
    where estoque_contagem.congelado = false;
  get diagnostics v = row_count;

  update silver.estoque_contagem
     set congelado = true, congelado_em = now()
   where bar_id = p_bar and data_contagem < current_date and congelado = false;

  -- Propaga CORREÇÃO DE CONTAGEM em datas passadas (mesmo congeladas): atualiza SÓ a quantidade
  -- e o valor (recalculado com o PREÇO JÁ CONGELADO). O preço fica intocado (esquema VMarket
  -- date-anchored, passado imutável).
  update silver.estoque_contagem s
     set estoque_final = o.estoque_final,
         valor = round(coalesce(o.estoque_final,0) * coalesce(s.preco_unitario,0), 2),
         atualizado_em = now()
  from operations.contagem_estoque_insumos o
  where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo
    and s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and round(coalesce(o.estoque_final,0),3) <> round(coalesce(s.estoque_final,0),3);

  delete from silver.estoque_contagem s
  where s.bar_id = p_bar and s.data_contagem >= current_date - p_dias
    and s.congelado = false
    and not exists (select 1 from operations.contagem_estoque_insumos o
                    where o.bar_id = s.bar_id and o.data_contagem = s.data_contagem and o.insumo_codigo = s.insumo_codigo);
  return v;
end $function$;

-- Backfill CMV-NEUTRO: retag produção (^P[CD]) que ficou rotulada 'insumo' em silver.
-- Produção continua no filtro do CMV (classe in ('insumo','producao')), então o CMV não muda —
-- só volta a aparecer na aba Produção e sai da aba Insumo.
UPDATE silver.estoque_contagem
   SET classe = 'producao'
 WHERE classe = 'insumo' AND insumo_codigo ~* '^P[CD]';

-- Backfill CMV-CORRETIVO (aprovado pelo dono 14/07): limpeza (L) e utensílio (U) estavam rotulados
-- 'insumo' em silver e vazavam pro Estoque Final do CMV (buckets filtram classe in insumo,producao).
-- Não fazem parte do CMV (Insumos − Alimentação + Produções). Retag remove o vazamento (~R$30k no
-- bar 3, semanas recentes). A função já os exclui do CMV nos syncs futuros.
UPDATE silver.estoque_contagem
   SET classe = CASE WHEN insumo_codigo ~* '^L' THEN 'limpeza' ELSE 'utensilio' END
 WHERE classe = 'insumo' AND (insumo_codigo ~* '^L' OR insumo_codigo ~* '^U');
