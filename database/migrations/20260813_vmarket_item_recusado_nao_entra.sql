-- Item RECUSADO/CANCELADO do pedido VMarket não pode entrar como compra
--
-- Problema (Isaías, 13/08/2026): o pedido é confirmado como um todo ("Entrega Confirmada",
-- id_pedido_status=6), mas DENTRO dele pode haver item que não veio — o VMarket marca o item com
-- id_pedido_item_status=5 ("Recusado - quantidade mínima"), preço 0 e total 0. As views gold não
-- olhavam o status do ITEM, só do PEDIDO, então a quantidade do item recusado entrava como compra.
--
-- Caso real: pedido 4109044 (Ordinário, SEARA, entrega 12/08) — cotaram 77 kg de Frango a Passarinho
-- (i0123), recusaram e compraram só a linguiça de frango. Como o pedido foi conferido, os 77 kg
-- entravam no Desvio de Consumo como entrada de graça → perda falsa. Mesmo padrão em 60+ itens:
-- 648 un de Spaten (Deboche 09/06), 336 un de Red Bull (Ordinário 01/07), 20 kg de Mussarela etc.
--
-- Correção estrutural: o filtro entra na VIEW, não em cada função. Assim todos os consumidores
-- (fn_desvios, fn_desvios_proteina, fn_plano_compras, fn_compras_analises, fn_compras_caras,
-- fn_insumo_custo_un_asof, silver.fn_refresh_estoque_contagem e a tela de Compras) ficam certos de
-- uma vez — e qualquer consumidor novo já nasce certo.
--
-- gold.vmarket_pedido_item        -> só o que realmente foi comprado (padrão para cálculo)
-- gold.vmarket_pedido_item_todos  -> tudo, com o status do item (auditoria/tela)

-- Regra única do que é "item que não veio". Além do status 5 conhecido, casa pelo nome do status
-- (recusado/cancelado) para já cobrir código novo que o VMarket venha a mandar.
create or replace function gold.vmarket_item_recusado(p_status integer, p_nome_status text)
returns boolean language sql immutable as $$
  select coalesce(p_status = 5, false)
      or coalesce(p_nome_status ~* '(recusad|cancelad)', false);
$$;

comment on function gold.vmarket_item_recusado(integer, text) is
  'Item do pedido VMarket que NÃO entrou (recusado/cancelado). Não conta como compra.';

create or replace view gold.vmarket_pedido_item_todos as
select
  i.bar_id,
  i.id_pedido,
  i.id_pedido_item,
  i.id_produto_sisfood_cotacao,
  i.nome_cotacao,
  i.marca_cotacao,
  i.gramatura_cotacao,
  i.preco,
  i.quantidade,
  i.total,
  pr.cod_interno,
  pr.nome_secao,
  pr.nome_fornecedor as produto_fornecedor,
  i.id_pedido_item_status,
  nullif(i.raw ->> 'nome_status_item', '') as nome_status_item,
  gold.vmarket_item_recusado(i.id_pedido_item_status, i.raw ->> 'nome_status_item') as recusado
from public.bronze_vmarket_pedido_itens i
left join public.bronze_vmarket_produtos pr
  on pr.bar_id = i.bar_id and pr.id_produto_sisfood_cotacao = i.id_produto_sisfood_cotacao;

comment on view gold.vmarket_pedido_item_todos is
  'Itens do pedido VMarket INCLUINDO os recusados/cancelados (coluna recusado). Use para auditoria/tela; para cálculo use gold.vmarket_pedido_item.';

-- mesmas colunas e ordem de antes + status do item no fim (create or replace só deixa acrescentar)
create or replace view gold.vmarket_pedido_item as
select
  bar_id, id_pedido, id_pedido_item, id_produto_sisfood_cotacao,
  nome_cotacao, marca_cotacao, gramatura_cotacao,
  preco, quantidade, total,
  cod_interno, nome_secao, produto_fornecedor,
  id_pedido_item_status, nome_status_item
from gold.vmarket_pedido_item_todos
where not recusado;

comment on view gold.vmarket_pedido_item is
  'Itens do pedido VMarket que realmente entraram — recusado/cancelado fica de fora. Ver gold.vmarket_pedido_item_todos para a lista completa.';

-- cabeçalho do pedido: qtd_itens/valor_total passam a ignorar o item recusado e ganham a contagem
-- do que foi recusado, pra tela mostrar "2 itens recusados" em vez de sumir com eles calado.
create or replace view gold.vmarket_pedido as
select
  p.bar_id,
  p.id_pedido,
  p.dt_inclusao::date as data,
  p.dt_inclusao,
  coalesce(nullif(p.nome_fantasia, ''), p.razao_social) as fornecedor,
  p.cnpj,
  p.origem,
  p.id_pedido_status,
  p.id_cotacao_sisfood,
  p.id_precotacao,
  p.total_nfe,
  p.url_nfe,
  p.url_relatorio,
  p.comentario,
  count(i.id_pedido_item) filter (where not gold.vmarket_item_recusado(i.id_pedido_item_status, i.raw ->> 'nome_status_item')) as qtd_itens,
  coalesce(sum(i.total) filter (where not gold.vmarket_item_recusado(i.id_pedido_item_status, i.raw ->> 'nome_status_item')), 0)::numeric(14,2) as valor_total,
  (p.raw ->> 'nm_status_pedido') as nm_status,
  coalesce(m.dt_entrega, p.dt_entrega::date) as dt_entrega,
  nullif(p.raw ->> 'dt_prazo_entrega', '') as dt_prazo_entrega,
  p.dt_entrega::date as dt_entrega_vmarket,
  (m.dt_entrega is not null) as dt_entrega_manual,
  count(i.id_pedido_item) filter (where gold.vmarket_item_recusado(i.id_pedido_item_status, i.raw ->> 'nome_status_item')) as qtd_itens_recusados
from public.bronze_vmarket_pedidos p
left join public.bronze_vmarket_pedido_itens i
  on i.bar_id = p.bar_id and i.id_pedido = p.id_pedido
left join operations.pedido_entrega_manual m
  on m.bar_id = p.bar_id and m.id_pedido = p.id_pedido
group by p.bar_id, p.id_pedido, p.dt_inclusao, p.nome_fantasia, p.razao_social, p.cnpj, p.origem,
         p.id_pedido_status, p.id_cotacao_sisfood, p.id_precotacao, p.total_nfe, p.url_nfe,
         p.url_relatorio, p.comentario, p.dt_entrega, (p.raw ->> 'nm_status_pedido'),
         (p.raw ->> 'dt_prazo_entrega'), m.dt_entrega;

grant select on gold.vmarket_pedido_item_todos to service_role;
