-- =============================================================================
-- Custo histórico do CMV — modelo "C" (decidido com o Rodrigo em 11/08/2026)
-- =============================================================================
--
--   PREÇO do insumo = o da DATA (congelado pela compra). "o preço é congelado pela data
--     de compra, isso que faz o CMV aumentar ou não e a gente poder identificar isso".
--   FICHA = a ATUAL. Correção de gramatura/unidade é conserto de cadastro e vale para trás,
--     "sem mexer em nada do snap do preço na data".
--
-- Descartados:
--   A) tudo a preço de hoje (o que a matview fazia) → semana fechada muda sozinha quando um
--      insumo muda de preço, e a variação de preço contamina todo o histórico por igual.
--   B) snapshot puro (ficha da época × preço da época) → congela os ERROS junto. Foi o que
--      fez a correção da mandioca não valer no histórico: os snapshots de junho/julho
--      seguiam com o custo inflado.
--
-- ⚠️ RODAR DEPOIS DE TODA CORREÇÃO DE FICHA — senão a correção não chega no histórico:
--      select gold.fn_rebuild_produto_cmv_historico(3, '2026-06-01', current_date);
--      select gold.fn_rebuild_produto_cmv_historico(4, '2026-06-01', current_date);
--      select silver.fn_refresh_vendas_depara();
--
-- Replica a explosão de preparos (6 níveis) e o multiplicador do produto (dose dupla) de
-- gold.fn_cmv_teorico. Se divergir dela, o histórico deixa de ser comparável com o atual.
--
-- Custo medido: ~339 ms por data (bar 3: 47 datas / 30.620 linhas em 15,0 s;
-- bar 4: 47 datas / 16.034 linhas em 9,6 s).
-- Cobertura: gold.produto_cmv_historico só tem snapshot de 26/06/2026 em diante.
-- =============================================================================

create or replace function gold.fn_rebuild_produto_cmv_historico(
  p_bar integer,
  p_ini date,
  p_fim date
) returns table(datas integer, linhas integer, ms bigint)
language plpgsql
security definer
set search_path = gold, public, silver
as $$
declare
  v_t0 timestamptz := clock_timestamp();
  d date;
  v_datas integer := 0;
  v_linhas integer := 0;
  v_n integer;
begin
  for d in
    select distinct h.data_ref from gold.produto_cmv_historico h
     where h.bar_id = p_bar and h.data_ref between p_ini and p_fim
     order by 1
  loop
    -- preço do insumo NAQUELA data
    drop table if exists _cu;
    create temp table _cu as
      select x.codigo as cod, x.custo_un from gold.fn_insumo_custo_un_asof(p_bar, d) x
       where x.custo_un is not null;

    -- custo unitário dos preparos, resolvido em cascata (preparo dentro de preparo)
    drop table if exists _prod;
    create temp table _prod as
      select pb.id, pb.rendimento, null::numeric custo_un, false resolvido
        from public.producao_base pb where pb.bar_id = p_bar;

    for i in 1..6 loop
      update _prod p
         set custo_un = case when p.rendimento > 0 then x.total / p.rendimento else 0 end,
             resolvido = true
        from (
          select fi.producao_id,
                 sum((case
                        when fi.componente_tipo='insumo'
                          then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0)
                               + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
                        when fi.componente_tipo='producao'
                          then coalesce(fi.quantidade,0)*coalesce(ref.custo_un,0)
                        else 0 end) / coalesce(nullif(fi.fator_correcao,0),1)) total,
                 bool_and(case when fi.componente_tipo='producao'
                               then coalesce(ref.resolvido,false) else true end) all_ok
            from public.producao_ficha_item fi
            left join _cu cu on cu.cod = fi.insumo_codigo
            left join _prod ref on ref.id = fi.producao_ref
           where fi.producao_id is not null
           group by fi.producao_id
        ) x
       where p.id = x.producao_id and not p.resolvido and x.all_ok;
    end loop;

    -- regrava o custo do produto na data (ficha atual × preço da data × multiplicador)
    with novo as (
      select pc.id produto_id,
             (select sum((case
                            when fi.componente_tipo='insumo'
                              then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0)
                                   + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
                            when fi.componente_tipo='producao'
                              then coalesce(fi.quantidade,0)*coalesce(rf.custo_un,0)
                            else 0 end) / coalesce(nullif(fi.fator_correcao,0),1))
                from public.producao_ficha_item fi
                left join _cu cu on cu.cod = fi.insumo_codigo
                left join _prod rf on rf.id = fi.producao_ref
               where fi.produto_id = pc.id) * coalesce(pc.multiplicador,1) as custo
        from public.produto_cardapio pc
       where pc.bar_id = p_bar
    )
    update gold.produto_cmv_historico h
       set custo = novo.custo,
           cmv_pct = case when h.preco_venda > 0 and novo.custo is not null
                          then round(novo.custo / h.preco_venda * 100, 2) end
      from novo
     where h.bar_id = p_bar and h.data_ref = d and h.produto_id = novo.produto_id
       and novo.custo is not null;

    get diagnostics v_n = row_count;
    v_datas := v_datas + 1;
    v_linhas := v_linhas + v_n;
  end loop;

  return query select v_datas, v_linhas,
                      round(extract(epoch from (clock_timestamp() - v_t0)) * 1000)::bigint;
end;
$$;

comment on function gold.fn_rebuild_produto_cmv_historico(integer, date, date) is
  'Regrava gold.produto_cmv_historico no modelo C: ficha ATUAL x preco do insumo NA DATA. Rodar depois de corrigir ficha, para a correcao valer no historico sem mexer no preco da epoca.';
