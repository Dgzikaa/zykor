-- Botão "Recalcular" da tela de Saídas (pedido do Isaías, 18/08/2026).
--
-- O pedido veio como "recalcular quando a gente muda a embalagem". Medindo antes de construir, a
-- embalagem JÁ era ao vivo: `silver.fn_consumo_insumo_periodo` resolve
-- `coalesce(insumo_unidade.embalagem, operations.derive_embalagem(...))` pela chave manual `-i.id`
-- na hora da consulta e faz `qtd_contagem = qtd_base / embalagem` na saída. O que segurava o número
-- era o cache do navegador (o SWR dedupa 30s e não revalida ao focar a aba) — quem trocava a
-- embalagem em Insumos e voltava para as Saídas via o valor velho e concluía que não recalculou.
--
-- O que de fato NÃO era ao vivo é a base: `qtd_base` vem da matview
-- `silver.consumo_teorico_insumo_dia`, que embute ficha técnica e multiplicador. Mexer na ficha
-- exigia esperar o cron. Por isso o botão refaz essa matview — assim ele resolve os dois casos.
--
-- POR QUE NÃO USAR A `fn_refresh_consumo_teorico()`: ela leva ~18s. Medido matview a matview:
--
--   vendas_produto_dia          8,5s
--   vendas_consolidada_dia      8,1s
--   consumo_teorico_insumo_dia  1,8s
--   consumo_producao_dia        0,8s
--   cmv_teorico_dia             0,4s
--
-- As duas de vendas respondem por 16,6s dos 18,3s e o PostgREST corta em 8s — chamar a função
-- completa de uma rota é garantir timeout, que foi exatamente o que fez o botão "vincular" do
-- de-para parecer morto (ver 20260811_vincular_depara_refresh_confiavel.sql).
--
-- Esta função pega só as três de baixo, que somam ~3s e são as que mudam quando alguém mexe em
-- ficha, multiplicador ou embalagem. As de vendas ficam de fora de propósito: elas só mudam com
-- venda nova ou de-para novo, e para isso já existe o cron `cmv-depara-refresh` de 10 em 10 min.

create or replace function silver.fn_refresh_saidas()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'silver', 'public', 'operations', 'bronze', 'gold'
as $function$
declare t timestamptz := clock_timestamp();
begin
  refresh materialized view concurrently silver.consumo_teorico_insumo_dia;  -- ~1,8s
  refresh materialized view concurrently silver.consumo_producao_dia;        -- ~0,8s
  refresh materialized view concurrently gold.cmv_teorico_dia;               -- ~0,4s
  return jsonb_build_object('segundos', round(extract(epoch from clock_timestamp()-t)::numeric, 2));
end $function$;

comment on function silver.fn_refresh_saidas() is
  'Refresh rapido (~3s) das matviews de consumo teorico. Para o botao Recalcular das Saidas. NAO refaz as matviews de vendas (16s, estouram o teto de 8s do PostgREST) - essas tem cron proprio.';
