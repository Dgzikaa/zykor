-- Em dia de evento Yuzer, a matview silver.vendas_consolidada_dia trocava 100% pro Yuzer
-- e DESCARTAVA o ContaHub, perdendo as CORTESIAS (comida feita de graça que o Yuzer não
-- captura). O sócio confirmou que no dia de Yuzer usam o ContaHub justamente p/ cortesias.
-- Fix: contar dos 2 — Yuzer (pago) + cortesias do ContaHub, mescladas em UMA linha por
-- (bar,data,cod_interno) (índice único não tem fonte). Pago do ContaHub em dia de evento é
-- ~0 (vai tudo pro Yuzer), então não há double-count. Só muda qtd_consumo.
-- Cascata: as 3 matviews dependentes (gold.cmv_teorico_dia, silver.consumo_producao_dia,
-- silver.consumo_teorico_insumo_dia) herdam o qtd_consumo corrigido no refresh.
-- Aplicada em prod via MCP em 2026-06-29 (migration vendas_consolidada_cortesia_dia_evento).

drop materialized view if exists silver.vendas_consolidada_dia cascade;

create materialized view silver.vendas_consolidada_dia as
 with dias as (
   select bar_id, data_evento as data, bool_or(coalesce(usa_yuzer,false)) as usa_yuzer
   from operations.eventos_base group by bar_id, data_evento
 ), ch as (
   select v.bar_id, v.data, v.cod_interno,
     sum(v.qtd_venda) as qtd_venda, sum(v.qtd_consumo) as qtd_consumo,
     sum(v.qtd_cortesia) as qtd_cortesia, sum(v.valor) as valor
   from silver.vendas_produto_dia v where v.cod_interno is not null
   group by v.bar_id, v.data, v.cod_interno
 ), yz as (
   select y.bar_id, y.data_evento as data, m.cod_interno,
     sum(greatest(coalesce(y.quantidade,0)-coalesce(y.returned_quantity,0),0)) as qtd,
     sum(greatest(coalesce(y.valor_total,0::numeric)-coalesce(y.returned_total,0::numeric),0::numeric)) as valor
   from silver.yuzer_produtos_evento y
   join produto_yuzer_map m on m.bar_id=y.bar_id and m.yuzer_produto_id=y.produto_id
   where coalesce(y.eh_ingresso,false)=false and m.cod_interno is not null
   group by y.bar_id, y.data_evento, m.cod_interno
 )
 select c.bar_id, c.data, c.cod_interno, 'contahub'::text as fonte,
   c.qtd_venda, c.qtd_consumo, c.valor
 from ch c left join dias d on d.bar_id=c.bar_id and d.data=c.data
 where coalesce(d.usa_yuzer,false)=false and (c.qtd_consumo>0::numeric or c.valor>0::numeric)
 union all
 select coalesce(y.bar_id,c.bar_id) as bar_id, coalesce(y.data,c.data) as data,
   coalesce(y.cod_interno,c.cod_interno) as cod_interno, 'yuzer'::text as fonte,
   coalesce(y.qtd,0) as qtd_venda,
   coalesce(y.qtd,0) + coalesce(c.qtd_cortesia,0) as qtd_consumo,
   coalesce(y.valor,0) as valor
 from (select yz.* from yz join dias d on d.bar_id=yz.bar_id and d.data=yz.data and d.usa_yuzer) y
 full outer join (select ch.* from ch join dias d on d.bar_id=ch.bar_id and ch.data=d.data and d.usa_yuzer and ch.qtd_cortesia>0::numeric) c
   on c.bar_id=y.bar_id and c.data=y.data and c.cod_interno=y.cod_interno
 where coalesce(y.qtd,0) + coalesce(c.qtd_cortesia,0) > 0::numeric;

create unique index uq_vendas_consolidada_dia on silver.vendas_consolidada_dia using btree (bar_id, data, cod_interno);

create materialized view gold.cmv_teorico_dia as
 select v.bar_id, v.data,
   round(sum(v.valor), 2) as faturamento,
   round(sum(v.qtd_consumo * coalesce(cm.custo, 0::numeric)), 2) as custo,
   case when sum(v.valor) > 0::numeric then round(sum(v.qtd_consumo * coalesce(cm.custo, 0::numeric)) / sum(v.valor) * 100::numeric, 2) else null::numeric end as cmv_pct
 from silver.vendas_consolidada_dia v
 join produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
 left join gold.produto_cmv cm on cm.bar_id=v.bar_id and cm.produto_id=pc.id
 group by v.bar_id, v.data;
create unique index cmv_teorico_dia_uk on gold.cmv_teorico_dia using btree (bar_id, data);

create materialized view silver.consumo_producao_dia as
 select v.bar_id, v.data, ppp.producao_cod, sum(v.qtd_consumo * ppp.qtd_por_produto) as qtd_teorica
 from silver.vendas_consolidada_dia v
 join silver.producao_por_produto ppp on ppp.bar_id=v.bar_id and ppp.produto_cod=v.cod_interno
 group by v.bar_id, v.data, ppp.producao_cod;
create unique index consumo_producao_dia_uk on silver.consumo_producao_dia using btree (bar_id, data, producao_cod);

create materialized view silver.consumo_teorico_insumo_dia as
 select v.bar_id, v.data, ipp.insumo_codigo, sum(v.qtd_consumo * ipp.qtd_por_produto) as qtd_teorica
 from silver.vendas_consolidada_dia v
 join silver.insumo_por_produto ipp on ipp.bar_id=v.bar_id and ipp.produto_cod=v.cod_interno
 group by v.bar_id, v.data, ipp.insumo_codigo;
create unique index uq_consumo_teorico_insumo_dia on silver.consumo_teorico_insumo_dia using btree (bar_id, data, insumo_codigo);

notify pgrst, 'reload schema';
