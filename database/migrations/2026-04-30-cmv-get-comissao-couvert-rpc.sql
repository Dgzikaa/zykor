-- 2026-04-30: RPC pra cmv-semanal-auto somar comissao + couvert
--
-- Bug: cmv_semanal mostrava faturamento_bruto = vendas_liquidas =
-- faturamento_cmvivel (3 colunas iguais) em todas as semanas.
--
-- Causa: a edge function cmv-semanal-auto lia sem.comissao e
-- sem.faturamento_entrada de gold.desempenho — esses campos sao 0
-- (gold nao popula). Logo:
--   faturamentoLimpo = bruto - 0 - 0 = bruto.
--
-- Fix tentativa 1: ler bronze.bronze_contahub_avendas_vendasperiodo
-- direto via PostgREST. NAO funcionou — bronze tem ~4000 linhas/semana
-- e PostgREST default limita 1000 -> sum incompleto (S15 Ord: 25k de
-- 101k esperado).
--
-- Fix tentativa 2 (esta migration): RPC SQL que agrega no servidor.
-- Edge function chama via supabase.rpc() e recebe valor agregado.
--
-- Validacao S15 Ord: bruto 382.769, liquido 281.094 (diff 101.675 =
-- 32.050 repique + 69.625 couvert).

CREATE OR REPLACE FUNCTION public.get_comissao_couvert_periodo(
  p_bar_id integer,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE(comissao numeric, couvert numeric)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT
    COALESCE(SUM(vd_vrrepique), 0)::numeric(14,2) AS comissao,
    COALESCE(SUM(vd_vrcouvert), 0)::numeric(14,2) AS couvert
  FROM bronze.bronze_contahub_avendas_vendasperiodo
  WHERE bar_id = p_bar_id
    AND vd_dtgerencial::date BETWEEN p_data_inicio AND p_data_fim;
$function$;

GRANT EXECUTE ON FUNCTION public.get_comissao_couvert_periodo(integer, date, date) TO anon, authenticated, service_role;
