-- Recebíveis Sympla por evento (líquido a receber, já sem cancelados 'C').
-- Base da aba "Sympla" em Receitas CA.
create or replace view silver.sympla_recebiveis_evento as
select
  p.bar_id,
  p.event_id,
  e.name                                as nome_evento,
  e.start_date::date                    as dt_evento,
  count(*) filter (where p.order_status='A' and p.order_total_net_value > 0)                       as pedidos,
  coalesce(sum(p.order_total_sale_price) filter (where p.order_status='A'), 0)::numeric(14,2)      as bruto,
  coalesce(sum(p.order_total_net_value)  filter (where p.order_status='A'), 0)::numeric(14,2)      as liquido,
  (coalesce(sum(p.order_total_sale_price) filter (where p.order_status='A'), 0)
   - coalesce(sum(p.order_total_net_value) filter (where p.order_status='A'), 0))::numeric(14,2)   as taxa,
  count(*) filter (where p.order_status='C')                                                       as cancelados,
  min(p.approved_date) filter (where p.order_status='A')                                           as primeira_venda,
  max(p.approved_date) filter (where p.order_status='A')                                           as ultima_venda
from bronze.bronze_sympla_pedidos p
left join bronze.bronze_sympla_eventos e on e.bar_id = p.bar_id and e.event_id = p.event_id
group by p.bar_id, p.event_id, e.name, e.start_date
having coalesce(sum(p.order_total_net_value) filter (where p.order_status='A'), 0) > 0;

comment on view silver.sympla_recebiveis_evento is
  'Recebíveis Sympla por evento: líquido a receber (Σ net dos aprovados), bruto, taxa, cancelados. Base da aba Sympla em Receitas CA.';
