-- ============================================================================
-- Multiplicador na Ficha Técnica de FINALIZAÇÃO (pedido Gonza 06/07).
-- Ex.: "Mega Coxinha (5x)" — a FT é escrita por 1 unidade (a equipe conta coxinha
-- por unidade no estoque), mas o produto VENDIDO é uma porção de 5. O CMV teórico
-- do produto usa o Custo TOTAL = custo unitário da ficha × multiplicador.
--   Custo Unitário = soma da ficha (por 1 unidade)
--   Custo Total    = Custo Unitário × multiplicador  <- usado no CMV teórico
-- Só faz sentido em produto_cardapio (finalização); produções seguem por rendimento.
-- ============================================================================

alter table public.produto_cardapio
  add column if not exists multiplicador integer not null default 1;
alter table public.produto_cardapio
  drop constraint if exists produto_cardapio_multiplicador_chk;
alter table public.produto_cardapio
  add constraint produto_cardapio_multiplicador_chk check (multiplicador >= 1);

-- espelho no CMV pra a tela poder exibir unitário × total sem recalcular a ficha
alter table gold.produto_cmv
  add column if not exists multiplicador integer not null default 1;

-- ----------------------------------------------------------------------------
-- fn_cmv_teorico: o custo da finalização passa a ser Custo Total (× multiplicador).
-- Ver database/functions/fn_cmv_teorico.sql para a definição canônica da função.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico(p_bar_id integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'operations'
AS $function$
declare v int;
begin
  drop table if exists _cu;
  create temp table _cu as select codigo, custo_un from gold.insumo_custo_un where bar_id=p_bar_id and custo_un is not null;

  drop table if exists _prod;
  create temp table _prod as select pb.id, pb.rendimento, null::numeric custo_un, false resolvido from public.producao_base pb where pb.bar_id=p_bar_id;
  for i in 1..6 loop
    update _prod p set custo_un = case when p.rendimento>0 then x.total/p.rendimento else 0 end, resolvido=true
    from (select fi.producao_id,
        sum((case when fi.componente_tipo='insumo' then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0) + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
                 when fi.componente_tipo='producao' then coalesce(fi.quantidade,0)*coalesce(ref.custo_un,0) else 0 end) / coalesce(nullif(fi.fator_correcao,0),1)) total,
        bool_and(case when fi.componente_tipo='producao' then coalesce(ref.resolvido,false) else true end) all_ok
      from public.producao_ficha_item fi
      left join _cu cu on cu.codigo=fi.insumo_codigo left join _prod ref on ref.id=fi.producao_ref
      where fi.producao_id is not null group by fi.producao_id) x
    where p.id=x.producao_id and not p.resolvido and x.all_ok;
  end loop;

  delete from gold.produto_cmv where bar_id=p_bar_id;
  -- fc.custo = custo UNITÁRIO (soma da ficha por 1 unid). Custo TOTAL = fc.custo * multiplicador.
  insert into gold.produto_cmv (bar_id, produto_id, codigo, nome, categoria, ativo, custo, preco_venda, cmv_pct, margem, itens_ficha, multiplicador)
  select p_bar_id, pc.id, pc.codigo, pc.nome, pc.categoria, pc.ativo,
    (fc.custo * coalesce(pc.multiplicador,1)) as custo,
    pv.preco_venda,
    case when pv.preco_venda>0 and fc.custo is not null then round((fc.custo*coalesce(pc.multiplicador,1))/pv.preco_venda*100,2) else null end,
    case when pv.preco_venda>0 and fc.custo is not null then round(pv.preco_venda-(fc.custo*coalesce(pc.multiplicador,1)),2) else null end,
    coalesce(fc.itens,0),
    coalesce(pc.multiplicador,1)
  from public.produto_cardapio pc
  left join lateral (select count(*) itens, sum((case
      when fi.componente_tipo='insumo' then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0) + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
      when fi.componente_tipo='producao' then coalesce(fi.quantidade,0)*coalesce(ref.custo_un,0) else 0 end) / coalesce(nullif(fi.fator_correcao,0),1)) custo
    from public.producao_ficha_item fi
    left join _cu cu on cu.codigo=fi.insumo_codigo left join _prod ref on ref.id=fi.producao_ref
    where fi.produto_id=pc.id) fc on true
  left join lateral (select coalesce(
      (select max(m.preco_venda) from public.produto_contahub_map m where m.bar_id=p_bar_id and m.cod_interno=pc.codigo and m.preco_venda>0),
      (select py.preco_yuzer from gold.produto_preco_yuzer py where py.bar_id=p_bar_id and py.cod_interno=pc.codigo)
    ) preco_venda) pv on true
  where pc.bar_id=p_bar_id;
  -- produtos agrupados herdam custo/preço/cmv do principal (inclui o multiplicador dele)
  update gold.produto_cmv v
  set custo = p.custo, preco_venda = p.preco_venda, cmv_pct = p.cmv_pct, margem = p.margem, itens_ficha = p.itens_ficha, multiplicador = p.multiplicador
  from public.produto_cardapio pcv
  join gold.produto_cmv p on p.bar_id=p_bar_id and p.codigo = pcv.agrupado_em
  where v.bar_id=p_bar_id and v.codigo = pcv.codigo and pcv.bar_id=p_bar_id and pcv.agrupado_em is not null;
  get diagnostics v=row_count; return v;
end $function$;

-- ----------------------------------------------------------------------------
-- cmv_teorico_dia: CMV teórico considera SÓ venda paga (exclui cortesia).
-- Decisão Gonza 06/07: cortesia entra na SAÍDA de insumo / DESVIO (qtd_consumo),
-- mas o CMV teórico do produto usa só a venda paga (qtd_venda). A tela por período
-- (fn_cmv_teorico_periodo) já usava qtd_venda; aqui alinhamos o diário/semanal, que
-- estava usando qtd_consumo. custo = Custo Total (produto_cmv.custo já traz o mult).
-- ----------------------------------------------------------------------------
drop materialized view if exists gold.cmv_teorico_dia;
create materialized view gold.cmv_teorico_dia as
 select v.bar_id,
    v.data,
    round(sum(v.valor), 2) as faturamento,
    round(sum(v.qtd_venda * coalesce(cm.custo, 0::numeric)), 2) as custo,
        case
            when sum(v.valor) > 0::numeric then round(sum(v.qtd_venda * coalesce(cm.custo, 0::numeric)) / sum(v.valor) * 100::numeric, 2)
            else null::numeric
        end as cmv_pct
   from silver.vendas_consolidada_dia v
     join public.produto_cardapio pc on pc.bar_id = v.bar_id and pc.codigo = v.cod_interno
     left join gold.produto_cmv cm on cm.bar_id = v.bar_id and cm.produto_id = pc.id
  group by v.bar_id, v.data
 with data;

create unique index cmv_teorico_dia_uk on gold.cmv_teorico_dia using btree (bar_id, data);

revoke all on gold.cmv_teorico_dia from anon;
grant select on gold.cmv_teorico_dia to authenticated, service_role;
