-- 2026-06-03 — C1: Atração+Produção defasava porque custos lançados no ContaAzul
-- depois do show nunca disparavam recálculo do evento (auto_recalculo_eventos_pendentes
-- só pega precisa_recalculo=TRUE, marcado por ContaHub/vendas — nunca por ContaAzul/custos).
--
-- A função recalcular_eventos_recentes JÁ EXISTIA mas (a) tinha janela default de 7 dias
-- (perdia eventos com 8+ dias), (b) não filtrava ativo, (c) sem tratamento de erro por
-- evento (um PERFORM set-based aborta tudo se 1 falhar), e (d) NÃO estava agendada.
-- Aqui: melhora a função (default 21d, ativo=true, loop com EXCEPTION por evento) e agenda.
-- Cron 11:45 (após recalc ContaHub 11:30, antes do gold ETL 12:00). gold ETL passa a 21 dias.

CREATE OR REPLACE FUNCTION public.recalcular_eventos_recentes(dias_atras integer DEFAULT 21)
 RETURNS TABLE(eventos_recalculados integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM operations.eventos_base
    WHERE ativo = true
      AND data_evento >= CURRENT_DATE - dias_atras
      AND data_evento <= CURRENT_DATE
    ORDER BY data_evento DESC
  LOOP
    BEGIN
      PERFORM public.calculate_evento_metrics(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- não aborta o lote por causa de 1 evento problemático
      RAISE WARNING '[recalcular_eventos_recentes] evento % falhou: %', r.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Recalculados % eventos ativos dos ultimos % dias', v_count, dias_atras;
  RETURN QUERY SELECT v_count;
END;
$function$;

-- Agendamento (idempotente): recálculo diário 11:45 + janela do gold ETL ampliada p/ 21 dias.
SELECT cron.schedule('recalculo-eventos-recentes-contaazul', '45 11 * * *',
  $$ SELECT public.recalcular_eventos_recentes(21); $$);

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'gold-desempenho'),
  command := $$ SELECT public.etl_gold_desempenho_all_bars(21); $$
);
