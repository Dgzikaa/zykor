-- Item 4 (reunião Produção 07/07): permitir alterar na mão a data de ENTREGA do pedido VMarket,
-- mantendo visível o valor original do VMarket e marcando que foi alterado manualmente.
--
-- Como o desvio conta a compra por coalesce(dt_entrega, data) e a v_desvios lê gold.vmarket_pedido,
-- basta o override entrar na própria view (coalesce(manual, vmarket)) que o desvio já respeita.

create table if not exists operations.pedido_entrega_manual (
  bar_id       integer not null,
  id_pedido    bigint  not null,
  dt_entrega   date    not null,
  usuario      text,
  atualizado_em timestamptz not null default now(),
  primary key (bar_id, id_pedido)
);

-- View com override manual da data de entrega. dt_entrega = manual (se houver) senão a do VMarket;
-- dt_entrega_vmarket = sempre a original; dt_entrega_manual = true quando alterada na mão.
CREATE OR REPLACE VIEW gold.vmarket_pedido AS
 SELECT p.bar_id,
    p.id_pedido,
    p.dt_inclusao::date AS data,
    p.dt_inclusao,
    COALESCE(NULLIF(p.nome_fantasia, ''::text), p.razao_social) AS fornecedor,
    p.cnpj,
    p.origem,
    p.id_pedido_status,
    p.id_cotacao_sisfood,
    p.id_precotacao,
    p.total_nfe,
    p.url_nfe,
    p.url_relatorio,
    p.comentario,
    count(i.id_pedido_item) AS qtd_itens,
    COALESCE(sum(i.total), 0::numeric)::numeric(14,2) AS valor_total,
    p.raw ->> 'nm_status_pedido'::text AS nm_status,
    COALESCE(m.dt_entrega, p.dt_entrega::date) AS dt_entrega,
    NULLIF(p.raw ->> 'dt_prazo_entrega'::text, ''::text) AS dt_prazo_entrega,
    p.dt_entrega::date AS dt_entrega_vmarket,
    (m.dt_entrega IS NOT NULL) AS dt_entrega_manual
   FROM public.bronze_vmarket_pedidos p
     LEFT JOIN public.bronze_vmarket_pedido_itens i ON i.bar_id = p.bar_id AND i.id_pedido = p.id_pedido
     LEFT JOIN operations.pedido_entrega_manual m ON m.bar_id = p.bar_id AND m.id_pedido = p.id_pedido
  GROUP BY p.bar_id, p.id_pedido, p.dt_inclusao, p.nome_fantasia, p.razao_social, p.cnpj, p.origem,
           p.id_pedido_status, p.id_cotacao_sisfood, p.id_precotacao, p.total_nfe, p.url_nfe, p.url_relatorio,
           p.comentario, p.dt_entrega, (p.raw ->> 'nm_status_pedido'::text), (p.raw ->> 'dt_prazo_entrega'::text),
           m.dt_entrega;