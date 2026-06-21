-- 2026-06-21 — Watchdog: alerta se insumos AUTO_ voltarem a aparecer (repoluição do cadastro).
-- Contexto: nenhum código do app cria AUTO_ hoje (contagem salva por insumo_id; imports pulam sem-match).
-- Os 174 AUTO_ originais foram artefato de backfill único (dez/2025), já deduplicados. Este é seguro
-- contra regressão futura (algum import novo recriar AUTO_). Ver [[project_insumos_cadastro_planilha_mestre]].
CREATE OR REPLACE FUNCTION operations.watchdog_insumos_auto()
RETURNS text LANGUAGE plpgsql SET search_path TO 'operations','public','pg_catalog' AS $$
DECLARE v_qtd int; v_lista text;
BEGIN
  SELECT count(*), string_agg(nome || ' ('||codigo||')', ', ')
    INTO v_qtd, v_lista
  FROM operations.insumos
  WHERE (codigo LIKE 'AUTO\_%' OR codigo LIKE 'auto\_%') AND ativo=true
    AND created_at >= now() - interval '2 days';
  IF COALESCE(v_qtd,0) > 0 THEN
    PERFORM public.enviar_alerta_discord_sistema_dedup(
      3, 'cadastro', 'insumos_auto',
      'Insumos AUTO_ novos no cadastro',
      v_qtd || ' insumo(s) AUTO_ criados nas ultimas 48h - possivel repoluicao do cadastro: ' || left(COALESCE(v_lista,''), 600),
      16753920, 'insumos_auto_'||current_date::text);
    RETURN 'ALERTA: '||v_qtd;
  END IF;
  RETURN 'OK';
END $$;
-- cron diário 13:00 UTC
SELECT cron.unschedule('watchdog-insumos-auto') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='watchdog-insumos-auto');
SELECT cron.schedule('watchdog-insumos-auto', '0 13 * * *', $$SELECT operations.watchdog_insumos_auto();$$);
