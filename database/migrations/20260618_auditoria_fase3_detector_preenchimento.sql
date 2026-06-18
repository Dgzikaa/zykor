-- 2026-06-18 — Auditoria Fase 3: detector de anomalia de preenchimento (Ordinário).
-- verificar_preenchimento_ca() roda diário e flaga:
--   (A) mudanças RETROATIVAS no CA (últimas 24h) com competência em mês JÁ FECHADO
--       (fonte: bronze.contaazul_lancamentos_historico — Fase 1);
--   (B) linhas da DRE que mudaram entre as 2 últimas fotos em mês fechado
--       (fonte: financial.dre_dfc_snapshot — Fase 2).
-- Manda alerta no Discord (dedup/dia) pra conferir/cobrar na hora. Ativa conforme
-- o histórico (próximos syncs) e as fotos (>=2 dias) acumulam.
-- Cron diário 11:30 BRT (depois do snapshot das 11:00):
--   SELECT cron.schedule('auditoria-preenchimento-ca-diario','30 14 * * *', $$ SELECT public.verificar_preenchimento_ca(); $$);

CREATE OR REPLACE FUNCTION public.verificar_preenchimento_ca()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','financial','bronze','extensions','pg_temp'
AS $fn$
DECLARE
  v_bar int := 3;
  v_msg text := ''; v_retro text := ''; v_snap text := '';
  v_data text := current_date::text;
  v_mes date := date_trunc('month', current_date)::date;
  v_hoje date; v_ant date; r record;
BEGIN
  FOR r IN
    SELECT to_char(data_competencia,'TMMon/YY') AS mes, evento, COUNT(*) n
    FROM bronze.contaazul_lancamentos_historico
    WHERE bar_id=v_bar AND alterado_em >= now() - interval '26 hours'
      AND data_competencia IS NOT NULL AND data_competencia < v_mes
    GROUP BY to_char(data_competencia,'TMMon/YY'), data_competencia, evento
    ORDER BY data_competencia DESC, n DESC LIMIT 8
  LOOP
    v_retro := v_retro || format('• %s — %s: %s lançamento(s).'||E'\n', r.mes, r.evento, r.n);
  END LOOP;

  SELECT max(snapshot_date) INTO v_hoje FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE';
  SELECT max(snapshot_date) INTO v_ant  FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE' AND snapshot_date < v_hoje;
  IF v_ant IS NOT NULL THEN
    FOR r IN
      WITH h AS (SELECT mes,grupo,categoria,valor FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE' AND snapshot_date=v_hoje),
           a AS (SELECT mes,grupo,categoria,valor FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE' AND snapshot_date=v_ant)
      SELECT COALESCE(h.categoria,a.categoria) AS categoria, COALESCE(h.mes,a.mes) AS mes,
             COALESCE(a.valor,0) AS v_ant, COALESCE(h.valor,0) AS v_hoje
      FROM h FULL JOIN a ON h.mes=a.mes AND h.grupo=a.grupo AND h.categoria=a.categoria
      WHERE COALESCE(h.mes,a.mes) < v_mes AND ABS(COALESCE(h.valor,0)-COALESCE(a.valor,0)) > 1000
      ORDER BY ABS(COALESCE(h.valor,0)-COALESCE(a.valor,0)) DESC LIMIT 8
    LOOP
      v_snap := v_snap || format('• %s (%s): R$ %s → R$ %s.'||E'\n', r.categoria, to_char(r.mes,'TMMon/YY'),
        to_char(r.v_ant,'FM999G999G990'), to_char(r.v_hoje,'FM999G999G990'));
    END LOOP;
  END IF;

  IF v_retro <> '' THEN v_msg := v_msg || '_Mudanças retroativas no CA (24h, mês já fechado):_'||E'\n'||v_retro; END IF;
  IF v_snap  <> '' THEN v_msg := v_msg || '_Linhas da DRE que mudaram desde a última foto (mês fechado):_'||E'\n'||v_snap; END IF;

  IF v_msg <> '' THEN
    RETURN public.enviar_alerta_discord_sistema_dedup(
      v_bar,'alerta','preenchimento_ca','🔎 Auditoria de Preenchimento (Ordinário) — '||v_data,
      'Movimentações em meses já fechados — vale conferir/cobrar:'||E'\n'||v_msg, 15105570, 'preench_ca_'||v_data);
  END IF;
  RETURN 'OK_SEM_ALERTA';
END;
$fn$;
