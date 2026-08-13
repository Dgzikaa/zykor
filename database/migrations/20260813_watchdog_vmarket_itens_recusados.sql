-- Vigia: pedido conferido que veio com item RECUSADO
--
-- O numero agora esta certo (o item recusado nao entra mais como compra — ver
-- 20260813_vmarket_item_recusado_nao_entra.sql), mas o problema OPERACIONAL continua invisivel: o
-- insumo que a operacao pediu nao chegou e ninguem e avisado. O Isaias so achou os 77 kg de Frango a
-- Passarinho porque estranhou um numero na tela; foram 19 pedidos com item recusado em 60 dias.
--
-- Alerta UMA vez por pedido (chave de dedupe = bar + id_pedido), entao nao vira ruido diario.
-- Ignora linha que nao e mercadoria (imposto, outras despesas, frete).
create or replace function public.watchdog_vmarket_itens_recusados()
returns text
language plpgsql
security definer
set search_path to 'public', 'gold', 'pg_catalog'
as $function$
declare
  v_bar int;
  r record;
  v_lista text;
  v_qtd int;
  v_total int := 0;
  -- linha que nao e mercadoria: imposto/frete/despesa avulsa. O nome inteiro so existe no raw do
  -- bronze (nome_produto) — a gold cai em produto_fornecedor, e o "Imposto" da AMBEV virava
  -- "DEBOCHE BAR", passava pelo filtro e alertava a toa.
  c_ruido constant text := '(imposto|icms|ipi|pis|cofins|outras despesas|despesa|frete|taxa|desconto|acrescimo)';
begin
  foreach v_bar in array array[3, 4] loop
    for r in
      select p.id_pedido, p.fornecedor, coalesce(p.dt_entrega, p.data) as dt
      from gold.vmarket_pedido p
      where p.bar_id = v_bar
        and p.id_pedido_status = 6                                   -- pedido dado como conferido
        and coalesce(p.dt_entrega, p.data) >= current_date - 10
        and exists (
          select 1
          from gold.vmarket_pedido_item_todos i
          join public.bronze_vmarket_pedido_itens b
            on b.bar_id = i.bar_id and b.id_pedido_item = i.id_pedido_item
          where i.bar_id = p.bar_id and i.id_pedido = p.id_pedido and i.recusado
            and coalesce(nullif(i.nome_cotacao, ''), b.raw ->> 'nome_produto', i.produto_fornecedor, '') !~* c_ruido
        )
      order by dt desc
    loop
      select count(*),
             string_agg(
               coalesce(nullif(i.nome_cotacao, ''), b.raw ->> 'nome_produto', i.produto_fornecedor, i.cod_interno, '(sem nome)')
               || ' — ' || trim(to_char(i.quantidade, 'FM999999990.00'))
               || coalesce(' ' || nullif(i.gramatura_cotacao, ''), ''),
               '; ' order by i.quantidade desc)
        into v_qtd, v_lista
      from gold.vmarket_pedido_item_todos i
      join public.bronze_vmarket_pedido_itens b
        on b.bar_id = i.bar_id and b.id_pedido_item = i.id_pedido_item
      where i.bar_id = v_bar and i.id_pedido = r.id_pedido and i.recusado
        and coalesce(nullif(i.nome_cotacao, ''), b.raw ->> 'nome_produto', i.produto_fornecedor, '') !~* c_ruido;

      perform public.enviar_alerta_discord_sistema_dedup(
        v_bar, 'compras', 'vmarket_item_recusado',
        'Item recusado num pedido conferido (VMarket)',
        'Bar ' || v_bar || ' · pedido ' || r.id_pedido || ' (' || coalesce(r.fornecedor, 's/ fornecedor')
          || ', entrega ' || to_char(r.dt, 'DD/MM') || '): ' || v_qtd
          || ' item(ns) NAO vieram — ' || left(coalesce(v_lista, ''), 600)
          || '. Nao entram como compra; se a operacao precisa, tem que recomprar.',
        16753920,
        'vmarket_recusado_' || v_bar || '_' || r.id_pedido);
      v_total := v_total + 1;
    end loop;
  end loop;
  return 'check ok, pedidos com item recusado alertados=' || v_total;
end $function$;

comment on function public.watchdog_vmarket_itens_recusados() is
  'Avisa quando um pedido dado como conferido tem item recusado no VMarket. Dedupe por pedido.';

select cron.schedule(
  'watchdog-vmarket-itens-recusados',
  '0 14 * * *',                     -- 11h BRT, depois do sync da manha
  $$select public.watchdog_vmarket_itens_recusados();$$
);
