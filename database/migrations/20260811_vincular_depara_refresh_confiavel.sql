-- =============================================================================
-- "Apertei em vincular e não vinculou" — corrigido em 11/08/2026
-- =============================================================================
--
-- Reportado pelo Isaías: cadastrou as fichas, apertou "Vincular", e o produto
-- continuava na lista sem entrar no CMV teórico, nas saídas nem nos desvios.
--
-- O VÍNCULO SEMPRE FUNCIONOU. Conferido: o "[DD] Rei Momo" (prd 1001 → c0132) foi
-- gravado em public.produto_contahub_map às 10:16:50. O que falhava era a tela refletir.
--
-- A lista "fora do de-para", o CMV teórico e as saídas leem a matview
-- silver.vendas_consolidada_dia. A rota /api/operacional/cmv-teorico chama
-- silver.fn_refresh_vendas_depara() logo depois de gravar, mas:
--   * o refresh leva ~13,2s (medido), e
--   * o PostgREST corta a chamada em 8s.
-- O refresh inline NUNCA completava. A rota tratava como best-effort e seguia, o toast
-- dizia "Já entra no CMV" (falso), e o item continuava na lista — parecendo que o botão
-- não fez nada. O único cron que refrescava essas matviews era o silver-vendas-produto-dia,
-- de HORA em hora, então a espera real era de até 60 minutos.
--
-- Correções aqui:
--  1. CONCURRENTLY — o fn_refresh_consumo_teorico (cron horário) já usava; esta função não.
--     Sem isso o refresh trava a leitura da matview justamente enquanto alguém está na tela.
--  2. Cron dedicado a cada 10 min, para o vínculo aparecer em minutos.
-- Fora daqui: o toast da tela passou a dizer o prazo real em vez de prometer efeito imediato.
--
-- NÃO confundir com o multiplicador: produto "dose dupla" precisa de
-- produto_cardapio.multiplicador = 2, senão a saída conta 1x — ver
-- 20260811_multiplicador_dose_dupla.sql.
-- =============================================================================

create or replace function silver.fn_refresh_vendas_depara()
returns void
language plpgsql
as $$
begin
  refresh materialized view concurrently silver.vendas_produto_dia;
  refresh materialized view concurrently silver.vendas_consolidada_dia;
  refresh materialized view concurrently gold.cmv_teorico_dia;
end
$$;

comment on function silver.fn_refresh_vendas_depara() is
  'Refresh das matviews que dependem do de-para produto->cardapio. CONCURRENTLY: leva ~13s e nao pode travar a leitura da tela. Chamada pela rota (best-effort, estoura o timeout de 8s do PostgREST) e pelo cron cmv-depara-refresh a cada 10 min.';

select cron.schedule('cmv-depara-refresh', '*/10 * * * *',
  'SET statement_timeout = ''5min''; SELECT silver.fn_refresh_vendas_depara();');
