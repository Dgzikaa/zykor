-- 2026-06-15 — Watchdog do DETALHE Yuzer.
--
-- O watchdog de frescor existente (system.data_freshness_config) vigia só o DISCOVERY
-- (bronze_yuzer_eventos.synced_at). Como o discovery continuou rodando, ele NÃO pegou
-- os ~4 meses em que o detalhe (pagamentos/produtos/fatporhora) ficou parado.
--
-- Este watchdog fecha esse buraco: alerta no Discord quando um painel Yuzer já
-- encerrado (data_fim passou há +1 dia) ainda está sem pagamentos/produtos/fatporhora
-- no bronze. Cron diário às 13 UTC (10h BRT). Dedup por dia.
--
-- Já aplicado em produção via MCP em 2026-06-15.

CREATE OR REPLACE FUNCTION public.yuzer_watchdog_detalhe()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'bronze', 'system', 'pg_temp'
AS $function$
DECLARE
  v_pend int;
BEGIN
  SELECT COUNT(*) INTO v_pend
  FROM bronze.bronze_yuzer_eventos e
  WHERE e.data_fim < (now() - interval '1 day')
    AND ( NOT EXISTS (SELECT 1 FROM bronze.bronze_yuzer_sync_log l WHERE l.bar_id=e.bar_id AND l.evento_id=e.evento_id AND l.tipo='pagamentos' AND l.status='success')
       OR NOT EXISTS (SELECT 1 FROM bronze.bronze_yuzer_sync_log l WHERE l.bar_id=e.bar_id AND l.evento_id=e.evento_id AND l.tipo='produtos'   AND l.status='success')
       OR NOT EXISTS (SELECT 1 FROM bronze.bronze_yuzer_sync_log l WHERE l.bar_id=e.bar_id AND l.evento_id=e.evento_id AND l.tipo='fatporhora' AND l.status='success') );

  IF v_pend = 0 THEN RETURN 'OK'; END IF;

  RETURN public.enviar_alerta_discord_sistema_dedup(
    3, 'erro', 'pipeline_saude',
    format('🎟️ Yuzer: %s painel(eis) com detalhe pendente', v_pend),
    'O discovery achou eventos Yuzer mas o detalhe (pagamentos/produtos/faturamento) '
    || 'não foi coletado em eventos já encerrados. Verifique o cron yuzer-detalhe-diario / '
    || 'a credencial Yuzer.' || E'\n\nVer: https://zykor.com.br/operacional/saude-pipeline',
    15158332,
    'yuzer_detalhe_' || to_char(CURRENT_DATE,'YYYY_MM_DD')
  );
END;
$function$;

SELECT cron.schedule('yuzer-watchdog-detalhe', '0 13 * * *',
  'SELECT public.yuzer_watchdog_detalhe();');
