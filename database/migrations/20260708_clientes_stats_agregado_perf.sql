-- 2026-07-08 — Perf da tela /analitico/clientes (estava "demorando muito pra carregar").
--
-- Diagnóstico: get_cliente_stats_agregado(bar) levava ~5,14s. A função tinha um CTE
-- (entrada_agg) que reagregava silver.cliente_visitas (187k linhas) a cada request,
-- só para calcular valor_total_entrada e ticket_medio_entrada. Mas:
--   1) silver.cliente_estatisticas JÁ tem valor_total_entrada por cliente;
--   2) a API /api/analitico/clientes sequer usa ticket_medio_entrada (recomputa em JS).
-- Ou seja, o scan de 187k linhas era 100% desnecessário. É o único caller da função.
--
-- Fix: (a) índice covering em cliente_estatisticas(bar_id) INCLUDE(...) → Index Only Scan
--      (b) reescrever a função para agregar SÓ de cliente_estatisticas.
-- Resultado medido: 5.140ms → ~38ms (Index Only Scan, Heap Fetches: 0).
-- ticket_medio_entrada passa a usar total_visitas como denominador (aprox.; não é lido
-- pela API — mantido no retorno só por compatibilidade de assinatura).

create index if not exists idx_cliente_estat_bar_resumo
  on silver.cliente_estatisticas (bar_id)
  include (total_visitas, valor_total_entrada, valor_total_consumo, eh_vip);

create or replace function public.get_cliente_stats_agregado(p_bar_id integer)
 returns table(total_clientes_unicos integer, total_visitas_geral integer, valor_total_geral numeric, valor_total_entrada numeric, valor_total_consumo numeric, ticket_medio_geral numeric, ticket_medio_entrada numeric, ticket_medio_consumo numeric, clientes_com_telefone integer, clientes_vip integer)
 language sql
 security definer
 set search_path to 'public', 'silver'
as $function$
  select
    count(*)::integer,
    coalesce(sum(total_visitas),0)::integer,
    (coalesce(sum(valor_total_consumo),0) + coalesce(sum(valor_total_entrada),0))::numeric(14,2),
    coalesce(sum(valor_total_entrada),0)::numeric(14,2),
    coalesce(sum(valor_total_consumo),0)::numeric(14,2),
    case when sum(total_visitas) > 0
         then ((coalesce(sum(valor_total_consumo),0) + coalesce(sum(valor_total_entrada),0)) / sum(total_visitas))::numeric(10,2) end,
    case when sum(total_visitas) > 0
         then (coalesce(sum(valor_total_entrada),0) / sum(total_visitas))::numeric(10,2) end,
    case when sum(total_visitas) > 0
         then (coalesce(sum(valor_total_consumo),0) / sum(total_visitas))::numeric(10,2) end,
    count(*)::integer,
    count(*) filter (where eh_vip = true)::integer
  from silver.cliente_estatisticas
  where bar_id = p_bar_id;
$function$;
