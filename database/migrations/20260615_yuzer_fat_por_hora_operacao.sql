-- 2026-06-15 — RPC public.yuzer_fat_por_hora_operacao(bar, data).
--
-- A tela /analitico/eventos (aba Relatórios → "Horário de Pico") somava só o ContaHub no
-- faturamento por hora. Em dias de evento Yuzer (ex.: 13/06 Brasil×Marrocos, bar 3) o
-- gráfico e o "Resumo do Dia" mostravam ~R$18 (só ContaHub), ignorando os ~R$104k da
-- bilheteria Yuzer.
--
-- Esta RPC devolve o faturamento Yuzer por HORA (BRT, 0-23) atribuído à DATA DE OPERAÇÃO
-- (regra -6h: madrugada conta pro dia anterior), igual ao calculate_evento_metrics v30/v31
-- e aos ETLs silver. A /api/ferramentas/horario-pico soma esse valor por hora ao ContaHub
-- e sobrepõe os totais do "Resumo do Dia" com o consolidado de operations.eventos_base
-- (real_r + faturamento_couvert + faturamento_bar + cl_real) quando o evento está marcado
-- usa_yuzer/usa_sympla.
--
-- Já aplicado em produção via MCP em 2026-06-15.

CREATE OR REPLACE FUNCTION public.yuzer_fat_por_hora_operacao(
  p_bar_id integer,
  p_data_operacao date
)
RETURNS TABLE(hora integer, faturamento numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'bronze', 'pg_temp'
AS $function$
  SELECT
    EXTRACT(hour FROM (f.data_hora AT TIME ZONE 'America/Sao_Paulo'))::int AS hora,
    SUM(f.faturamento)::numeric AS faturamento
  FROM bronze.bronze_yuzer_fatporhora f
  WHERE f.bar_id = p_bar_id
    AND f.faturamento > 0
    AND (((f.data_hora AT TIME ZONE 'America/Sao_Paulo') - interval '6 hours')::date) = p_data_operacao
  GROUP BY 1
  ORDER BY 1;
$function$;

GRANT EXECUTE ON FUNCTION public.yuzer_fat_por_hora_operacao(integer, date) TO authenticated, service_role, anon;
