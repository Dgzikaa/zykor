-- 2026-06-20 — Vigia de lançamentos atrasados/retroativos (parte do "vigia financeiro").
-- Detecta despesas CRIADAS no CA nos últimos 2 dias mas com competência de mês já fechado
-- (mudam DRE/DFC do passado). Alerta via enviar_alerta_discord_sistema_dedup → Discord + push.
-- Foco bar 3 (Ordinário). Cron diário 'vigia-lancamentos-atrasados' (14:00 UTC).
-- O agente de VARIAÇÃO (verificar_dre_anomalias) já existe e cobre a outra metade.
CREATE OR REPLACE FUNCTION public.verificar_lancamentos_atrasados()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','bronze','pg_temp' AS $$
DECLARE v_bar int := 3; v_cnt int; v_total numeric; v_lista text;
BEGIN
  WITH atrasados AS (
    SELECT categoria_nome, data_competencia, valor_bruto
    FROM bronze.bronze_contaazul_lancamentos
    WHERE bar_id=v_bar AND excluido_em IS NULL AND tipo='DESPESA'
      AND raw_data->>'data_criacao' IS NOT NULL
      AND left(raw_data->>'data_criacao',10)::date >= current_date - interval '2 days'
      AND data_competencia < date_trunc('month', left(raw_data->>'data_criacao',10)::date)
      AND COALESCE(valor_bruto,0) >= 200
  )
  SELECT count(*), COALESCE(sum(valor_bruto),0),
         string_agg(to_char(data_competencia,'TMMon/YY')||' · '||COALESCE(categoria_nome,'?')||' · R$ '||to_char(valor_bruto,'FM999G990D00'), E'\n' ORDER BY valor_bruto DESC)
  INTO v_cnt, v_total, v_lista FROM atrasados;
  IF COALESCE(v_cnt,0) = 0 THEN RETURN 'sem atrasados'; END IF;
  RETURN public.enviar_alerta_discord_sistema_dedup(
    v_bar, 'aviso', 'lancamento_atrasado',
    '🕐 '||v_cnt||' lançamento(s) retroativo(s) — R$ '||to_char(v_total,'FM999G990D00'),
    'Criados nos últimos 2 dias com competência de mês já fechado (mudam DRE/DFC do passado):'||E'\n'||left(v_lista,800),
    16753920, 'lanc_atrasado_'||current_date::text);
END;$$;
SELECT cron.unschedule('vigia-lancamentos-atrasados') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='vigia-lancamentos-atrasados');
SELECT cron.schedule('vigia-lancamentos-atrasados', '0 14 * * *', $$SELECT public.verificar_lancamentos_atrasados()$$);
