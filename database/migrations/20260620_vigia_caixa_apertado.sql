-- 2026-06-20 — Vigia de caixa apertado (alerta proativo de falta de caixa).
-- Usa o último saldo (saldo_snapshot_mensal) + financial.fluxo_caixa_real(45d): se o saldo
-- projetado fica NEGATIVO em algum dia, alerta via Discord + push. Foco bar 3. Cron diário.
-- Só dispara depois que o snapshot de saldo (snapshot-saldos-ca) tiver dados.
CREATE OR REPLACE FUNCTION public.verificar_caixa_apertado()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','financial','pg_temp' AS $$
DECLARE v_bar int := 3; v_saldo numeric; v_min numeric; v_dia date;
BEGIN
  SELECT total INTO v_saldo FROM financial.saldo_snapshot_mensal WHERE bar_id=v_bar ORDER BY ano DESC, mes DESC LIMIT 1;
  IF v_saldo IS NULL THEN RETURN 'sem saldo'; END IF;
  SELECT saldo, dia INTO v_min, v_dia FROM financial.fluxo_caixa_real(v_bar, v_saldo, 45) ORDER BY saldo ASC LIMIT 1;
  IF v_min IS NULL OR v_min >= 0 THEN RETURN 'caixa ok'; END IF;
  RETURN public.enviar_alerta_discord_sistema_dedup(
    v_bar, 'critico', 'caixa_apertado',
    '⚠️ Caixa projetado NEGATIVO: R$ '||to_char(v_min,'FM999G990D00')||' em '||to_char(v_dia,'DD/MM'),
    'Pelo saldo atual + entradas projetadas − contas a pagar do CA, o caixa fecha NEGATIVO em '||to_char(v_dia,'DD/MM')||'. Antecipe recebíveis ou renegocie/adie pagamentos.',
    15158332, 'caixa_apertado_'||current_date::text);
END;$$;
SELECT cron.unschedule('vigia-caixa-apertado') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='vigia-caixa-apertado');
SELECT cron.schedule('vigia-caixa-apertado', '30 13 * * *', $$SELECT public.verificar_caixa_apertado()$$);
